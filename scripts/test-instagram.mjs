#!/usr/bin/env node

/**
 * Instagram 캐러셀 게시 테스트
 * 사용법: node scripts/test-instagram.mjs
 *
 * 1) card-news/why-dogs-wag-their-tails/ 의 이미지를 S3에 업로드
 * 2) Instagram Graph API로 캐러셀 게시
 */

import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { readFileSync, readdirSync } from "fs"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "crypto"
import https from "https"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "..", ".env.local") })

const S3_BUCKET = "petpawpaw"
const S3_REGION = process.env.AWS_REGION || "ap-northeast-2"
const IG_API = "https://graph.instagram.com/v22.0"

const s3 = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

// ─── API 유틸 ──────────────────────────────────────────

function igGet(endpoint) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const url = `${IG_API}${endpoint}${endpoint.includes("?") ? "&" : "?"}access_token=${token}`

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
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
      .on("error", reject)
  })
}

function igPost(endpoint, params = {}) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const url = new URL(`${IG_API}${endpoint}`)
  url.searchParams.set("access_token", token)
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── 메인 ──────────────────────────────────────────────

async function main() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) {
    console.error("❌ INSTAGRAM_ACCESS_TOKEN이 .env.local에 설정되지 않았습니다")
    process.exit(1)
  }

  // 1) 계정 정보 확인
  console.log("📸 Instagram 계정 확인 중...")
  const me = await igGet("/me?fields=id,username")
  console.log(`  ✅ 계정: @${me.username} (ID: ${me.id})`)

  // 2) 카드뉴스 이미지 읽기
  const cardDir = resolve(__dirname, "..", "card-news", "why-dogs-wag-their-tails")
  const files = readdirSync(cardDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()

  if (files.length === 0) {
    console.error("❌ 카드뉴스 이미지가 없습니다. 먼저 node scripts/test-card-news.mjs 를 실행하세요")
    process.exit(1)
  }

  console.log(`\n📁 카드뉴스 ${files.length}장 발견:`)
  files.forEach((f) => console.log(`  - ${f}`))

  // 3) S3에 업로드 (Instagram API는 공개 URL 필요)
  console.log("\n☁️ S3 업로드 중...")
  const prefix = `card-news/test/${randomUUID().slice(0, 8)}`
  const imageUrls = []

  for (const file of files) {
    const buffer = readFileSync(resolve(cardDir, file))
    const key = `${prefix}/${file}`

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
      })
    )

    const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
    imageUrls.push(url)
    console.log(`  ✅ ${file} → ${url}`)
  }

  // 4) Instagram 캐러셀 아이템 등록
  console.log("\n📤 Instagram 캐러셀 아이템 등록 중...")
  const itemIds = []

  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`  📤 카드 ${i + 1}/${imageUrls.length} 등록 중...`)
    const result = await igPost(`/${me.id}/media`, {
      image_url: imageUrls[i],
      is_carousel_item: "true",
    })
    itemIds.push(result.id)
    console.log(`  ✅ container_id: ${result.id}`)
    await sleep(1000)
  }

  // 5) 캐러셀 컨테이너 생성
  console.log("\n📸 캐러셀 컨테이너 생성 중...")
  const caption = `강아지가 꼬리를 흔드는 진짜 이유 5가지 🐾\n\n더 많은 반려동물 이야기 → petpawpaw.net\n\n#반려동물 #강아지 #고양이 #펫 #반려견 #petpawpaw`

  const carousel = await igPost(`/${me.id}/media`, {
    media_type: "CAROUSEL",
    children: itemIds.join(","),
    caption,
  })
  console.log(`  ✅ carousel_id: ${carousel.id}`)

  // 6) 게시
  console.log("\n⏳ 미디어 처리 대기 (5초)...")
  await sleep(5000)

  console.log("🚀 게시 중...")
  const published = await igPost(`/${me.id}/media_publish`, {
    creation_id: carousel.id,
  })
  console.log(`\n✅ Instagram 게시 완료!`)
  console.log(`  media_id: ${published.id}`)
  console.log(`  프로필: https://www.instagram.com/${me.username}/`)
}

main().catch((err) => {
  console.error(`\n❌ 오류: ${err.message}`)
  process.exit(1)
})
