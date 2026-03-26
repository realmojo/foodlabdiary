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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"

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

function decodeEntities(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8230;/g, "…")
    .replace(/&#039;/g, "'")
    .trim()
}

function extractArticle(html) {
  // 제목 추출: og:title → h1.entry-title → h1 → title
  const ogTitleMatch = html.match(
    /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i
  )
  const h1Match =
    html.match(
      /<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i
    ) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const titleTagMatch = html.match(/<title>([\s\S]*?)<\/title>/i)

  const title = ogTitleMatch
    ? decodeEntities(ogTitleMatch[1])
    : h1Match
      ? decodeEntities(h1Match[1])
      : titleTagMatch
        ? decodeEntities(titleTagMatch[1])
        : "제목 없음"

  // 본문 추출: entry-content → article-body → article → 전체 html
  const contentMatch =
    html.match(
      /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/|<div[^>]*class="[^"]*(?:post-tags|author-box|related|comments|share))/i
    ) ||
    html.match(
      /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ) ||
    html.match(
      /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ) ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)

  const contentHtml = contentMatch ? contentMatch[1] : html

  // 이미지 URL + alt 추출: og:image 먼저, 그 다음 본문 내 이미지
  const images = [] // [{url, alt}]
  const seenUrls = new Set()
  const ogImageMatch = html.match(
    /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i
  )
  if (ogImageMatch) {
    const ogUrl = ogImageMatch[1].replace(/&amp;/g, "&")
    images.push({ url: ogUrl, alt: title })
    seenUrls.add(ogUrl)
  }

  const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/gi
  let imgMatch
  while ((imgMatch = imgRegex.exec(contentHtml)) !== null) {
    const fullTag = imgMatch[0]
    const fullTagLower = fullTag.toLowerCase()
    const src = imgMatch[1].replace(/&amp;/g, "&")
    const srcLower = src.toLowerCase()
    // 아바타, 저자, 로고 등 불필요한 이미지 제외 (태그 전체 + src 모두 검사)
    const excluded = ["avatar", "headshot", "byline", "author", "logo", "icon"]
    if (
      excluded.some((kw) => fullTagLower.includes(kw) || srcLower.includes(kw))
    )
      continue
    if (
      (src.includes("wp-content/uploads") ||
        src.includes("assets.newsweek") ||
        src.includes("s3.") ||
        src.match(/\.(jpg|jpeg|png|webp|gif)/i)) &&
      !seenUrls.has(src)
    ) {
      // alt 텍스트 추출
      const altMatch = fullTag.match(/alt="([^"]*)"/i)
      const alt = altMatch ? decodeEntities(altMatch[1]) : ""
      images.push({ url: src, alt })
      seenUrls.add(src)
    }
  }

  // 텍스트 추출
  const paragraphs = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let pMatch
  while ((pMatch = pRegex.exec(contentHtml)) !== null) {
    const text = decodeEntities(pMatch[1])
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
2. 본문 길이: 2000~3000자 이내로 간결하게 작성 (3000자를 절대 넘기지 마세요)
3. 섹션 구성: 4~6개의 ## 소제목 섹션으로 나누기
4. 각 섹션 본문: 2~3개 문장으로 핵심만 전달
5. 문체: 정보성 매거진 톤, 존댓말(~합니다, ~해요)
6. 원문의 핵심 주제를 다루되, 모든 문장을 완전히 새로 작성
7. 구체적인 수치, 예시, 팁을 풍부하게 포함
8. 도입부: 독자의 공감을 이끄는 상황 묘사로 시작
9. "결론", "마무리", "정리" 같은 마무리 섹션은 절대 넣지 마세요. 마지막 섹션도 본문 내용처럼 구체적인 정보를 담아주세요.
10. 중간중간 리스트(- 항목)도 활용하여 가독성을 높이세요
11. 원문 출처(Newsweek, BBC, CNN 등 미디어 이름)를 절대 언급하지 마세요. 출처 홍보, 독자 참여 유도(사진 보내기 등) 문구도 넣지 마세요.

## 출력 형식 (반드시 이 형식을 정확히 따르세요)
TITLE: 새로운 제목을 여기에
BODY:
여기부터 본문 시작 (마크다운 ## 소제목 사용, 2000~3000자)

## 원문 제목
${title}

## 원문 내용 (참고용)
${originalText}

중요: 2000~3000자 이내로 간결하게 작성하세요. 3000자를 넘기지 마세요. 핵심 정보만 담아주세요.`

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

function markdownToBlocks(markdown, s3Images) {
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

  // 2단계: 이미지를 랜덤 셔플 후 균등 배치
  if (s3Images.length === 0) return blocks

  // 이미지 순서 랜덤 셔플 (Fisher-Yates)
  const shuffled = [...s3Images]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // 블록 사이에 균등 배치
  const gap = Math.max(1, Math.floor(blocks.length / (shuffled.length + 1)))
  for (let i = shuffled.length - 1; i >= 0; i--) {
    const img = shuffled[i]
    const insertAt = Math.min(gap * (i + 1), blocks.length)
    blocks.splice(insertAt, 0, {
      type: "image",
      url: img.url,
      alt: img.alt || "",
      caption: img.caption || "",
    })
  }

  return blocks
}

// ─── Step 4: 대표이미지 AI 생성 + 원본 이미지 → S3 업로드 ───────

// async function generateFeaturedImage(title) {
//   const prompt = `Create a heartwarming, adorable photo of a cute animal related to this topic: "${title}". Style: high-quality pet photography, warm natural lighting, soft bokeh background, emotional and endearing expression, magazine cover quality. The animal should be the clear focal point, looking directly at camera or in a charming pose. No text, no overlays, pure photograph.`
//   log("🎨", `대표 이미지 AI 생성 중 (제목 기반)...`)
//   const response = await ollama.generate({
//     model: "x/z-image-turbo",
//     prompt,
//     options: { temperature: 0.8, num_predict: 4096 },
//     keep_alive: "15m",
//   })
//
//   let rawBuffer = null
//   if (response.image) {
//     rawBuffer = Buffer.from(response.image, "base64")
//   } else if (response.images && response.images.length > 0) {
//     rawBuffer = Buffer.from(response.images[0], "base64")
//   }
//
//   if (!rawBuffer) {
//     log("⚠️", "대표 이미지 생성 실패")
//     return null
//   }
//
//   // 1200x628 (1.91:1) 리사이즈 + webp 변환
//   const webpBuffer = await sharp(rawBuffer)
//     .resize(1200, 628, { fit: "cover" })
//     .webp({ quality: 85 })
//     .toBuffer()
//
//   log("✅", `대표 이미지 생성 완료 (${(webpBuffer.length / 1024).toFixed(0)}KB, 1200x628)`)
//   return webpBuffer
// }

async function uploadImagesToS3(images, title) {
  const now = new Date()
  const prefix = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`
  const uploaded = [] // [{url, alt, caption}]

  // // ── 대표 이미지 AI 생성 (비활성화: 메모리 부족) ──
  // try {
  //   const featuredBuffer = await generateFeaturedImage(title)
  //   if (featuredBuffer) {
  //     const filename = `${randomUUID().slice(0, 8)}.webp`
  //     const key = `${prefix}/${filename}`
  //     log("☁️", `대표 이미지 S3 업로드: s3://${S3_BUCKET}/${key}`)
  //     await s3.send(
  //       new PutObjectCommand({
  //         Bucket: S3_BUCKET,
  //         Key: key,
  //         Body: featuredBuffer,
  //         ContentType: "image/webp",
  //       })
  //     )
  //     uploaded.push({
  //       url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
  //       alt: title,
  //       caption: title,
  //     })
  //   }
  // } catch (err) {
  //   log("⚠️", `대표 이미지 생성/업로드 실패: ${err.message}`)
  // }
  //
  // // x/z-image-turbo 언로드
  // try {
  //   await ollama.generate({ model: "x/z-image-turbo", prompt: "", keep_alive: 0 })
  // } catch {}

  // ── 원본 이미지 다운로드 → webp 변환 → S3 업로드 ──
  for (let i = 0; i < images.length; i++) {
    const { url, alt } = images[i]
    log(
      "📸",
      `원본 이미지 다운로드 중 (${i + 1}/${images.length}): ${url.slice(0, 80)}...`
    )
    try {
      const { buffer } = await fetchBuffer(url)
      log("✅", `다운로드 완료 (${(buffer.length / 1024).toFixed(0)}KB)`)

      // webp 변환
      const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer()

      const filename = `${randomUUID().slice(0, 8)}.webp`
      const key = `${prefix}/${filename}`

      log(
        "☁️",
        `S3 업로드 (${i + 1}/${images.length}): s3://${S3_BUCKET}/${key} (${(webpBuffer.length / 1024).toFixed(0)}KB webp)`
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
      uploaded.push({ url: s3Url, alt: alt || title, caption: alt || "" })
    } catch (err) {
      log("⚠️", `이미지 처리 실패: ${err.message}`)
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
  const featuredImage = s3Images.length > 0 ? s3Images[0].url : null

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

// ─── Step 7: 카드뉴스 생성 ────────────────────────────

function wrapText(text, maxCharsPerLine) {
  const words = text.split("")
  const lines = []
  let line = ""
  for (const char of words) {
    if (line.length >= maxCharsPerLine) {
      lines.push(line)
      line = ""
    }
    line += char
  }
  if (line) lines.push(line)
  return lines
}

function buildCardSvg(lines, options = {}) {
  const {
    width = 1080,
    height = 1080,
    fontSize = 48,
    lineHeight = 72,
    isTitle = false,
    isEnd = false,
    pageNum = "",
    totalPages = "",
  } = options

  const textY = height / 2 - ((lines.length - 1) * lineHeight) / 2

  const textLines = lines
    .map(
      (line, i) =>
        `<text x="540" y="${textY + i * lineHeight}" text-anchor="middle" fill="${isTitle ? "#FFD700" : "white"}" font-family="'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" font-size="${fontSize}" font-weight="${isTitle ? "800" : "600"}">${escapeXml(line)}</text>`
    )
    .join("\n    ")

  const pageIndicator =
    pageNum && !isEnd
      ? `<text x="540" y="1030" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="'Apple SD Gothic Neo', sans-serif" font-size="28">${pageNum} / ${totalPages}</text>`
      : ""

  const brandTag = isEnd
    ? `<text x="540" y="${textY + lines.length * lineHeight + 40}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="'Apple SD Gothic Neo', sans-serif" font-size="32">@petpawpaw.zip</text>`
    : ""

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.55)"/>
    ${textLines}
    ${pageIndicator}
    ${brandTag}
  </svg>`
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

async function generateCardBuffer(bgBuffer, svgStr) {
  if (bgBuffer) {
    const bg = await sharp(bgBuffer)
      .resize(1080, 1080, { fit: "cover" })
      .toBuffer()
    return sharp(bg)
      .composite([{ input: Buffer.from(svgStr), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer()
  }
  return sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 3,
      background: { r: 45, g: 55, b: 72 },
    },
  })
    .composite([{ input: Buffer.from(svgStr), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer()
}

async function generateCardNews(title, blocks, s3Images, slug) {
  // 1) gemma3로 핵심 포인트 추출
  const textContent = blocks
    .filter((b) => b.type === "paragraph" || b.type === "heading")
    .map((b) => (b.text || "").replace(/<[^>]+>/g, ""))
    .join("\n")
    .slice(0, 3000)

  const prompt = `아래 기사를 읽고, 인스타그램 카드뉴스용 스토리를 만들어주세요.

규칙:
- 기승전결 구조로 이야기를 전개하세요
  - 기(도입): 호기심을 끄는 도입부 1~2장
  - 승(전개): 핵심 정보, 원인, 배경 설명 2~3장
  - 전(심화): 구체적 사례, 수치, 놀라운 사실 1~2장
  - 결(마무리): 결론, 교훈, 실천 팁 1장
- 각 포인트는 20자 이내의 한 문장
- 전체 3~7개 (기사 내용에 따라 자연스럽게 조절)
- 앞뒤 포인트가 자연스럽게 연결되어야 합니다
- 번호를 붙여서 출력 (1. 2. 3. ...)
- 다른 설명 없이 포인트만 출력

기사 제목: ${title}

기사 본문:
${textContent}`

  log("📱", "카드뉴스 핵심 포인트 추출 중...")
  const response = await ollamaGenerate(prompt)
  const points = response
    .split("\n")
    .filter((l) => l.match(/^\d+\./))
    .map((l) => l.replace(/^\d+\.\s*/, "").trim())
    .filter((l) => l.length > 0 && l.length <= 25)
    .slice(0, 7)

  if (points.length === 0) {
    log("⚠️", "카드뉴스 포인트 추출 실패")
    return []
  }

  log("📝", `포인트 ${points.length}개 추출 완료`)

  // 2) 배경 이미지 다운로드
  const outputDir = resolve(__dirname, "..", "card-news", slug)
  mkdirSync(outputDir, { recursive: true })

  const totalCards = points.length + 2
  const bgImages = []
  for (const img of s3Images) {
    try {
      const { buffer } = await fetchBuffer(img.url)
      bgImages.push(buffer)
    } catch {}
  }
  log("🖼️", `배경 이미지 ${bgImages.length}장 다운로드 완료`)

  // 배경 이미지를 카드 수만큼 셔플 배분 (표지 + 포인트 + CTA)
  const shuffledBg = [...bgImages]
  for (let i = shuffledBg.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffledBg[i], shuffledBg[j]] = [shuffledBg[j], shuffledBg[i]]
  }
  // 카드 수에 맞춰 배경 배열 생성 (이미지 부족하면 순환)
  const bgForCards = []
  for (let i = 0; i < totalCards; i++) {
    if (shuffledBg.length > 0) {
      bgForCards.push(shuffledBg[i % shuffledBg.length])
    } else {
      bgForCards.push(null)
    }
  }

  const colors = [
    { r: 59, g: 130, b: 246 },
    { r: 16, g: 185, b: 129 },
    { r: 245, g: 158, b: 11 },
    { r: 239, g: 68, b: 68 },
    { r: 139, g: 92, b: 246 },
    { r: 236, g: 72, b: 153 },
    { r: 20, g: 184, b: 166 },
  ]

  const cardBuffers = []
  const now = new Date()
  const prefix = `card-news/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${slug}`

  // 카드 1: 표지
  const titleSvg = buildCardSvg(wrapText(title, 12), {
    fontSize: 64,
    lineHeight: 90,
    isTitle: true,
    pageNum: "1",
    totalPages: String(totalCards),
  })
  const cover = await generateCardBuffer(bgForCards[0], titleSvg)
  writeFileSync(resolve(outputDir, "01-cover.jpg"), cover)
  cardBuffers.push(cover)
  log("🎨", `카드 1/${totalCards}: 표지`)

  // 카드 2~N: 포인트별 (각각 다른 배경 이미지)
  for (let i = 0; i < points.length; i++) {
    const svg = buildCardSvg(wrapText(points[i], 13), {
      fontSize: 56,
      lineHeight: 80,
      pageNum: String(i + 2),
      totalPages: String(totalCards),
    })
    let bg = bgForCards[i + 1]
    if (!bg) {
      const c = colors[i % colors.length]
      bg = await sharp({
        create: { width: 1080, height: 1080, channels: 3, background: c },
      })
        .png()
        .toBuffer()
    }
    const card = await generateCardBuffer(bg, svg)
    const num = String(i + 2).padStart(2, "0")
    writeFileSync(resolve(outputDir, `${num}-point.jpg`), card)
    cardBuffers.push(card)
    log("🎨", `카드 ${i + 2}/${totalCards}: ${points[i].slice(0, 30)}...`)
  }

  // 마지막 카드: CTA
  const endSvg = buildCardSvg(["더 많은 반려동물 이야기", "petpawpaw.net"], {
    fontSize: 52,
    lineHeight: 78,
    isEnd: true,
  })
  const lastCard = await generateCardBuffer(
    bgForCards[totalCards - 1],
    endSvg
  )
  writeFileSync(
    resolve(outputDir, `${String(totalCards).padStart(2, "0")}-end.jpg`),
    lastCard
  )
  cardBuffers.push(lastCard)
  log("🎨", `카드 ${totalCards}/${totalCards}: 마무리`)

  // 3) S3 업로드 (Instagram API는 공개 URL 필요)
  const cardUrls = []
  for (let i = 0; i < cardBuffers.length; i++) {
    const key = `${prefix}/${String(i + 1).padStart(2, "0")}.jpg`
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: cardBuffers[i],
        ContentType: "image/jpeg",
      })
    )
    const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
    cardUrls.push(url)
  }
  log("☁️", `카드뉴스 ${cardUrls.length}장 S3 업로드 완료`)

  log("✅", `카드뉴스 생성 완료 → card-news/${slug}/`)
  return cardUrls
}

// ─── Step 8: Instagram 캐러셀 게시 ────────────────────

const IG_API = "https://graph.instagram.com/v22.0"

async function igApiCall(endpoint, params = {}) {
  const url = new URL(`${IG_API}${endpoint}`)
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!accessToken)
    throw new Error("INSTAGRAM_ACCESS_TOKEN이 설정되지 않았습니다")

  url.searchParams.set("access_token", accessToken)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "POST" }, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          const json = JSON.parse(body)
          if (json.error) reject(new Error(json.error.message))
          else resolve(json)
        } catch {
          reject(new Error(body))
        }
      })
    })
    req.on("error", reject)
    req.end()
  })
}

async function igGet(endpoint) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const url = `${IG_API}${endpoint}${endpoint.includes("?") ? "&" : "?"}access_token=${accessToken}`

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = ""
        res.on("data", (c) => (body += c))
        res.on("end", () => {
          try {
            resolve(JSON.parse(body))
          } catch {
            reject(new Error(body))
          }
        })
      })
      .on("error", reject)
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function postToInstagram(cardUrls, title, slug) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!accessToken) {
    log("⚠️", "INSTAGRAM_ACCESS_TOKEN 미설정, 인스타그램 게시 건너뜀")
    return
  }

  log("📸", "Instagram 캐러셀 게시 시작...")

  // 1) 사용자 ID 가져오기
  const me = await igGet("/me?fields=id,username")
  const userId = me.id
  log("📸", `Instagram 계정: @${me.username} (${userId})`)

  // 2) 각 카드를 캐러셀 아이템으로 등록 (최대 10장)
  const itemIds = []
  const cardsToPost = cardUrls.slice(0, 10)

  for (let i = 0; i < cardsToPost.length; i++) {
    log("📤", `카드 ${i + 1}/${cardsToPost.length} 업로드 중...`)
    const result = await igApiCall(`/${userId}/media`, {
      image_url: cardsToPost[i],
      is_carousel_item: "true",
    })
    itemIds.push(result.id)
    await sleep(1000) // API rate limit 방지
  }

  // 3) 캐러셀 컨테이너 생성
  const caption = `${title}\n\n🐾 더 많은 반려동물 이야기 → petpawpaw.net\n\n#반려동물 #강아지 #고양이 #펫 #반려견 #petpawpaw`
  const carousel = await igApiCall(`/${userId}/media`, {
    media_type: "CAROUSEL",
    children: itemIds.join(","),
    caption,
  })
  log("📸", `캐러셀 컨테이너 생성: ${carousel.id}`)

  // 4) 게시
  await sleep(3000) // 미디어 처리 대기
  const published = await igApiCall(`/${userId}/media_publish`, {
    creation_id: carousel.id,
  })
  log("✅", `Instagram 게시 완료! (media_id: ${published.id})`)
}

// ─── Step 9: Blogger 포스팅 ────────────────────────────

async function googlePost(url, body, accessToken) {
  const u = new URL(url)
  const postData = JSON.stringify(body)

  return new Promise((resolve, reject) => {
    const req = https.request(u, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = ""
      res.on("data", (c) => (data += c))
      res.on("end", () => {
        try {
          const json = JSON.parse(data)
          if (json.error) reject(new Error(json.error.message || JSON.stringify(json.error)))
          else resolve(json)
        } catch { reject(new Error(data)) }
      })
    })
    req.on("error", reject)
    req.write(postData)
    req.end()
  })
}

async function googleGet(url, accessToken) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (res) => {
      let data = ""
      res.on("data", (c) => (data += c))
      res.on("end", () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(data)) }
      })
    }).on("error", reject)
  })
}

async function getGoogleAccessToken() {
  const postData = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }).toString()

  return new Promise((resolve, reject) => {
    const req = https.request("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          const json = JSON.parse(body)
          if (json.error) reject(new Error(json.error_description || json.error))
          else resolve(json.access_token)
        } catch { reject(new Error(body)) }
      })
    })
    req.on("error", reject)
    req.write(postData)
    req.end()
  })
}

function blocksToHtml(blocks) {
  return blocks.map((block) => {
    switch (block.type) {
      case "paragraph":
        return `<p>${block.text || ""}</p>`
      case "heading":
        if (block.level === 3) return `<h3>${block.text || ""}</h3>`
        return `<h2>${block.text || ""}</h2>`
      case "image":
        return `<div style="text-align:center;margin:20px 0"><img src="${block.url}" alt="${block.alt || ""}" style="max-width:100%;border-radius:8px" />${block.caption ? `<p style="font-size:0.85em;color:#888">${block.caption}</p>` : ""}</div>`
      case "quote":
        return `<blockquote style="border-left:3px solid #ccc;padding-left:16px;color:#555;font-style:italic">${block.text || ""}</blockquote>`
      case "list":
        const tag = block.ordered ? "ol" : "ul"
        const items = (block.items || []).map((item) => `<li>${item}</li>`).join("")
        return `<${tag}>${items}</${tag}>`
      default:
        return ""
    }
  }).join("\n")
}

async function postToBlogger(title, blocks, slug) {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  if (!refreshToken) {
    log("⚠️", "GOOGLE_REFRESH_TOKEN 미설정, Blogger 게시 건너뜀")
    return
  }

  log("📝", "Blogger 게시 시작...")

  // 1) access token 발급
  const accessToken = await getGoogleAccessToken()

  // 2) Blog ID 확인 (URL 또는 숫자 ID)
  let blogId = process.env.BLOGGER_BLOG_ID
  if (blogId && !blogId.match(/^\d+$/)) {
    // URL로 blog ID 조회
    const blogUrl = blogId.startsWith("http") ? blogId : `https://${blogId}`
    const blog = await googleGet(
      `https://www.googleapis.com/blogger/v3/blogs/byurl?url=${encodeURIComponent(blogUrl)}`,
      accessToken
    )
    blogId = blog.id
    log("📝", `Blog ID: ${blogId}`)
  }

  // 3) HTML 변환 + 게시
  const html = blocksToHtml(blocks)
  const post = await googlePost(
    `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`,
    { kind: "blogger#post", title, content: html },
    accessToken
  )

  log("✅", `Blogger 게시 완료! → ${post.url}`)
}

// ─── Step 10: Facebook Page 포스팅 ───────────────────

const FB_API = "https://graph.facebook.com/v22.0"

async function postToFacebook(cardUrls, title, slug) {
  const userToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!userToken) {
    log("⚠️", "FACEBOOK_PAGE_ACCESS_TOKEN 미설정, Facebook 게시 건너뜀")
    return
  }

  log("📘", "Facebook Page 게시 시작...")

  const targetId = process.env.FACEBOOK_PAGE_ID
  let pageId, pageToken

  // 직접 페이지 토큰 요청
  if (targetId) {
    const pageData = await new Promise((resolve, reject) => {
      https.get(`${FB_API}/${targetId}?fields=id,name,access_token&access_token=${userToken}`, (res) => {
        let body = ""
        res.on("data", (c) => (body += c))
        res.on("end", () => {
          try { resolve(JSON.parse(body)) } catch { reject(new Error(body)) }
        })
      }).on("error", reject)
    })
    if (pageData.error) throw new Error(pageData.error.message)
    pageId = pageData.id
    pageToken = pageData.access_token || userToken
    log("📘", `Facebook Page: ${pageData.name} (${pageId})`)
  } else {
    // FACEBOOK_PAGE_ID 미설정 시 /me/accounts 첫 번째 사용
    const accounts = await new Promise((resolve, reject) => {
      https.get(`${FB_API}/me/accounts?fields=id,name,access_token&access_token=${userToken}`, (res) => {
        let body = ""
        res.on("data", (c) => (body += c))
        res.on("end", () => {
          try { resolve(JSON.parse(body)) } catch { reject(new Error(body)) }
        })
      }).on("error", reject)
    })
    if (!accounts.data || accounts.data.length === 0) {
      log("⚠️", "연결된 Facebook Page가 없습니다")
      return
    }
    const page = accounts.data[0]
    pageId = page.id
    pageToken = page.access_token
    log("📘", `Facebook Page: ${page.name} (${pageId})`)
  }

  // 2) 각 카드 이미지를 unpublished로 업로드
  const photoIds = []
  const cardsToPost = cardUrls.slice(0, 10)

  for (let i = 0; i < cardsToPost.length; i++) {
    log("📤", `Facebook 카드 ${i + 1}/${cardsToPost.length} 업로드 중...`)
    const url = new URL(`${FB_API}/${pageId}/photos`)
    url.searchParams.set("access_token", pageToken)
    url.searchParams.set("url", cardsToPost[i])
    url.searchParams.set("published", "false")

    const result = await new Promise((resolve, reject) => {
      const req = https.request(url, { method: "POST" }, (res) => {
        let body = ""
        res.on("data", (c) => (body += c))
        res.on("end", () => {
          try {
            const json = JSON.parse(body)
            if (json.error) reject(new Error(json.error.message))
            else resolve(json)
          } catch {
            reject(new Error(body))
          }
        })
      })
      req.on("error", reject)
      req.end()
    })

    photoIds.push(result.id)
    await sleep(500)
  }

  // 3) 멀티 이미지 게시물 생성
  const message = `${title}\n\n🐾 더 많은 반려동물 이야기 → petpawpaw.net\n\n#반려동물 #강아지 #고양이 #펫 #반려견 #petpawpaw`

  const feedUrl = new URL(`${FB_API}/${pageId}/feed`)
  feedUrl.searchParams.set("access_token", pageToken)
  feedUrl.searchParams.set("message", message)
  photoIds.forEach((id, i) => {
    feedUrl.searchParams.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }))
  })

  const published = await new Promise((resolve, reject) => {
    const req = https.request(feedUrl, { method: "POST" }, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          const json = JSON.parse(body)
          if (json.error) reject(new Error(json.error.message))
          else resolve(json)
        } catch {
          reject(new Error(body))
        }
      })
    })
    req.on("error", reject)
    req.end()
  })

  log("✅", `Facebook 게시 완료! (post_id: ${published.id})`)
}

// ─── Main ─────────────────────────────────────────────

function pickRandomUrl() {
  const sources = [
    resolve(__dirname, "sitemap-urls.json"),
    resolve(__dirname, "newsweek-urls.json"),
  ]
  const completePath = resolve(__dirname, "complete-urls.json")

  const completeUrls = existsSync(completePath)
    ? JSON.parse(readFileSync(completePath, "utf-8"))
    : []
  const completeSet = new Set(completeUrls)

  // 모든 소스 파일에서 URL 수집
  let allUrls = []
  for (const src of sources) {
    if (existsSync(src)) {
      const urls = JSON.parse(readFileSync(src, "utf-8"))
      allUrls = allUrls.concat(urls)
    }
  }

  if (allUrls.length === 0) {
    console.error(
      "❌ sitemap-urls.json 또는 newsweek-urls.json 파일이 없습니다."
    )
    process.exit(1)
  }

  // 중복 제거 + 완료된 URL 필터
  const remaining = [...new Set(allUrls)].filter((u) => !completeSet.has(u))

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

  // Step 2: 카테고리 자동 분류 (명시하지 않은 경우)
  const finalCategory =
    categorySlug || (await detectCategory(title, paragraphs))

  // Step 3: Gemma3로 재창작 (제목이 먼저 필요 → 대표 이미지 생성에 사용)
  const { newTitle, newBody } = await rewriteArticle(title, paragraphs)
  log("✅", `재창작 완료`)
  log("📄", `새 제목: ${newTitle}`)
  log("📝", `새 본문 길이: ${newBody.length}자\n`)

  // Step 4: 대표 이미지 AI 생성 + 원본 이미지 S3 업로드
  log("📤", "이미지 처리 시작...")
  const s3Images = await uploadImagesToS3(images, newTitle)
  log("✅", `이미지 업로드 완료: ${s3Images.length}개\n`)

  // Step 4.5: 이미지 alt/caption 한글화
  if (s3Images.length > 0) {
    log("🏷️", "이미지 alt/caption 한글 생성 중...")
    const altList = s3Images
      .map((img, i) => `${i + 1}. ${img.alt || "이미지"}`)
      .join("\n")
    try {
      const altPrompt = `아래 이미지 설명들을 한국어로 짧게 번역해주세요.

규칙:
- ALT: 20자 이내, 핵심만 (예: "잠자는 골든 리트리버")
- CAPTION: 20자 이내, 짧은 설명 (예: "편안하게 낮잠 중인 강아지")
- 절대 20자를 넘기지 마세요

형식 (반드시 이 형식으로):
1. ALT: 짧은설명 | CAPTION: 짧은캡션
2. ALT: 짧은설명 | CAPTION: 짧은캡션

기사 제목: ${newTitle}

이미지 설명:
${altList}`
      const altResponse = await ollamaGenerate(altPrompt)
      const altLines = altResponse.split("\n").filter((l) => l.match(/^\d+\./))
      for (const line of altLines) {
        const numMatch = line.match(/^(\d+)\./)
        if (!numMatch) continue
        const idx = parseInt(numMatch[1]) - 1
        if (idx < 0 || idx >= s3Images.length) continue
        const altMatch = line.match(/ALT:\s*(.+?)\s*\|/i)
        const capMatch = line.match(/CAPTION:\s*(.+)/i)
        if (altMatch) s3Images[idx].alt = altMatch[1].trim()
        if (capMatch) s3Images[idx].caption = capMatch[1].trim()
      }
      log("✅", "이미지 alt/caption 생성 완료")
    } catch (err) {
      log("⚠️", `alt/caption 생성 실패, 기본값 사용: ${err.message}`)
    }
  }

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

  // Step 7: 카드뉴스 생성
  console.log("")
  log("📱", "카드뉴스 생성 시작...")
  const cardUrls = await generateCardNews(newTitle, blocks, s3Images, post.slug)

  // Step 8: Instagram 캐러셀 게시
  if (cardUrls && cardUrls.length > 0) {
    console.log("")
    try {
      await postToInstagram(cardUrls, newTitle, post.slug)
    } catch (err) {
      log("⚠️", `Instagram 게시 실패: ${err.message}`)
    }
  }

  // Step 9: Blogger 게시
  console.log("")
  try {
    await postToBlogger(newTitle, blocks, post.slug)
  } catch (err) {
    log("⚠️", `Blogger 게시 실패: ${err.message}`)
  }

  // Step 10: Facebook Page 게시
  if (cardUrls && cardUrls.length > 0) {
    console.log("")
    try {
      await postToFacebook(cardUrls, newTitle, post.slug)
    } catch (err) {
      log("⚠️", `Facebook 게시 실패: ${err.message}`)
    }
  }

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

  // 랜덤 모드: 1개만 처리
  const url = pickRandomUrl()
  console.log(`\n🔄 ${url}\n`)
  await processOne(url, categorySlug)
}

main().catch((err) => {
  console.error("❌ 오류:", err.message || err)
  process.exit(1)
})
