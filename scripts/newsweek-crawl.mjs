#!/usr/bin/env node

/**
 * Newsweek /topic/dogs 페이지 1~455 크롤링
 * 각 페이지에서 기사 URL을 추출하여 newsweek-urls.json에 저장
 *
 * 사용법: node scripts/newsweek-crawl.mjs
 */

import https from "https"
import { writeFileSync, readFileSync, existsSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BASE_URL = "https://www.newsweek.com"
const TOPIC_PATH = "/topic/dogs"
const MAX_PAGE = parseInt(process.argv[2] || "455", 10)
const OUTPUT_FILE = resolve(__dirname, "newsweek-urls.json")
const CONCURRENCY = 5
const DELAY_MS = 500

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirect = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href
          return fetchPage(redirect).then(resolve).catch(reject)
        }
        if (res.statusCode !== 200) {
          let body = ""
          res.on("data", (c) => (body += c))
          res.on("end", () =>
            reject(new Error(`HTTP ${res.statusCode}: ${url}`))
          )
          return
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

function extractUrls(html) {
  const urls = []
  // data-gtm-action="Hero_Story_N" 패턴의 <a> 태그에서 href 추출
  const regex = /href="([^"]+)"[^>]*data-gtm-action="Hero_Story_\d+"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const href = match[1]
    if (!urls.includes(href)) {
      urls.push(href)
    }
  }
  // 반대 순서도 체크 (data-gtm-action이 href 앞에 올 수 있음)
  const regex2 = /data-gtm-action="Hero_Story_\d+"[^>]*href="([^"]+)"/g
  while ((match = regex2.exec(html)) !== null) {
    const href = match[1]
    if (!urls.includes(href)) {
      urls.push(href)
    }
  }
  return urls.map((u) => (u.startsWith("http") ? u : `${BASE_URL}${u}`))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function crawlPage(page) {
  const url =
    page === 1
      ? `${BASE_URL}${TOPIC_PATH}`
      : `${BASE_URL}${TOPIC_PATH}?page=${page}`
  try {
    const html = await fetchPage(url)
    const urls = extractUrls(html)
    return urls
  } catch (err) {
    console.error(`  ❌ 페이지 ${page} 실패: ${err.message}`)
    return []
  }
}

async function main() {
  // 기존 결과 로드 (이어하기 지원)
  let allUrls = []
  let startPage = 1

  if (existsSync(OUTPUT_FILE)) {
    allUrls = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"))
    // 대략 페이지당 15개 기사 기준으로 이어하기 페이지 추정
    startPage = Math.floor(allUrls.length / 15) + 1
    if (startPage > 1) {
      console.log(
        `📂 기존 ${allUrls.length}개 URL 로드, 페이지 ${startPage}부터 이어서 크롤링`
      )
    }
  }

  console.log(`🔍 Newsweek /topic/dogs 크롤링 시작 (페이지 ${startPage}~${MAX_PAGE})`)
  console.log(`   동시 요청: ${CONCURRENCY}개, 딜레이: ${DELAY_MS}ms\n`)

  const uniqueSet = new Set(allUrls)

  for (let page = startPage; page <= MAX_PAGE; page += CONCURRENCY) {
    const batch = []
    for (
      let p = page;
      p < page + CONCURRENCY && p <= MAX_PAGE;
      p++
    ) {
      batch.push(p)
    }

    const results = await Promise.all(batch.map((p) => crawlPage(p)))

    let batchNew = 0
    for (const urls of results) {
      for (const url of urls) {
        if (!uniqueSet.has(url)) {
          uniqueSet.add(url)
          allUrls.push(url)
          batchNew++
        }
      }
    }

    const lastPage = batch[batch.length - 1]
    console.log(
      `  📄 페이지 ${batch[0]}~${lastPage} 완료 | +${batchNew}개 | 총 ${allUrls.length}개`
    )

    // 10페이지마다 중간 저장
    if (lastPage % 10 === 0 || lastPage === MAX_PAGE) {
      writeFileSync(OUTPUT_FILE, JSON.stringify(allUrls, null, 2), "utf-8")
    }

    if (lastPage < MAX_PAGE) {
      await sleep(DELAY_MS)
    }
  }

  // 최종 저장
  writeFileSync(OUTPUT_FILE, JSON.stringify(allUrls, null, 2), "utf-8")

  console.log(`\n✅ 크롤링 완료!`)
  console.log(`   총 ${allUrls.length}개 URL → ${OUTPUT_FILE}`)
}

main().catch((err) => {
  console.error("❌ 오류:", err.message || err)
  process.exit(1)
})
