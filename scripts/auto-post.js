#!/usr/bin/env node

/**
 * 다음 뉴스 URL → 콘텐츠 재창작 → 이미지 생성 → S3 업로드 → Supabase 포스팅 (올인원)
 *
 * 사용법:
 *   node scripts/auto-post.js <다음뉴스URL> [카테고리slug]
 *
 * 예시:
 *   node scripts/auto-post.js https://v.daum.net/v/x6A9s5kLIH health
 */

import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve, join } from "path"
import { readFileSync, writeFileSync } from "fs"
import { load } from "cheerio"
import { Ollama } from "ollama"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import sharp from "sharp"
import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, "..", ".env.local") })

const stealth = StealthPlugin()
chromium.use(stealth)

// ─── Config ───────────────────────────────────────────
const MIN_SECTIONS = 6
const MAX_RETRY = 2
const S3_BUCKET = "foodlabdiary"
const S3_REGION = process.env.AWS_REGION || "ap-northeast-2"
const LABS_URL =
  "https://labs.google/fx/ko/tools/flow/project/2bd14e8f-06b8-4839-8492-9df6f09cab0a"
const AUTH_FILE = join(process.cwd(), "scripts", "gemini-auth.json")

const ollama = new Ollama()
const s3 = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ─── Helpers ──────────────────────────────────────────

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`)
}

function randomDate() {
  const start = new Date("2026-01-01T00:00:00Z").getTime()
  const end = Date.now()
  return new Date(start + Math.random() * (end - start))
}

function convertInlineMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
}

function containsForeignLang(text) {
  const cjk = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []
  const jp = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []
  return cjk.length > 3 || jp.length > 3
}

async function generateKorean(prompt, opts = {}) {
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    const response = await ollama.generate({
      model: "qwen2.5",
      prompt: attempt === 0 ? prompt : `${prompt}\n\n중요: 반드시 한국어로만 작성해주세요. 중국어, 일본어, 영어를 절대 섞지 마세요.`,
      options: { temperature: opts.temperature || 0.7 },
      ...(opts.format ? { format: opts.format } : {}),
    })
    const result = response.response.trim()
    if (!containsForeignLang(result)) return result
    log("⚠️", `외국어 감지, 재시도 (${attempt + 1}/${MAX_RETRY})...`)
  }
  return null
}

// ═══════════════════════════════════════════════════════
// STEP 1: 다음 뉴스 파싱
// ═══════════════════════════════════════════════════════

async function fetchDaumNews(newsUrl) {
  log("📰", `뉴스 가져오기: ${newsUrl}`)
  const res = await fetch(newsUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  })
  const html = await res.text()
  const $ = load(html)

  const title = $("h2.tit_head").text().trim()
  if (!title) throw new Error("제목을 찾을 수 없습니다.")
  log("📝", `원본 제목: ${title}`)

  const section = $("#articleBody section").first()
  const elements = section.children().toArray()

  const contents = []
  let current = null

  for (const el of elements) {
    const $el = $(el)
    const tag = el.tagName?.toLowerCase()

    if (tag === "h3") {
      const text = $el.text().trim()
      if (text.includes("채널도감") || text.includes("건강정보")) break
      if (current) contents.push(current)
      current = { title: text, text: "" }
      continue
    }

    if (tag === "p" && $el.hasClass("align_l")) {
      const text = $el.text().trim()
      if (!text) continue
      if (!current) {
        current = { text }
        contents.push(current)
        current = null
      } else {
        current.text = current.text ? current.text + " " + text : text
      }
      continue
    }
  }
  if (current && current.text) contents.push(current)

  log("📊", `추출된 섹션: ${contents.length}개`)
  return { title, contents }
}

// ═══════════════════════════════════════════════════════
// STEP 2: Ollama로 콘텐츠 보강 & 재창작
// ═══════════════════════════════════════════════════════

async function enrichContents(title, contents) {
  // 2-1. 섹션 부족하면 추가 생성
  if (contents.length < MIN_SECTIONS) {
    const need = MIN_SECTIONS - contents.length
    log("🔧", `섹션 ${need}개 부족 → Ollama로 추가 생성`)

    for (let n = 0; n < need; n++) {
      const existingTitles = contents.filter((c) => c.title).map((c) => c.title).join(", ")
      const prompt = `당신은 건강/음식 블로그 작가입니다.
아래 기사 제목과 기존 소제목들을 참고하여, 같은 주제로 새로운 섹션 1개를 JSON으로 생성해주세요.

기사 제목: ${title}
기존 소제목: ${existingTitles || "없음"}

규칙:
- 기존 소제목과 겹치지 않는 새로운 소제목
- text는 200~300자 한국어
- 반드시 아래 JSON 형식만 출력

{ "title": "소제목", "text": "본문" }`

      const raw = await generateKorean(prompt, { format: "json" })
      if (!raw) { log("❌", `섹션 추가 실패 [${n + 1}/${need}]`); continue }
      try {
        const parsed = JSON.parse(raw)
        const item = parsed.title ? parsed : Object.values(parsed)[0]
        if (item?.title && item?.text) {
          contents.push({ title: item.title, text: item.text })
          log("➕", `섹션 추가 [${n + 1}/${need}]: ${item.title}`)
        }
      } catch { log("❌", `파싱 실패 [${n + 1}/${need}]`) }
    }
  }

  // 2-2. 제목 클릭베이트 재창작
  log("✏️", "제목 재창작 중...")
  const titlePrompt = `아래 제목을 클릭베이트 스타일로 다시 써주세요.

원본: ${title}

반드시 아래 10개 중 하나의 패턴을 골라서, 빈칸만 채워 완성하세요:

1. "OOO는 만년 2등입니다.." OOO에 먹으면 OOO 1등 음식
2. "OOO도 OOO도 아닙니다.." OOO 녹이는 진짜 1등 식품
3. OOO, OOO 제치고 1위.. 매일 먹으면 OOO 음식
4. "의사들도 매일 먹습니다.." OOO 무섭다면 꼭 드세요
5. 마트에서 단돈 OOO원인데.. OOO 기적의 식품
6. "OOO 절대 그냥 드시지 마세요.." OOO 때 먹어야 효과 2배
7. OOO 넣고 끓이기만 하면.. OOO 싹 사라지는 기적의 차
8. "OOO인 줄 알았는데.." 알고 보니 OOO 최고의 음식
9. 하루 OOO만 먹었을 뿐인데.. OOO 수치가 뚝 떨어졌습니다
10. "OOO 버리지 마세요.." 사실 OOO에 최고인 보약입니다

규칙:
- 완성된 제목 1개만 출력 (설명, 번호 없이)
- 30~55자
- OOO에 원본 주제에 맞는 단어를 넣으세요
- 제목만 출력하고 끝내세요. 뒤에 설명이나 부연을 붙이지 마세요`

  let finalTitle = title
  for (let attempt = 0; attempt < 3; attempt++) {
    const titleRaw = await generateKorean(titlePrompt, { temperature: 0.7 })
    const candidate = (titleRaw || "").replace(/^["']|["']$/g, "").replace(/^\d+\.\s*/, "").trim()

    // 한글/숫자/공백/기본부호만 허용
    const hasInvalidChars = /[^\uAC00-\uD7AF\u3131-\u3163\u1100-\u11FF0-9a-zA-Z\s.,!?""''·…\-()%]/.test(candidate)
    // 반말/줄임말/부자연스러운 어미 체크
    const hasSlang = /(댐|됨|임|ㅋ|ㅎ|ㅠ|드셈|요함|야됨|야댐|었음)\s*\.{0,3}\s*$/.test(candidate)

    if (candidate.length > 10 && candidate.length < 80 && !hasInvalidChars && !hasSlang) {
      // 불필요한 꼬리 문구 제거 ("~를 알려줄게요", "~을 소개합니다" 등)
      finalTitle = candidate
        .replace(/[을를이가의에서] *(알려[드줄].*|소개[해하].*|공개[해하].*|확인[해하].*|말씀[드해].*)\s*\.?\s*$/, "")
        .replace(/\s*\.\s*$/, "")
        .trim()
      break
    }
    log("⚠️", `제목 재시도 [${attempt + 1}/3]: ${hasInvalidChars ? "특수문자" : hasSlang ? "반말/줄임말" : "길이"}`)
  }
  log("📝", `최종 제목: ${finalTitle}`)

  // 2-3. 각 섹션 텍스트 재창작
  log("✏️", "텍스트 재창작 중...")
  for (let i = 0; i < contents.length; i++) {
    const item = contents[i]
    const isIntro = i === 0
    const subject = item.title || title

    const rewritePrompt = isIntro
      ? `당신은 건강/음식 블로그 작가입니다.
아래 기사 제목에 대한 도입부를 새롭게 작성해주세요.

기사 제목: ${title}
참고 원문: ${item.text}

규칙:
- 원문의 핵심 주제와 키워드만 참고하되, 문장 구조와 표현은 완전히 새롭게 작성
- 200~300자 한국어
- 독자의 호기심을 자극하는 도입부
- 본문 텍스트만 출력 (따옴표, 설명 없이)`
      : `당신은 건강/음식 블로그 작가입니다.
아래 소제목에 대한 본문을 새롭게 작성해주세요.

기사 제목: ${title}
소제목: ${item.title}
참고 원문: ${item.text}

규칙:
- 원문의 핵심 주제와 키워드만 참고하되, 문장 구조와 표현은 완전히 새롭게 작성
- 200~300자 한국어
- 전문적이면서도 읽기 쉬운 톤
- 본문 텍스트만 출력 (따옴표, 설명 없이)`

    const newText = await generateKorean(rewritePrompt)
    if (newText && newText.length > 50) {
      contents[i].text = newText
      log("✅", `[${i + 1}/${contents.length}] ${subject} (${newText.length}자)`)
    } else {
      log("⚠️", `[${i + 1}/${contents.length}] ${subject} → 원문 유지`)
    }
  }

  // 2-4. imagePrompt 영어로 생성
  log("🖼️", "imagePrompt 생성 중...")
  for (let i = 0; i < contents.length; i++) {
    const subject = contents[i].title || title
    const promptReq = `You are a prompt engineer for AI image generation.
Generate a single English image prompt for the following Korean topic.
The image should be a realistic, high-quality food/health photograph.
Output ONLY the prompt text, nothing else.

Topic: ${subject}`

    const imgRes = await ollama.generate({
      model: "qwen2.5",
      prompt: promptReq,
      options: { temperature: 0.7 },
    })
    const imagePrompt = imgRes.response.trim().replace(/^["']|["']$/g, "")

    if (i === 0) {
      contents[i].imagesPrompt = imagePrompt
    } else {
      contents[i].imagePrompt = imagePrompt
    }
    log("🖼️", `[${i + 1}/${contents.length}] ${imagePrompt.slice(0, 60)}...`)
  }

  // 2-5. 카테고리 판단 (health / diet)
  log("🏷️", "카테고리 판단 중...")
  const categoryPrompt = `아래 기사 제목을 보고 카테고리를 판단해주세요.

제목: ${finalTitle}

카테고리:
- health: 건강, 영양, 질병 예방, 효능, 식품 성분, 의학 정보
- diet: 다이어트, 체중 감량, 식단 관리, 체형 관리, 칼로리

규칙:
- health 또는 diet 중 하나만 출력
- 다른 텍스트 없이 카테고리명만 출력`

  const catRes = await ollama.generate({
    model: "qwen2.5",
    prompt: categoryPrompt,
    options: { temperature: 0.1 },
  })
  const detectedCategory = catRes.response.trim().toLowerCase()
  const categorySlug = detectedCategory === "diet" ? "diet" : "health"
  log("🏷️", `카테고리: ${categorySlug}`)

  return { title: finalTitle, contents, categorySlug }
}

// ═══════════════════════════════════════════════════════
// STEP 3: Google Labs Flow 이미지 생성
// ═══════════════════════════════════════════════════════

async function launchBrowser() {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  })
  const context = await browser.newContext({ storageState: AUTH_FILE, viewport: null })
  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })
  })

  log("🌐", "Google Labs Flow 열기...")
  await page.goto(LABS_URL, { waitUntil: "domcontentloaded" })

  const cookieAccept = page.locator("button.glue-cookie-notification-bar__accept")
  try { await cookieAccept.waitFor({ state: "visible", timeout: 3000 }); await cookieAccept.click() } catch {}

  const nanoBananaBtn = page.locator('button:has-text("Nano Banana")')
  await nanoBananaBtn.waitFor({ state: "visible", timeout: 15000 })
  await nanoBananaBtn.click()
  await page.waitForTimeout(1000)

  const x1Tab = page.locator('button[role="tab"]:has-text("x1")')
  await x1Tab.waitFor({ state: "visible", timeout: 5000 })
  await x1Tab.click()
  await page.waitForTimeout(500)

  await page.locator("body").click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(500)

  return { browser, context, page }
}

async function generateImage(page, prompt) {
  log("🎨", `이미지 생성: ${prompt.slice(0, 60)}...`)

  const allImages = page.locator('img[alt="생성된 이미지"]')
  const existingSrcs = new Set()
  const existingCount = await allImages.count()
  for (let i = 0; i < existingCount; i++) {
    existingSrcs.add(await allImages.nth(i).getAttribute("src"))
  }

  const editor = page.locator('[data-slate-editor="true"]')
  await editor.waitFor({ state: "visible", timeout: 15000 })
  await editor.click()
  await page.keyboard.type(prompt, { delay: 10 })
  await page.keyboard.press("Enter")

  const timeout = 120000
  const start = Date.now()
  let newImgSrc = null
  while (!newImgSrc) {
    if (Date.now() - start > timeout) throw new Error("Image generation timed out")
    await page.waitForTimeout(3000)
    const count = await allImages.count()
    log("⏳", `대기 중... 이미지: ${count}`)
    for (let i = 0; i < count; i++) {
      const src = await allImages.nth(i).getAttribute("src")
      if (!existingSrcs.has(src)) { newImgSrc = src; break }
    }
  }
  await page.waitForTimeout(2000)

  const imageUrl = newImgSrc.startsWith("http") ? newImgSrc : `https://labs.google${newImgSrc}`
  const response = await page.request.get(imageUrl)
  const rawBuffer = Buffer.from(await response.body())
  const webpBuffer = await sharp(rawBuffer).webp({ quality: 85 }).toBuffer()
  log("✅", `이미지 완료 (${(webpBuffer.length / 1024).toFixed(0)}KB)`)

  // Ctrl+Click → 삭제
  const targetImg = page.locator(`img[src="${newImgSrc}"]`).first()
  await targetImg.waitFor({ state: "visible", timeout: 5000 })
  await targetImg.click({ modifiers: ["Control"] })
  await page.waitForTimeout(1000)

  const deleteBtn = page.getByRole("menuitem", { name: /삭제|delete|제거|Remove/i })
  try {
    await deleteBtn.waitFor({ state: "visible", timeout: 5000 })
    await deleteBtn.click()
  } catch {
    const alt = page.locator('button:has-text("삭제"), [role="menuitem"]:has-text("삭제"), button:has-text("Delete")')
    await alt.first().waitFor({ state: "visible", timeout: 5000 })
    await alt.first().click()
  }
  await page.waitForTimeout(1000)

  return webpBuffer
}

// ═══════════════════════════════════════════════════════
// STEP 4: S3 업로드
// ═══════════════════════════════════════════════════════

async function uploadToS3(buffer, alt, caption) {
  const now = new Date()
  const prefix = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`
  const filename = `${randomUUID().slice(0, 8)}.webp`
  const key = `${prefix}/${filename}`

  log("☁️", `S3: ${key} (${(buffer.length / 1024).toFixed(0)}KB)`)
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: "image/webp" }))

  return {
    url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
    alt: alt || "",
    caption: caption || "",
  }
}

// ═══════════════════════════════════════════════════════
// STEP 5: Supabase 포스팅
// ═══════════════════════════════════════════════════════

function jsonToBlocks(contents, s3Images) {
  const blocks = []
  let imageIndex = 0
  for (let i = 0; i < contents.length; i++) {
    const item = contents[i]
    if (item.title) blocks.push({ type: "heading", level: 2, text: convertInlineMarkdown(item.title) })
    if (imageIndex < s3Images.length) {
      blocks.push({ type: "image", url: s3Images[imageIndex].url, alt: s3Images[imageIndex].alt, caption: s3Images[imageIndex].caption })
      imageIndex++
    }
    if (item.text) blocks.push({ type: "paragraph", text: convertInlineMarkdown(item.text) })
  }
  return blocks
}

const AUTHOR_SLUGS = ["park-sooa", "park-inyeong", "lee-sumin", "choi-jinhee", "kim-somin"]

async function insertPost(title, blocks, s3Images, categorySlug) {
  const pickedSlug = AUTHOR_SLUGS[Math.floor(Math.random() * AUTHOR_SLUGS.length)]
  const { data: author } = await supabase.from("foodlabdiary_authors").select("id").eq("slug", pickedSlug).single()
  if (!author) throw new Error(`작성자를 찾을 수 없습니다: ${pickedSlug}`)

  let { data: category } = await supabase.from("foodlabdiary_categories").select("id, slug").eq("slug", categorySlug || "health").maybeSingle()
  if (!category) {
    const { data } = await supabase.from("foodlabdiary_categories").select("id, slug").order("sort_order").limit(1).single()
    category = data
  }
  if (!category) throw new Error(`카테고리를 찾을 수 없습니다: ${categorySlug}`)

  // 제목을 영어로 번역하여 slug 생성
  let slug = ""
  try {
    const slugRes = await ollama.generate({
      model: "qwen2.5",
      prompt: `Translate the following Korean title to a short English slug (3-6 words, lowercase, no special characters). Output ONLY the English words separated by spaces, nothing else.\n\nTitle: ${title}`,
      options: { temperature: 0.3 },
    })
    slug = slugRes.response.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)
  } catch {
    slug = `post-${randomUUID().slice(0, 8)}`
  }
  if (!slug) slug = `post-${randomUUID().slice(0, 8)}`
  const featuredImage = s3Images.length > 0 ? s3Images[0].url : null
  const totalChars = blocks.filter((b) => b.text).reduce((sum, b) => sum + b.text.length, 0)
  const readTime = `${Math.max(1, Math.round(totalChars / 500))}분`

  const postData = {
    title, slug, content: blocks, author_id: author.id,
    primary_category_id: category.id, featured_image_url: featuredImage,
    status: "published", read_time: readTime, published_at: randomDate().toISOString(),
  }

  const { data: post, error } = await supabase.from("foodlabdiary_posts").insert(postData).select("id, slug").single()
  if (error) {
    if (error.code === "23505") {
      postData.slug = `${slug}-${randomUUID().slice(0, 4)}`
      const { data: post2, error: err2 } = await supabase.from("foodlabdiary_posts").insert(postData).select("id, slug").single()
      if (err2) throw err2
      await supabase.from("foodlabdiary_post_categories").insert({ post_id: post2.id, category_id: category.id })
      return post2
    }
    throw error
  }

  await supabase.from("foodlabdiary_post_categories").insert({ post_id: post.id, category_id: category.id })
  return post
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

const URLS_FILE = join(process.cwd(), "scripts", "daum-urls.json")
const COMPLETE_FILE = join(process.cwd(), "scripts", "complete-daum-urls.json")

function pickRandomUrl() {
  const urls = JSON.parse(readFileSync(URLS_FILE, "utf-8"))
  if (urls.length === 0) {
    log("⚠️", "daum-urls.json에 남은 URL이 없습니다.")
    process.exit(0)
  }
  const index = Math.floor(Math.random() * urls.length)
  return { url: urls[index], index }
}

function markUrlComplete(url) {
  // daum-urls.json에서 제거
  const urls = JSON.parse(readFileSync(URLS_FILE, "utf-8"))
  const filtered = urls.filter((u) => u !== url)
  writeFileSync(URLS_FILE, JSON.stringify(filtered, null, 2), "utf-8")

  // complete-daum-urls.json에 추가
  let completed = []
  try { completed = JSON.parse(readFileSync(COMPLETE_FILE, "utf-8")) } catch {}
  completed.push(url)
  writeFileSync(COMPLETE_FILE, JSON.stringify(completed, null, 2), "utf-8")
}

async function main() {
  // daum-urls.json에서 랜덤 URL 선택
  const { url: newsUrl } = pickRandomUrl()
  log("🎯", `선택된 URL: ${newsUrl}`)

  // STEP 1: 뉴스 파싱
  const raw = await fetchDaumNews(newsUrl)

  // STEP 2: Ollama 재창작 + 카테고리 판단
  const { title, contents, categorySlug } = await enrichContents(raw.title, raw.contents)

  // JSON 중간 저장 (디버깅용)
  const jsonPath = resolve(process.cwd(), "input.json")
  writeFileSync(jsonPath, JSON.stringify({ title, contents }, null, 2), "utf-8")
  log("💾", `JSON 저장: ${jsonPath}`)

  // STEP 3: 이미지 생성 + S3 업로드
  const imagePrompts = contents.map((item) => ({
    prompt: item.imagesPrompt || item.imagePrompt,
    alt: item.title || title,
    caption: item.title || "",
  })).filter((p) => p.prompt)

  log("🎨", `이미지 ${imagePrompts.length}장 생성 시작 (Google Labs Flow)`)
  const { browser, context, page } = await launchBrowser()
  const s3Images = []
  for (const { prompt, alt, caption } of imagePrompts) {
    try {
      const buffer = await generateImage(page, prompt)
      const s3Image = await uploadToS3(buffer, alt, caption)
      s3Images.push(s3Image)
    } catch (err) {
      log("⚠️", `이미지 실패: ${err.message}`)
    }
  }
  await context.close()
  await browser.close()
  log("✅", `이미지 ${s3Images.length}/${imagePrompts.length}장 업로드 완료`)

  // STEP 4: Supabase 포스팅
  const blocks = jsonToBlocks(contents, s3Images)
  log("💾", "Supabase 포스트 저장 중...")
  const post = await insertPost(title, blocks, s3Images, categorySlug)

  // STEP 5: URL 완료 처리
  markUrlComplete(newsUrl)
  log("📋", `URL 완료 처리 (남은 URL: ${JSON.parse(readFileSync(URLS_FILE, "utf-8")).length}개)`)

  log("🎉", "포스트 생성 완료!")
  log("🔗", `slug: ${post.slug}`)
  log("🆔", `id: ${post.id}`)
}

main().catch((err) => {
  console.error("❌ 오류:", err)
  process.exit(1)
})
