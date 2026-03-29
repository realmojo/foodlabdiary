#!/usr/bin/env node

/**
 * JSON 데이터 → Google Labs Flow 이미지 생성 → S3 업로드 → Supabase 포스트 생성
 *
 * 사용법:
 *   node scripts/create-post-from-json.mjs <json파일> [카테고리slug]
 *
 * 예시:
 *   node scripts/create-post-from-json.mjs input.json health
 *
 * 환경변수 필요:
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve, join } from "path"
import { readFileSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, "..", ".env.local") })

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import sharp from "sharp"
import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"

const stealth = StealthPlugin()
chromium.use(stealth)

// ─── Config ───────────────────────────────────────────
const S3_BUCKET = "foodlabdiary"
const S3_REGION = process.env.AWS_REGION || "ap-northeast-2"
const LABS_URL =
  "https://labs.google/fx/ko/tools/flow/project/2bd14e8f-06b8-4839-8492-9df6f09cab0a"
const AUTH_FILE = join(process.cwd(), "scripts", "gemini-auth.json")

const s3 = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ─── Helpers ──────────────────────────────────────────

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`)
}

function convertInlineMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
}

// ─── Google Labs Flow 브라우저 세션 ──────────────────

async function launchBrowser() {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  })

  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: null,
  })

  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })
  })

  log("🌐", `Google Labs Flow 열기: ${LABS_URL}`)
  await page.goto(LABS_URL, { waitUntil: "domcontentloaded" })

  // 쿠키 동의 배너가 있으면 클릭
  const cookieAccept = page.locator(
    "button.glue-cookie-notification-bar__accept"
  )
  try {
    await cookieAccept.waitFor({ state: "visible", timeout: 3000 })
    await cookieAccept.click()
    log("🍪", "쿠키 동의 클릭")
  } catch {
    // 배너 없으면 무시
  }

  // "Nano Banana" 드롭다운 → "x1" 탭 선택
  const nanoBananaBtn = page.locator('button:has-text("Nano Banana")')
  await nanoBananaBtn.waitFor({ state: "visible", timeout: 15000 })
  await nanoBananaBtn.click()
  await page.waitForTimeout(1000)

  const x1Tab = page.locator('button[role="tab"]:has-text("x1")')
  await x1Tab.waitFor({ state: "visible", timeout: 5000 })
  await x1Tab.click()
  await page.waitForTimeout(500)

  // 모달 닫기
  await page.locator("body").click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(500)

  return { browser, context, page }
}

// ─── Google Labs Flow 이미지 생성 ────────────────────

async function generateImage(page, prompt) {
  log("🎨", `이미지 생성 중: ${prompt.slice(0, 60)}...`)

  // 기존 이미지 src 목록 기록
  const allImages = page.locator('img[alt="생성된 이미지"]')
  const existingSrcs = new Set()
  const existingCount = await allImages.count()
  for (let i = 0; i < existingCount; i++) {
    const src = await allImages.nth(i).getAttribute("src")
    existingSrcs.add(src)
  }

  // 프롬프트 입력 & 전송
  const editor = page.locator('[data-slate-editor="true"]')
  await editor.waitFor({ state: "visible", timeout: 15000 })
  await editor.click()
  await page.keyboard.type(prompt, { delay: 10 })
  await page.keyboard.press("Enter")

  // 새 이미지가 나올 때까지 폴링 (최대 2분)
  const timeout = 120000
  const start = Date.now()
  let newImgSrc = null
  while (!newImgSrc) {
    if (Date.now() - start > timeout)
      throw new Error("Image generation timed out")
    await page.waitForTimeout(3000)
    const currentCount = await allImages.count()
    log("⏳", `대기 중... 이미지: ${currentCount}`)
    for (let i = 0; i < currentCount; i++) {
      const src = await allImages.nth(i).getAttribute("src")
      if (!existingSrcs.has(src)) {
        newImgSrc = src
        break
      }
    }
  }
  await page.waitForTimeout(2000)

  // 이미지 다운로드
  const imageUrl = newImgSrc.startsWith("http")
    ? newImgSrc
    : `https://labs.google${newImgSrc}`
  const response = await page.request.get(imageUrl)
  const rawBuffer = Buffer.from(await response.body())

  // webp 변환
  const webpBuffer = await sharp(rawBuffer).webp({ quality: 85 }).toBuffer()
  log("✅", `이미지 생성 완료 (${(webpBuffer.length / 1024).toFixed(0)}KB)`)

  // 생성된 이미지를 Ctrl+Click → 드롭다운에서 삭제
  const targetImg = page.locator(`img[src="${newImgSrc}"]`).first()
  await targetImg.waitFor({ state: "visible", timeout: 5000 })
  await targetImg.click({ modifiers: ["Control"] })
  log("🗑️", "이미지 삭제 중...")
  await page.waitForTimeout(1000)

  const deleteBtn = page.getByRole("menuitem", {
    name: /삭제|delete|제거|Remove/i,
  })
  try {
    await deleteBtn.waitFor({ state: "visible", timeout: 5000 })
    await deleteBtn.click()
  } catch {
    const altDeleteBtn = page.locator(
      'button:has-text("삭제"), [role="menuitem"]:has-text("삭제"), button:has-text("Delete")'
    )
    await altDeleteBtn.first().waitFor({ state: "visible", timeout: 5000 })
    await altDeleteBtn.first().click()
  }
  await page.waitForTimeout(1000)
  log("🗑️", "이미지 삭제 완료")

  return webpBuffer
}

// ─── S3 업로드 ────────────────────────────────────────

async function uploadToS3(buffer, alt, caption) {
  const now = new Date()
  const prefix = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`

  const filename = `${randomUUID().slice(0, 8)}.webp`
  const key = `${prefix}/${filename}`

  log(
    "☁️",
    `S3 업로드: s3://${S3_BUCKET}/${key} (${(buffer.length / 1024).toFixed(0)}KB)`
  )

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "image/webp",
    })
  )

  return {
    url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
    alt: alt || "",
    caption: caption || "",
  }
}

// ─── JSON → ContentBlock 변환 ─────────────────────────

function jsonToBlocks(contents, s3Images) {
  const blocks = []
  let imageIndex = 0

  for (let i = 0; i < contents.length; i++) {
    const item = contents[i]

    // 소제목 (첫 번째 항목은 도입부이므로 소제목 없음)
    if (item.title) {
      blocks.push({
        type: "heading",
        level: 2,
        text: convertInlineMarkdown(item.title),
      })
    }

    // 이미지 블록 삽입
    if (imageIndex < s3Images.length) {
      blocks.push({
        type: "image",
        url: s3Images[imageIndex].url,
        alt: s3Images[imageIndex].alt,
        caption: s3Images[imageIndex].caption,
      })
      imageIndex++
    }

    // 본문 텍스트
    if (item.text) {
      blocks.push({
        type: "paragraph",
        text: convertInlineMarkdown(item.text),
      })
    }
  }

  return blocks
}

// ─── Supabase 포스트 삽입 ─────────────────────────────

function generateSlug(title) {
  // 간단한 slug 생성: 한글 제목 → 랜덤 UUID 기반
  return `post-${randomUUID().slice(0, 8)}`
}

async function insertPost(title, blocks, s3Images, categorySlug) {
  // 작성자
  let { data: author } = await supabase
    .from("foodlabdiary_authors")
    .select("id")
    .eq("slug", "park-sooa")
    .single()

  if (!author) {
    const { data } = await supabase
      .from("foodlabdiary_authors")
      .insert({ name: "박수아", slug: "park-sooa", bio: "foodlabdiary 에디터" })
      .select("id")
      .single()
    author = data
  }

  // 카테고리
  let { data: category } = await supabase
    .from("foodlabdiary_categories")
    .select("id, slug")
    .eq("slug", categorySlug || "health")
    .single()

  if (!category) {
    const { data } = await supabase
      .from("foodlabdiary_categories")
      .select("id, slug")
      .order("sort_order")
      .limit(1)
      .single()
    category = data
  }

  const slug = generateSlug(title)
  const featuredImage = s3Images.length > 0 ? s3Images[0].url : null

  // 읽기 시간
  const totalChars = blocks
    .filter((b) => b.text)
    .reduce((sum, b) => sum + b.text.length, 0)
  const readTime = `${Math.max(1, Math.round(totalChars / 500))}분`

  const { data: post, error } = await supabase
    .from("foodlabdiary_posts")
    .insert({
      title,
      slug,

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
    if (error.code === "23505") {
      const retrySlug = `${slug}-${randomUUID().slice(0, 4)}`
      const { data: post2, error: err2 } = await supabase
        .from("foodlabdiary_posts")
        .insert({
          title,
          slug: retrySlug,

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
      await supabase
        .from("foodlabdiary_post_categories")
        .insert({ post_id: post2.id, category_id: category.id })
      return post2
    }
    throw error
  }

  await supabase
    .from("foodlabdiary_post_categories")
    .insert({ post_id: post.id, category_id: category.id })

  return post
}

// ─── Main ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.log(
      "사용법: node scripts/create-post-from-json.mjs <json파일> [카테고리slug]"
    )
    console.log(
      "예시:   node scripts/create-post-from-json.mjs input.json health"
    )
    process.exit(1)
  }

  const jsonPath = resolve(process.cwd(), args[0])
  const categorySlug = args[1] || "health"

  log("📄", `JSON 파일 로드: ${jsonPath}`)
  const jsonData = JSON.parse(readFileSync(jsonPath, "utf-8"))
  const { title, contents } = jsonData

  log("📝", `제목: ${title}`)
  log("📊", `섹션 수: ${contents.length}`)

  // 1) 이미지 프롬프트 수집
  const imagePrompts = contents
    .map((item, i) => ({
      prompt: item.imagesPrompt || item.imagePrompt,
      alt: item.title || title,
      caption: item.title || "",
      index: i,
    }))
    .filter((p) => p.prompt)

  log("🎨", `이미지 ${imagePrompts.length}장 생성 시작 (Google Labs Flow)`)

  // 2) 브라우저 실행 & 이미지 생성 + S3 업로드
  const { browser, context, page } = await launchBrowser()
  const s3Images = []
  for (const { prompt, alt, caption } of imagePrompts) {
    try {
      const buffer = await generateImage(page, prompt)
      const s3Image = await uploadToS3(buffer, alt, caption)
      s3Images.push(s3Image)
    } catch (err) {
      log("⚠️", `이미지 생성 실패: ${err.message}`)
    }
  }
  await context.close()
  await browser.close()

  log("✅", `이미지 ${s3Images.length}/${imagePrompts.length}장 업로드 완료`)

  // 3) ContentBlock 생성
  const blocks = jsonToBlocks(contents, s3Images)

  // 4) Supabase 포스트 삽입
  log("💾", "Supabase에 포스트 저장 중...")
  const post = await insertPost(title, blocks, s3Images, categorySlug)

  log("🎉", `포스트 생성 완료!`)
  log("🔗", `slug: ${post.slug}`)
  log("🆔", `id: ${post.id}`)
}

main().catch((err) => {
  console.error("❌ 오류:", err)
  process.exit(1)
})
