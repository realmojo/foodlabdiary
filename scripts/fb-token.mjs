#!/usr/bin/env node

/**
 * Facebook Page 장기 토큰 발급 스크립트
 *
 * 사용법:
 *   1) https://developers.facebook.com/tools/explorer/ 에서 단기 사용자 토큰 발급
 *      - 앱 선택 → 권한: pages_manage_posts, pages_read_engagement, pages_show_list
 *      - "Generate Access Token" 클릭 → 토큰 복사
 *   2) node scripts/fb-token.mjs <단기_사용자_토큰>
 *
 * 결과: .env.local의 FACEBOOK_PAGE_ACCESS_TOKEN이 만료 없는 토큰으로 업데이트됨
 */

import https from "https"
import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { readFileSync, writeFileSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = resolve(__dirname, "..", ".env.local")
config({ path: envPath })

function fbGet(url) {
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

async function main() {
  const shortLivedToken = process.argv[2]

  if (!shortLivedToken) {
    console.log(`
사용법: node scripts/fb-token.mjs <단기_사용자_토큰>

1. https://developers.facebook.com/tools/explorer/ 접속
2. 앱 선택 (App ID: ${process.env.FACEBOOK_APP_ID || "955945956938572"})
3. 권한 추가: pages_manage_posts, pages_read_engagement, pages_show_list
4. "Generate Access Token" 클릭
5. 토큰 복사 후 이 스크립트에 전달
`)
    process.exit(1)
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    console.error("❌ .env.local에 FACEBOOK_APP_ID, FACEBOOK_APP_SECRET이 필요합니다")
    process.exit(1)
  }

  // Step 1: 단기 토큰 → 장기 사용자 토큰 (60일)
  console.log("🔄 단기 토큰 → 장기 사용자 토큰 교환 중...")
  const longLivedUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`

  const longLivedRes = await fbGet(longLivedUrl)

  if (longLivedRes.error) {
    console.error("❌ 장기 토큰 교환 실패:", longLivedRes.error.message)
    process.exit(1)
  }

  const longLivedUserToken = longLivedRes.access_token
  console.log("✅ 장기 사용자 토큰 발급 완료")

  // Step 2: 장기 사용자 토큰으로 Page Access Token 발급 (만료 없음)
  console.log("🔄 Page Access Token 발급 중...")
  const pageId = process.env.FACEBOOK_PAGE_ID

  let pageToken
  if (pageId) {
    // 특정 페이지 토큰
    const pageRes = await fbGet(
      `https://graph.facebook.com/v22.0/${pageId}?fields=id,name,access_token&access_token=${longLivedUserToken}`
    )
    if (pageRes.error) {
      console.error("❌ 페이지 토큰 발급 실패:", pageRes.error.message)
      process.exit(1)
    }
    pageToken = pageRes.access_token
    console.log(`✅ Page: ${pageRes.name} (${pageRes.id})`)
  } else {
    // 첫 번째 페이지
    const accountsRes = await fbGet(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token&access_token=${longLivedUserToken}`
    )
    if (accountsRes.error || !accountsRes.data?.length) {
      console.error("❌ 페이지 목록 조회 실패")
      process.exit(1)
    }
    const page = accountsRes.data[0]
    pageToken = page.access_token
    console.log(`✅ Page: ${page.name} (${page.id})`)
  }

  // Step 3: 토큰 유효성 검증
  console.log("🔍 토큰 유효성 검증 중...")
  const debugRes = await fbGet(
    `https://graph.facebook.com/v22.0/debug_token?input_token=${pageToken}&access_token=${appId}|${appSecret}`
  )

  if (debugRes.data) {
    const { expires_at, is_valid, scopes } = debugRes.data
    console.log(`   유효: ${is_valid}`)
    console.log(`   만료: ${expires_at === 0 ? "만료 없음 ✨" : new Date(expires_at * 1000).toLocaleString("ko-KR")}`)
    console.log(`   권한: ${scopes?.join(", ")}`)
  }

  // Step 4: .env.local 업데이트
  let envContent = readFileSync(envPath, "utf-8")
  envContent = envContent.replace(
    /FACEBOOK_PAGE_ACCESS_TOKEN=.*/,
    `FACEBOOK_PAGE_ACCESS_TOKEN=${pageToken}`
  )
  writeFileSync(envPath, envContent, "utf-8")

  console.log("\n✅ .env.local 업데이트 완료!")
  console.log(`   FACEBOOK_PAGE_ACCESS_TOKEN=${pageToken.slice(0, 30)}...`)
}

main().catch((err) => {
  console.error("❌ 오류:", err.message || err)
  process.exit(1)
})
