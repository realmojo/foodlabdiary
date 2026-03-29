#!/usr/bin/env node

/**
 * JSON 데이터 → Replicate 이미지 생성 → S3 업로드 → Supabase 포스트 생성
 *
 * 사용법:
 *   node scripts/create-post-from-json.mjs <json파일> [카테고리slug]
 *
 * 예시:
 *   node scripts/create-post-from-json.mjs input.json health
 *
 * 환경변수 필요:
 *   REPLICATE_API_TOKEN  — Replicate API 토큰
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { readFileSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, "..", ".env.local") })

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import sharp from "sharp"
import Replicate from "replicate"

// ─── Config ───────────────────────────────────────────
const S3_BUCKET = "foodlabdiary"
const S3_REGION = process.env.AWS_REGION || "ap-northeast-2"

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

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

function convertInlineMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
}

// ─── Replicate 이미지 생성 ────────────────────────────

async function generateImage(prompt, maxRetries = 5) {
  log("🎨", `이미지 생성 중: ${prompt.slice(0, 60)}...`)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const output = await replicate.run("black-forest-labs/flux-schnell", {
        input: {
          prompt,
          num_outputs: 1,
          aspect_ratio: "16:9",
          output_format: "webp",
          output_quality: 80,
        },
      })

      const imageUrl = output[0]?.url?.() || output[0]
      const response = await fetch(imageUrl)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      log("✅", `이미지 생성 완료 (${(buffer.length / 1024).toFixed(0)}KB)`)
      return buffer
    } catch (err) {
      if (err.message?.includes("429") && attempt < maxRetries) {
        const wait = attempt * 3
        log("⏳", `Rate limit — ${wait}초 대기 후 재시도 (${attempt}/${maxRetries})`)
        await new Promise((r) => setTimeout(r, wait * 1000))
      } else {
        throw err
      }
    }
  }
}

// ─── S3 업로드 ────────────────────────────────────────

async function uploadToS3(buffer, alt, caption) {
  const now = new Date()
  const prefix = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`

  const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer()

  const filename = `${randomUUID().slice(0, 8)}.webp`
  const key = `${prefix}/${filename}`

  log("☁️", `S3 업로드: s3://${S3_BUCKET}/${key} (${(webpBuffer.length / 1024).toFixed(0)}KB)`)

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: webpBuffer,
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
    if (item.miniTitle) {
      blocks.push({
        type: "heading",
        level: 2,
        text: convertInlineMarkdown(item.miniTitle),
      })
    }

    // 본문 텍스트
    if (item.text) {
      blocks.push({
        type: "paragraph",
        text: convertInlineMarkdown(item.text),
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
    console.log("사용법: node scripts/create-post-from-json.mjs <json파일> [카테고리slug]")
    console.log("예시:   node scripts/create-post-from-json.mjs input.json health")
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
  const imagePrompts = contents.map((item, i) => ({
    prompt: item.imagesPrompt || item.imagePrompt,
    alt: item.miniTitle || title,
    caption: item.miniTitle || "",
    index: i,
  })).filter((p) => p.prompt)

  log("🎨", `이미지 ${imagePrompts.length}장 생성 시작 (Replicate Flux Schnell)`)

  // 2) 이미지 생성 + S3 업로드
  const s3Images = []
  for (const { prompt, alt, caption } of imagePrompts) {
    try {
      const buffer = await generateImage(prompt)
      const s3Image = await uploadToS3(buffer, alt, caption)
      s3Images.push(s3Image)
    } catch (err) {
      log("⚠️", `이미지 생성 실패: ${err.message}`)
    }
  }

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
