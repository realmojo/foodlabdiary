#!/usr/bin/env node

/**
 * pawpaw 포스트 자동 생성 스크립트
 *
 * 사용법:
 *   node scripts/create-post.mjs <URL> [카테고리slug]
 *
 * 예시:
 *   node scripts/create-post.mjs https://example.com/article dogs
 *
 * 1) URL에서 원문 제목/본문/이미지 추출
 * 2) Ollama gemma3로 제목+본문 재창작 (3000자 이상)
 * 3) 원본 이미지 → S3 petpawpaw 버킷 업로드
 * 4) Supabase DB에 포스트 삽입
 */

import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { readFileSync, writeFileSync, existsSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, "..", ".env.local") })

import https from "https"
import http from "http"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import { Ollama } from "ollama"
import sharp from "sharp"

// ─── Config ───────────────────────────────────────────
const MODEL = "gemma3"
const ollama = new Ollama()
const S3_BUCKET = "petpawpaw"
const S3_REGION = process.env.AWS_REGION || "ap-northeast-2"

const s3 = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ─── Helpers ──────────────────────────────────────────

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`)
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http
    client
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirect = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href
          return fetchText(redirect).then(resolve).catch(reject)
        }
        let body = ""
        res.setEncoding("utf-8")
        res.on("data", (c) => (body += c))
        res.on("end", () => resolve(body))
        res.on("error", reject)
      })
      .on("error", reject)
  })
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http
    client
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirect = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href
          return fetchBuffer(redirect).then(resolve).catch(reject)
        }
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () =>
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: res.headers["content-type"] || "image/jpeg",
          })
        )
        res.on("error", reject)
      })
      .on("error", reject)
  })
}

async function ollamaGenerate(prompt) {
  const response = await ollama.generate({
    model: MODEL,
    prompt,
    options: { temperature: 0.7, num_predict: 8192 },
    keep_alive: "15m",
  })
  return response.response || ""
}

// ─── Step 1: 원문 추출 ────────────────────────────────

function extractArticle(html) {
  // 제목 추출
  const titleMatch =
    html.match(
      /<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i
    ) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i)
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
    : "제목 없음"

  // 본문 추출 (entry-content 또는 article 태그)
  const contentMatch =
    html.match(
      /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/|<div[^>]*class="[^"]*(?:post-tags|author-box|related|comments|share))/i
    ) ||
    html.match(
      /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ) ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)

  const contentHtml = contentMatch ? contentMatch[1] : ""

  // 이미지 URL 추출
  const images = []
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi
  let imgMatch
  while ((imgMatch = imgRegex.exec(contentHtml)) !== null) {
    const src = imgMatch[1]
    if (
      src.includes("wp-content/uploads") ||
      src.includes("s3.") ||
      src.match(/\.(jpg|jpeg|png|webp|gif)/i)
    ) {
      if (
        !src.includes("logo") &&
        !src.includes("icon") &&
        !src.includes("avatar")
      ) {
        images.push(src)
      }
    }
  }

  // 텍스트 추출
  const paragraphs = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let pMatch
  while ((pMatch = pRegex.exec(contentHtml)) !== null) {
    const text = pMatch[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8230;/g, "…")
      .trim()
    if (text.length > 10) paragraphs.push(text)
  }

  return { title, paragraphs, images }
}

// ─── Step 2: Gemma3로 재창작 ──────────────────────────

async function rewriteArticle(title, paragraphs) {
  const originalText = paragraphs.join("\n\n")

  const prompt = `당신은 반려동물 전문 매거진 "포우포우"의 수석 에디터입니다.
아래 원문 기사의 주제를 참고하여, 완전히 새롭고 독창적인 기사를 작성해주세요.

## 반드시 지켜야 할 규칙
1. 제목: 독자의 호기심을 강하게 자극하는 새로운 제목 작성 (원문 제목을 그대로 사용하지 마세요)
2. 본문 길이: 반드시 3500자 이상 작성 (이것은 절대적 요구사항입니다)
3. 섹션 구성: 8~10개의 ## 소제목 섹션으로 나누기
4. 각 섹션 본문: 최소 3~5개 문장으로 충분히 설명
5. 문체: 정보성 매거진 톤, 존댓말(~합니다, ~해요)
6. 원문의 핵심 주제를 다루되, 모든 문장을 완전히 새로 작성
7. 구체적인 수치, 예시, 팁을 풍부하게 포함
8. 도입부: 독자의 공감을 이끄는 상황 묘사로 시작
9. 결론: 핵심 메시지를 요약하고 독자에게 따뜻한 조언을 전하며 마무리
10. 중간중간 리스트(- 항목)도 활용하여 가독성을 높이세요

## 출력 형식 (반드시 이 형식을 정확히 따르세요)
TITLE: 새로운 제목을 여기에
BODY:
여기부터 본문 시작 (마크다운 ## 소제목 사용, 3500자 이상)

## 원문 제목
${title}

## 원문 내용 (참고용)
${originalText}

중요: 반드시 3500자 이상 작성하세요. 짧게 쓰면 안 됩니다. 각 섹션을 충분히 상세하게 서술하세요.`

  log("🤖", "Ollama gemma3 재창작 요청 중... (최대 15분 소요)")
  const response = await ollamaGenerate(prompt)

  // 파싱
  const titleLineMatch = response.match(/TITLE:\s*(.+)/i)
  const bodyMatch = response.match(/BODY:\s*\n([\s\S]+)/i)

  const newTitle = titleLineMatch
    ? titleLineMatch[1].trim().replace(/^["']|["']$/g, "")
    : `${title} - 재구성`
  const newBody = bodyMatch ? bodyMatch[1].trim() : response.trim()

  return { newTitle, newBody }
}

// ─── Step 2.5: 카테고리 자동 분류 ────────────────────

async function detectCategory(title, paragraphs) {
  const sample = paragraphs.slice(0, 5).join("\n")
  const prompt = `아래 기사의 제목과 본문을 읽고, 가장 적합한 카테고리를 하나만 골라주세요.

카테고리 목록:
- dogs: 강아지 관련 (품종, 행동, 훈련, 건강, 사료, 용품 등)
- cats: 고양이 관련 (품종, 행동, 건강, 사료, 용품 등)
- animals: 기타 동물 및 반려동물 전반 (하마, 새, 파충류, 야생동물, 여러 동물 공통 주제 등)

규칙:
- 반드시 위 목록 중 하나의 slug만 출력하세요.
- 다른 텍스트 없이 slug만 출력하세요.

제목: ${title}

본문 일부:
${sample}`

  log("🏷️", "카테고리 자동 분류 중...")
  const response = await ollamaGenerate(prompt)
  const slug = response
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "")
  const valid = ["dogs", "cats", "animals"]
  const detected = valid.find((v) => slug.includes(v)) || "animals"
  log("🏷️", `감지된 카테고리: ${detected}`)
  return detected
}

// ─── Step 3: 마크다운 → 블록 변환 ─────────────────────

function convertInlineMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
}

function markdownToBlocks(markdown, imageUrls) {
  const blocks = []
  const lines = markdown.split("\n")
  let currentParagraph = []

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const text = convertInlineMarkdown(currentParagraph.join(" ").trim())
      if (text.length > 0) {
        blocks.push({ type: "paragraph", text })
      }
      currentParagraph = []
    }
  }

  // 1단계: 텍스트 블록만 먼저 생성
  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("## ")) {
      flushParagraph()
      blocks.push({
        type: "heading",
        level: 2,
        text: convertInlineMarkdown(trimmed.slice(3).trim()),
      })
    } else if (trimmed.startsWith("### ")) {
      flushParagraph()
      blocks.push({
        type: "heading",
        level: 3,
        text: convertInlineMarkdown(trimmed.slice(4).trim()),
      })
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph()
      const items = [convertInlineMarkdown(trimmed.slice(2).trim())]
      const lastBlock = blocks[blocks.length - 1]
      if (lastBlock && lastBlock.type === "list" && !lastBlock.ordered) {
        lastBlock.items.push(convertInlineMarkdown(trimmed.slice(2).trim()))
      } else {
        blocks.push({ type: "list", ordered: false, items })
      }
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph()
      const text = convertInlineMarkdown(trimmed.replace(/^\d+\.\s/, "").trim())
      const lastBlock = blocks[blocks.length - 1]
      if (lastBlock && lastBlock.type === "list" && lastBlock.ordered) {
        lastBlock.items.push(convertInlineMarkdown(text))
      } else {
        blocks.push({ type: "list", ordered: true, items: [text] })
      }
    } else if (trimmed === "") {
      flushParagraph()
    } else {
      if (/^(TITLE|BODY):/i.test(trimmed)) continue
      currentParagraph.push(trimmed)
    }
  }

  flushParagraph()

  // 2단계: 이미지를 heading 위치 기준으로 균등 배치
  if (imageUrls.length === 0) return blocks

  const headingIndices = blocks
    .map((b, i) => (b.type === "heading" && b.level === 2 ? i : -1))
    .filter((i) => i >= 0)

  if (headingIndices.length === 0) {
    // heading이 없으면 블록 사이에 균등 배치
    const gap = Math.max(1, Math.floor(blocks.length / (imageUrls.length + 1)))
    for (let i = imageUrls.length - 1; i >= 0; i--) {
      const insertAt = Math.min(gap * (i + 1), blocks.length)
      blocks.splice(insertAt, 0, {
        type: "image",
        url: imageUrls[i],
        alt: "",
        caption: "",
      })
    }
    return blocks
  }

  // heading 간격에 맞춰 이미지를 균등 분배
  // 각 이미지가 들어갈 heading 뒤 위치를 계산
  const totalImages = imageUrls.length
  const totalHeadings = headingIndices.length
  const insertPositions = []

  for (let i = 0; i < totalImages; i++) {
    // 이미지를 heading들 사이에 균등하게 배분
    const headingIdx = Math.round((i / totalImages) * (totalHeadings - 1))
    insertPositions.push(headingIndices[headingIdx])
  }

  // 뒤에서부터 삽입해야 인덱스가 밀리지 않음
  for (let i = totalImages - 1; i >= 0; i--) {
    const afterHeading = insertPositions[i] + 1
    blocks.splice(afterHeading, 0, {
      type: "image",
      url: imageUrls[i],
      alt: "",
      caption: "",
    })
  }

  return blocks
}

// ─── Step 4: 이미지 분석 → 재생성 → S3 업로드 ───────

async function analyzeImage(imageBuffer) {
  // webp 등 다양한 포맷을 llava가 처리할 수 있도록 JPEG로 변환
  const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer()
  const base64 = jpegBuffer.toString("base64")
  const response = await ollama.generate({
    model: "llava",
    prompt:
      "Describe this image in detail for recreating it. Include subject, composition, colors, mood, background, and style. Be specific and vivid. Output only the description, nothing else.",
    images: [base64],
    options: { temperature: 0.3, num_predict: 512 },
    keep_alive: "15m",
  })
  return response.response || ""
}

async function unloadModel(model) {
  try {
    await ollama.generate({ model, prompt: "", keep_alive: 0 })
  } catch {}
}

async function generateImage(description) {
  const prompt = `Create a high-quality, original illustration: ${description}. Style: clean, modern, vibrant colors, professional pet magazine photography style.`
  const response = await ollama.generate({
    model: "x/z-image-turbo",
    prompt,
    options: { temperature: 0.8, num_predict: 4096 },
    keep_alive: "15m",
  })

  // x/z-image-turbo returns base64 image in response.image (singular string)
  if (response.image) {
    return Buffer.from(response.image, "base64")
  }

  // fallback: response.images (array)
  if (response.images && response.images.length > 0) {
    return Buffer.from(response.images[0], "base64")
  }

  return null
}

async function uploadImagesToS3(imageUrls) {
  const now = new Date()
  const prefix = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`
  const uploaded = []

  // ── Phase 1: 모든 이미지 다운로드 ──
  const downloads = []
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i]
    log(
      "📸",
      `이미지 다운로드 중 (${i + 1}/${imageUrls.length}): ${url.slice(0, 80)}...`
    )
    try {
      const { buffer } = await fetchBuffer(url)
      log("✅", `다운로드 완료 (${(buffer.length / 1024).toFixed(0)}KB)`)
      downloads.push({ buffer, index: i })
    } catch (err) {
      log("⚠️", `이미지 다운로드 실패: ${err.message}`)
    }
  }

  // gemma3 언로드 → VRAM 확보 (텍스트 생성/분류/slug에서 사용 후 남아있음)
  log("🔄", `gemma3 모델 언로드 중...`)
  await unloadModel(MODEL)

  // ── Phase 2: llava로 모든 이미지 분석 ──
  log("🔍", `llava 모델로 ${downloads.length}개 이미지 분석 시작...`)
  const descriptions = []
  for (const { buffer, index } of downloads) {
    log("🔍", `이미지 분석 중 (${index + 1}/${imageUrls.length})...`)
    try {
      const desc = await analyzeImage(buffer)
      log("📝", `분석 완료: ${desc.slice(0, 100)}...`)
      descriptions.push({ buffer, description: desc, index })
    } catch (err) {
      log("⚠️", `이미지 분석 실패, 원본 사용: ${err.message}`)
      descriptions.push({ buffer, description: null, index })
    }
  }

  // llava 언로드 → VRAM 확보
  log("🔄", `llava 모델 언로드 중...`)
  await unloadModel("llava")

  // ── Phase 3: x/z-image-turbo로 모든 이미지 생성 ──
  log(
    "🎨",
    `x/z-image-turbo 모델로 ${descriptions.length}개 이미지 생성 시작...`
  )
  const results = []
  for (const { buffer, description, index } of descriptions) {
    if (description) {
      log("🎨", `이미지 생성 중 (${index + 1}/${imageUrls.length})...`)
      try {
        const generatedBuffer = await generateImage(description)
        if (generatedBuffer) {
          log(
            "✅",
            `생성 완료 (${(generatedBuffer.length / 1024).toFixed(0)}KB)`
          )
          results.push({ buffer: generatedBuffer, index })
          continue
        }
      } catch (err) {
        log("⚠️", `이미지 생성 실패: ${err.message}`)
      }
    }
    // fallback: 원본 사용
    log("⚠️", `원본 이미지 사용 (${index + 1})`)
    results.push({ buffer, index })
  }

  // x/z-image-turbo 언로드 → VRAM 확보
  log("🔄", `x/z-image-turbo 모델 언로드 중...`)
  await unloadModel("x/z-image-turbo")

  // ── Phase 4: webp 변환 → S3 업로드 ──
  for (const { buffer: sourceBuffer, index } of results) {
    try {
      const webpBuffer = await sharp(sourceBuffer)
        .webp({ quality: 80 })
        .toBuffer()
      const filename = `${randomUUID().slice(0, 8)}.webp`
      const key = `${prefix}/${filename}`

      log(
        "☁️",
        `S3 업로드 (${index + 1}/${imageUrls.length}): s3://${S3_BUCKET}/${key} (${(sourceBuffer.length / 1024).toFixed(0)}KB → ${(webpBuffer.length / 1024).toFixed(0)}KB webp)`
      )

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: webpBuffer,
          ContentType: "image/webp",
        })
      )

      const s3Url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
      uploaded.push(s3Url)
    } catch (err) {
      log("⚠️", `이미지 업로드 실패: ${err.message}`)
    }
  }

  return uploaded
}

// ─── Step 5: Supabase 삽입 ────────────────────────────

async function slugify(title) {
  try {
    const prompt = `Translate the following title to a short English URL slug (lowercase, hyphens only, max 6 words, no explanation, just the slug):\n"${title}"`
    const raw = await ollamaGenerate(prompt)
    const slug = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-]+/g, "-")
      .replace(/^-+|-+$/g, "")
    if (slug && slug.length >= 3) return slug
  } catch (e) {
    console.warn("⚠️ slug 생성 실패, fallback 사용:", e.message)
  }
  return `post-${randomUUID().slice(0, 8)}`
}

async function insertPost(title, excerpt, blocks, s3Images, categorySlug) {
  // 작성자: 기본 에디터
  let { data: author } = await supabase
    .from("pawpaw_authors")
    .select("id")
    .eq("slug", "park-sooa")
    .single()

  if (!author) {
    const { data } = await supabase
      .from("pawpaw_authors")
      .insert({ name: "박수아", slug: "park-sooa", bio: "pawpaw 에디터" })
      .select("id")
      .single()
    author = data
  }

  // 카테고리
  let { data: category } = await supabase
    .from("pawpaw_categories")
    .select("id, slug")
    .eq("slug", categorySlug || "dogs")
    .single()

  if (!category) {
    // 기본 카테고리
    const { data } = await supabase
      .from("pawpaw_categories")
      .select("id, slug")
      .order("sort_order")
      .limit(1)
      .single()
    category = data
  }

  const slug = await slugify(title)
  const featuredImage = s3Images.length > 0 ? s3Images[0] : null

  // 읽기 시간 계산
  const totalChars = blocks
    .filter((b) => b.text)
    .reduce((sum, b) => sum + b.text.length, 0)
  const readTime = `${Math.max(1, Math.round(totalChars / 500))}분`

  const { data: post, error } = await supabase
    .from("pawpaw_posts")
    .insert({
      title,
      slug,
      excerpt,
      content: blocks,
      author_id: author.id,
      primary_category_id: category.id,
      featured_image_url: featuredImage,
      status: "published",
      read_time: readTime,
      published_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single()

  if (error) {
    // slug 충돌 시 재시도
    if (error.code === "23505") {
      const retrySlug = `${slug}-${randomUUID().slice(0, 4)}`
      const { data: post2, error: err2 } = await supabase
        .from("pawpaw_posts")
        .insert({
          title,
          slug: retrySlug,
          excerpt,
          content: blocks,
          author_id: author.id,
          primary_category_id: category.id,
          featured_image_url: featuredImage,
          status: "published",
          read_time: readTime,
          published_at: new Date().toISOString(),
        })
        .select("id, slug")
        .single()
      if (err2) throw err2
      // post_categories
      await supabase
        .from("pawpaw_post_categories")
        .insert({ post_id: post2.id, category_id: category.id })
      return post2
    }
    throw error
  }

  // post_categories
  await supabase
    .from("pawpaw_post_categories")
    .insert({ post_id: post.id, category_id: category.id })

  return post
}

// ─── Main ─────────────────────────────────────────────

function pickRandomUrl() {
  const sitemapPath = resolve(__dirname, "sitemap-urls.json")
  const completePath = resolve(__dirname, "complete-urls.json")

  if (!existsSync(sitemapPath)) {
    console.error("❌ sitemap-urls.json 파일이 없습니다.")
    process.exit(1)
  }

  const allUrls = JSON.parse(readFileSync(sitemapPath, "utf-8"))
  const completeUrls = existsSync(completePath)
    ? JSON.parse(readFileSync(completePath, "utf-8"))
    : []

  const remaining = allUrls.filter((u) => !completeUrls.includes(u))

  if (remaining.length === 0) {
    console.log("✅ 모든 URL이 처리 완료되었습니다.")
    process.exit(0)
  }

  const picked = remaining[Math.floor(Math.random() * remaining.length)]
  log("🎲", `남은 URL: ${remaining.length}개 중 랜덤 선택`)
  return picked
}

function markComplete(url) {
  const completePath = resolve(__dirname, "complete-urls.json")
  const completeUrls = existsSync(completePath)
    ? JSON.parse(readFileSync(completePath, "utf-8"))
    : []

  if (!completeUrls.includes(url)) {
    completeUrls.push(url)
    writeFileSync(completePath, JSON.stringify(completeUrls, null, 2), "utf-8")
  }
}

async function processOne(url, categorySlug) {
  console.log("═══════════════════════════════════════════")
  console.log("  pawpaw 포스트 자동 생성")
  console.log("═══════════════════════════════════════════\n")

  // Step 1: 원문 가져오기
  log("🔍", `원문 가져오는 중: ${url}`)
  const html = await fetchText(url)
  const { title, paragraphs, images } = extractArticle(html)

  log("📄", `제목: ${title}`)
  log("📝", `본문 단락: ${paragraphs.length}개`)
  log("🖼️", `이미지: ${images.length}개`)

  if (paragraphs.length === 0) {
    log("❌", "본문을 추출할 수 없습니다. 건너뜁니다.")
    markComplete(url)
    return
  }

  console.log("")

  // Step 2: S3 이미지 업로드
  log("📤", "이미지 S3 업로드 시작...")
  const s3Images = await uploadImagesToS3(images)
  log("✅", `이미지 업로드 완료: ${s3Images.length}개\n`)

  // Step 3: 카테고리 자동 분류 (명시하지 않은 경우)
  const finalCategory =
    categorySlug || (await detectCategory(title, paragraphs))

  // Step 4: Gemma3로 재창작
  const { newTitle, newBody } = await rewriteArticle(title, paragraphs)
  log("✅", `재창작 완료`)
  log("📄", `새 제목: ${newTitle}`)
  log("📝", `새 본문 길이: ${newBody.length}자\n`)

  // Step 5: 블록 변환
  const blocks = markdownToBlocks(newBody, s3Images)
  const excerpt =
    blocks.find((b) => b.type === "paragraph")?.text?.slice(0, 200) || ""
  log("🧱", `블록 변환 완료: ${blocks.length}개 블록\n`)

  // Step 6: DB 삽입
  log("💾", "Supabase DB 저장 중...")
  const post = await insertPost(
    newTitle,
    excerpt,
    blocks,
    s3Images,
    finalCategory
  )
  log("✅", `DB 저장 완료!`)

  // 완료된 URL을 complete-urls.json에 저장
  markComplete(url)
  log("📋", `complete-urls.json에 저장 완료`)

  console.log("\n═══════════════════════════════════════════")
  console.log(`  포스트 URL: /${post.slug}`)
  console.log("═══════════════════════════════════════════\n")
}

async function main() {
  const singleUrl = process.argv[2]
  const categorySlug = process.argv[3]

  // URL을 직접 지정한 경우 1회만 실행
  if (singleUrl) {
    await processOne(singleUrl, categorySlug)
    return
  }

  // 랜덤 모드: 남은 URL이 없을 때까지 반복
  let round = 1
  while (true) {
    const url = pickRandomUrl()
    console.log(`\n🔄 [${round}번째] ${url}\n`)
    try {
      await processOne(url, categorySlug)
    } catch (err) {
      log("❌", `오류 발생: ${err.message || err}`)
      log("⏭️", "해당 URL을 건너뛰고 다음으로 진행합니다.")
      markComplete(url)
    }
    round++
  }
}

main().catch((err) => {
  console.error("❌ 오류:", err.message || err)
  process.exit(1)
})
