#!/usr/bin/env node

/**
 * Google OAuth2 Refresh Token 발급 스크립트
 *
 * 사용법: node scripts/google-auth.mjs
 *
 * 1) 브라우저에서 Google 로그인 → 권한 승인
 * 2) 리다이렉트된 URL에서 code 파라미터 복사
 * 3) 터미널에 붙여넣기
 * 4) .env.local에 GOOGLE_REFRESH_TOKEN 추가
 */

import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { createInterface } from "readline"
import https from "https"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "..", ".env.local") })

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ .env.local에 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 설정하세요")
  process.exit(1)
}

const REDIRECT_URI = "http://localhost"
const SCOPE = "https://www.googleapis.com/auth/blogger"

// 1) 인증 URL 생성
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPE)}&access_type=offline&prompt=consent`

console.log("═══════════════════════════════════════════")
console.log("  Google OAuth2 Refresh Token 발급")
console.log("═══════════════════════════════════════════\n")
console.log("1️⃣  아래 URL을 브라우저에서 열어주세요:\n")
console.log(authUrl)
console.log("\n2️⃣  Google 로그인 후 권한을 승인하세요")
console.log("3️⃣  리다이렉트된 URL에서 code= 뒤의 값을 복사하세요")
console.log("    (예: http://localhost/?code=4/0XXXXXXX&scope=...)")
console.log("    → 4/0XXXXXXX 부분만 복사\n")

const rl = createInterface({ input: process.stdin, output: process.stdout })

rl.question("📋 code 값을 붙여넣으세요: ", async (code) => {
  rl.close()

  const trimmedCode = decodeURIComponent(code.trim())

  // 2) code → refresh_token 교환
  const postData = new URLSearchParams({
    code: trimmedCode,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  }).toString()

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(postData),
          },
        },
        (res) => {
          let body = ""
          res.on("data", (c) => (body += c))
          res.on("end", () => {
            try { resolve(JSON.parse(body)) }
            catch { reject(new Error(body)) }
          })
        }
      )
      req.on("error", reject)
      req.write(postData)
      req.end()
    })

    if (result.error) {
      console.error(`\n❌ 오류: ${result.error_description || result.error}`)
      process.exit(1)
    }

    console.log("\n✅ 토큰 발급 성공!\n")
    console.log(`  Access Token:  ${result.access_token?.slice(0, 30)}...`)
    console.log(`  Refresh Token: ${result.refresh_token}`)
    console.log(`\n📝 .env.local에 아래 줄을 추가하세요:\n`)
    console.log(`GOOGLE_REFRESH_TOKEN=${result.refresh_token}`)
    console.log("")
  } catch (err) {
    console.error(`\n❌ 토큰 교환 실패: ${err.message}`)
    process.exit(1)
  }
})
