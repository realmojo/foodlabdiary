#!/usr/bin/env node

import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, "..", ".env.local") })

import https from "https"
import http from "http"
import { Ollama } from "ollama"

const ollama = new Ollama()

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http
    client
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks)))
        res.on("error", reject)
      })
      .on("error", reject)
  })
}

const testUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/YellowLabradorLooking_new.jpg/1200px-YellowLabradorLooking_new.jpg"

console.log("📸 이미지 다운로드 중...")
const buffer = await fetchBuffer(testUrl)
console.log(`✅ 다운로드 완료 (${(buffer.length / 1024).toFixed(0)}KB)`)

console.log("🔍 llava 모델로 분석 중...")
const base64 = buffer.toString("base64")

try {
  const response = await ollama.generate({
    model: "llava",
    prompt: "Describe this image in detail for recreating it. Include subject, composition, colors, mood, background, and style.",
    images: [base64],
    options: { temperature: 0.3, num_predict: 512 },
    keep_alive: "5m",
  })
  console.log("✅ 분석 결과:")
  console.log(response.response)
} catch (err) {
  console.error("❌ 오류:", err.message)
}

// 언로드
await ollama.generate({ model: "llava", prompt: "", keep_alive: 0 }).catch(() => {})
console.log("🔄 llava 언로드 완료")
