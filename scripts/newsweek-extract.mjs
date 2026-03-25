#!/usr/bin/env node

/**
 * Newsweek 기사 URL에서 제목, 이미지, 본문 추출 테스트
 *
 * 사용법: node scripts/newsweek-extract.mjs <URL>
 * 예시:   node scripts/newsweek-extract.mjs https://www.newsweek.com/laughter-reason-golden-retriever-desperate-stay-awake-eyes-close-11689964
 */

import https from "https"
import http from "http"

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

function extractArticle(html) {
  // 제목: og:title → h1 → title
  const ogTitleMatch = html.match(
    /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i
  )
  const h1Match =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)

  const title = ogTitleMatch
    ? ogTitleMatch[1].trim()
    : h1Match
      ? h1Match[1].replace(/<[^>]+>/g, "").trim()
      : titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
        : "제목 없음"

  // 이미지: og:image + 본문 내 이미지
  const images = []
  const ogImageMatch = html.match(
    /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i
  )
  if (ogImageMatch) {
    images.push(ogImageMatch[1])
  }

  // 본문 영역 추출 (article 태그 또는 일반적인 본문 영역)
  const articleMatch =
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(
      /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ) ||
    html.match(
      /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    )

  const contentHtml = articleMatch ? articleMatch[1] : html

  // 본문 내 이미지 추출
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi
  let imgMatch
  while ((imgMatch = imgRegex.exec(contentHtml)) !== null) {
    const src = imgMatch[1]
    if (
      (src.includes("wp-content/uploads") ||
        src.includes("assets.newsweek") ||
        src.match(/\.(jpg|jpeg|png|webp|gif)/i)) &&
      !src.includes("logo") &&
      !src.includes("icon") &&
      !src.includes("avatar") &&
      !images.includes(src)
    ) {
      images.push(src)
    }
  }

  // srcset에서도 이미지 추출 (가장 큰 이미지)
  const srcsetRegex = /srcset="([^"]+)"/gi
  let srcsetMatch
  while ((srcsetMatch = srcsetRegex.exec(contentHtml)) !== null) {
    const entries = srcsetMatch[1].split(",").map((s) => s.trim())
    // 가장 큰 이미지 (마지막 항목)
    const lastEntry = entries[entries.length - 1]
    const urlMatch = lastEntry.match(/^(\S+)/)
    if (urlMatch && !images.includes(urlMatch[1])) {
      const src = urlMatch[1].replace(/&amp;/g, "&")
      if (
        !src.includes("logo") &&
        !src.includes("icon") &&
        !images.includes(src)
      ) {
        images.push(src)
      }
    }
  }

  // 본문 텍스트 추출
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
      .replace(/&#8217;/g, "'")
      .replace(/&#8230;/g, "…")
      .trim()
    if (text.length > 20) paragraphs.push(text)
  }

  return { title, images, paragraphs }
}

async function main() {
  const url = process.argv[2]

  if (!url) {
    console.log("사용법: node scripts/newsweek-extract.mjs <URL>")
    process.exit(1)
  }

  console.log(`🔍 가져오는 중: ${url}\n`)
  const html = await fetchText(url)
  const { title, images, paragraphs } = extractArticle(html)

  console.log("═══════════════════════════════════════════")
  console.log(`📄 제목: ${title}`)
  console.log("═══════════════════════════════════════════\n")

  console.log(`🖼️  이미지 (${images.length}개):`)
  images.forEach((img, i) => console.log(`   ${i + 1}. ${img}`))

  console.log(`\n📝 본문 단락 (${paragraphs.length}개):`)
  paragraphs.forEach((p, i) => console.log(`   [${i + 1}] ${p.slice(0, 100)}...`))

  console.log(`\n📊 요약: 제목 1개, 이미지 ${images.length}개, 본문 ${paragraphs.length}단락`)
}

main().catch((err) => {
  console.error("❌ 오류:", err.message || err)
  process.exit(1)
})
