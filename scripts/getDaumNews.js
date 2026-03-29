#!/usr/bin/env node

/**
 * 다음 뉴스 URL → JSON 변환 (부족한 섹션은 Ollama로 보충)
 *
 * 사용법:
 *   node scripts/getDaumNews.js <다음뉴스URL>
 *
 * 예시:
 *   node scripts/getDaumNews.js https://v.daum.net/v/x6A9s5kLIH
 */

import { load } from "cheerio"
import { writeFileSync } from "fs"
import { resolve } from "path"
import { Ollama } from "ollama"

const MIN_SECTIONS = 6 // 도입부 1 + 소제목 5
const ollama = new Ollama()
const MAX_RETRY = 2

// 중국어/일본어 포함 여부 체크 (한국어, 영어, 숫자, 기호는 허용)
function containsForeignLang(text) {
  const cjk = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || [] // 한자(중국어)
  const jp = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []   // 히라가나+카타카나
  return cjk.length > 3 || jp.length > 3
}

// Ollama 생성 + 한국어 검증 (실패 시 재시도)
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
    console.log(`  ⚠️ 외국어 감지, 재시도 (${attempt + 1}/${MAX_RETRY})...`)
  }
  return null // 모든 재시도 실패
}

const url = process.argv[2]
if (!url) {
  console.log("사용법: node scripts/getDaumNews.js <다음뉴스URL>")
  console.log(
    "예시:   node scripts/getDaumNews.js https://v.daum.net/v/x6A9s5kLIH"
  )
  process.exit(1)
}

// 1. HTML 가져오기
console.log(`Fetching: ${url}`)
const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
})
const html = await res.text()
const $ = load(html)

// 2. 제목 추출
const title = $("h2.tit_head").text().trim()
if (!title) {
  console.error("제목을 찾을 수 없습니다.")
  process.exit(1)
}
console.log(`제목: ${title}`)

// 3. 본문 요소들을 순서대로 순회
const section = $("#articleBody section").first()
const elements = section.children().toArray()

const contents = []
let current = null

for (const el of elements) {
  const $el = $(el)
  const tag = el.tagName?.toLowerCase()

  // h3 소제목
  if (tag === "h3") {
    const text = $el.text().trim()
    // 광고/프로모션 섹션 스킵
    if (text.includes("채널도감") || text.includes("건강정보")) break
    if (current) contents.push(current)
    current = { title: text, text: "" }
    continue
  }

  // p 본문
  if (tag === "p" && $el.hasClass("align_l")) {
    const text = $el.text().trim()
    if (!text) continue

    if (!current) {
      // 첫 번째 섹션 (도입부, title 없음)
      current = { text }
      contents.push(current)
      current = null
    } else {
      // 소제목 아래 본문 - 여러 p가 있으면 합치기
      if (current.text) {
        current.text += " " + text
      } else {
        current.text = text
      }
    }
    continue
  }
}

// 마지막 섹션 push
if (current && current.text) {
  contents.push(current)
}

console.log(`추출된 섹션: ${contents.length}개`)

// 4. 섹션이 부족하면 Ollama로 추가 생성
if (contents.length < MIN_SECTIONS) {
  const need = MIN_SECTIONS - contents.length
  console.log(`섹션 ${need}개 부족 → Ollama로 추가 생성 중...`)

  for (let n = 0; n < need; n++) {
    const existingTitles = contents
      .filter((c) => c.title)
      .map((c) => c.title)
      .join(", ")

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
    if (!raw) {
      console.error(`  섹션 생성 실패 [${n + 1}/${need}]: 한국어 생성 불가`)
      continue
    }

    try {
      const parsed = JSON.parse(raw)
      const item = parsed.title ? parsed : Object.values(parsed)[0]
      if (item && item.title && item.text) {
        contents.push({ title: item.title, text: item.text })
        console.log(`  + 추가 [${n + 1}/${need}]: ${item.title}`)
      }
    } catch (err) {
      console.error(`  Ollama 응답 파싱 실패 [${n + 1}/${need}]:`, err.message)
    }
  }
}

// 5. 제목 클릭베이트 재창작
let result_title = title
console.log("제목 재창작 중 (Ollama)...")

const titlePrompt = `당신은 한국 건강/음식 블로그의 클릭베이트 제목 전문가입니다.
아래 원본 제목을 참고하여, 클릭률이 극대화되는 새로운 제목을 1개만 만들어주세요.

원본 제목: ${title}

클릭베이트 제목 공식 (아래 중 2~3개를 조합):
- [부정형+반전]: "마늘도 생강도 아닙니다.." → 고정관념을 깨서 궁금증 유발
- [최상급+순위]: "토마토, 마늘 제치고 1위" → 익히 알고 있는 건강식품보다 우월함 강조
- [긴박함+공포]: "골다공증 무섭다면 꼭 드세요" → 타겟 독자의 두려움을 건드림
- [가성비+의외성]: "마트에서 단돈 2천원인데.." → 낮은 진입장벽 강조
- [구체적 신체 변화]: "허리 꼿꼿하게 세워주는", "뇌세포 깨우는" → 직관적인 효과 묘사

규칙:
- 제목만 출력 (따옴표, 설명, 번호 없이)
- 40~60자 사이
- ".." 을 활용해 말줄임 효과 넣기
- 원본과 같은 주제이되, 표현은 완전히 다르게`

const titleRaw = await generateKorean(titlePrompt, { temperature: 0.8 })
const newTitle = (titleRaw || "").replace(/^["']|["']$/g, "").replace(/^\d+\.\s*/, "")
if (newTitle.length > 10 && newTitle.length < 80) {
  console.log(`  원본: ${title}`)
  console.log(`  변경: ${newTitle}`)
  result_title = newTitle
} else {
  console.log(`  제목 재창작 실패, 원본 유지: ${title}`)
  result_title = title
}

// 6. 각 섹션의 text를 Ollama로 재창작
console.log("텍스트 재창작 중 (Ollama)...")

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
    console.log(`  [${i + 1}/${contents.length}] ${subject} → 재창작 완료 (${newText.length}자)`)
  } else {
    console.log(`  [${i + 1}/${contents.length}] ${subject} → 재창작 실패, 원문 유지`)
  }
}

// 7. imagePrompt 생성 - Ollama로 영어 프롬프트 만들기
console.log("imagePrompt 생성 중 (Ollama)...")

for (let i = 0; i < contents.length; i++) {
  const item = contents[i]
  const subject = item.title || title

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
  console.log(`  [${i + 1}/${contents.length}] ${subject} → ${imagePrompt.slice(0, 60)}...`)
}

// 8. JSON 파일 저장
const result = { title: result_title, contents }
const outputPath = resolve(process.cwd(), "input.json")
writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8")
console.log(`\n저장 완료: ${outputPath}`)
console.log(`섹션 수: ${contents.length}`)
