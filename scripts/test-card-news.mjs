#!/usr/bin/env node

/**
 * 카드뉴스 생성 테스트
 * 사용법: node scripts/test-card-news.mjs
 */

import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { writeFileSync, mkdirSync } from "fs"
import sharp from "sharp"
import https from "https"

const __dirname = dirname(fileURLToPath(import.meta.url))

const sampleTitle = "강아지가 꼬리를 흔드는 진짜 이유 5가지"
const sampleSlug = "why-dogs-wag-their-tails"
const samplePoints = [
  "꼬리 흔들기는 단순한 기쁨의 표현이 아니다",
  "오른쪽으로 흔들면 긍정, 왼쪽이면 불안 신호",
  "꼬리 높이에 따라 자신감 수준이 달라진다",
  "빠르게 흔들수록 감정의 강도가 높다는 뜻",
  "꼬리를 다리 사이에 넣으면 공포를 느끼는 중",
  "강아지는 사람에게만 꼬리를 흔드는 경우가 많다",
  "꼬리 언어를 이해하면 반려견과 더 깊이 소통 가능",
]

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return fetchBuffer(res.headers.location).then(resolve).catch(reject)
        }
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks)))
        res.on("error", reject)
      })
      .on("error", reject)
  })
}

function wrapText(text, maxCharsPerLine) {
  const lines = []
  let line = ""
  for (const char of text) {
    if (line.length >= maxCharsPerLine) {
      lines.push(line)
      line = ""
    }
    line += char
  }
  if (line) lines.push(line)
  return lines
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
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
        `<text x="540" y="${textY + i * lineHeight}" text-anchor="middle" fill="white" font-family="'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" font-size="${fontSize}" font-weight="${isTitle ? "800" : "600"}">${escapeXml(line)}</text>`
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

async function generateCard(bgBuffer, svgStr) {
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

async function main() {
  const outputDir = resolve(__dirname, "..", "card-news", sampleSlug)
  mkdirSync(outputDir, { recursive: true })

  const totalCards = samplePoints.length + 2

  // 배경 이미지 다운로드
  console.log("📸 배경 이미지 다운로드 중...")
  const bgUrl =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/YellowLabradorLooking_new.jpg/1200px-YellowLabradorLooking_new.jpg"
  let bgImage = null
  try {
    bgImage = await fetchBuffer(bgUrl)
    console.log(`  ✅ 다운로드 완료 (${(bgImage.length / 1024).toFixed(0)}KB)`)
  } catch (err) {
    console.log(`  ⚠️ 실패: ${err.message}`)
  }

  // 카드 1: 표지
  const titleSvg = buildCardSvg(wrapText(sampleTitle, 12), {
    fontSize: 64,
    lineHeight: 90,
    isTitle: true,
    pageNum: "1",
    totalPages: String(totalCards),
  })
  const cover = await generateCard(bgImage, titleSvg)
  writeFileSync(resolve(outputDir, "01-cover.jpg"), cover)
  console.log(`🎨 카드 1/${totalCards}: 표지`)

  // 카드 2~N: 포인트별
  for (let i = 0; i < samplePoints.length; i++) {
    const svg = buildCardSvg(wrapText(samplePoints[i], 13), {
      fontSize: 56,
      lineHeight: 80,
      pageNum: String(i + 2),
      totalPages: String(totalCards),
    })
    const card = await generateCard(bgImage, svg)
    const num = String(i + 2).padStart(2, "0")
    writeFileSync(resolve(outputDir, `${num}-point.jpg`), card)
    console.log(`🎨 카드 ${i + 2}/${totalCards}: ${samplePoints[i]}`)
  }

  // 마지막 카드: CTA
  const endSvg = buildCardSvg(["더 많은 반려동물 이야기", "petpawpaw.net"], {
    fontSize: 52,
    lineHeight: 78,
    isEnd: true,
  })
  const lastCard = await generateCard(bgImage, endSvg)
  writeFileSync(
    resolve(outputDir, `${String(totalCards).padStart(2, "0")}-end.jpg`),
    lastCard
  )
  console.log(`🎨 카드 ${totalCards}/${totalCards}: 마무리`)

  console.log(
    `\n✅ 카드뉴스 ${totalCards}장 생성 완료 → card-news/${sampleSlug}/`
  )
}

main().catch(console.error)
