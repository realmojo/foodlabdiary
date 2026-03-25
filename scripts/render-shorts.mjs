/**
 * 블로그 포스트 → 숏츠 영상 렌더링 스크립트
 *
 * 사용법:
 *   node scripts/render-shorts.mjs <post-slug>
 *
 * 예시:
 *   node scripts/render-shorts.mjs artificial-intelligence-bears-fight
 */

import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"
import { createClient } from "@supabase/supabase-js"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(ROOT, ".env.local") })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const slug = process.argv[2]
if (!slug) {
  console.error("Usage: node scripts/render-shorts.mjs <post-slug>")
  process.exit(1)
}

// ── 1) 포스트 데이터 가져오기 ──
console.log(`📰 포스트 로딩: ${slug}`)

const { data: post, error } = await supabase
  .from("pawpaw_posts")
  .select(
    "*, author:pawpaw_authors(*), primary_category:pawpaw_categories!posts_primary_category_id_fkey(*)"
  )
  .eq("slug", slug)
  .single()

if (error || !post) {
  console.error("포스트를 찾을 수 없습니다:", error?.message)
  process.exit(1)
}

// junction 테이블에서 카테고리
const { data: postCats } = await supabase
  .from("pawpaw_post_categories")
  .select("category:pawpaw_categories!post_categories_category_id_fkey(*)")
  .eq("post_id", post.id)

post.categories = postCats?.map((pc) => pc.category) ?? []

// ── 2) 콘텐츠 → 슬라이드 변환 ──
function postToSlides(post) {
  const slides = []
  const MAX_SLIDES = 10 // 최대 10장 (50초, 1분 미만)

  // 모든 이미지를 수집 (featured + content 이미지)
  const allImages = []
  if (post.featured_image_url) allImages.push(post.featured_image_url)
  for (const b of post.content ?? []) {
    if (b.type === "image" && b.url && !allImages.includes(b.url)) {
      allImages.push(b.url)
    }
  }

  // 이미지를 슬라이드에 순환 배분하는 헬퍼
  let imgIdx = 0
  const nextBg = () => {
    if (allImages.length === 0) return undefined
    const url = allImages[imgIdx % allImages.length]
    imgIdx++
    return url
  }

  // Intro — featured 이미지를 배경으로
  slides.push({
    type: "intro",
    title: post.title,
    category: post.primary_category?.name ?? "",
    author: post.author?.name ?? "",
    backgroundUrl: post.featured_image_url ?? nextBg(),
    date: post.published_at
      ? new Date(post.published_at).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "",
  })

  const blocks = post.content ?? []
  let currentHeading = null

  for (const block of blocks) {
    if (slides.length >= MAX_SLIDES - 1) break // outro 자리 확보

    switch (block.type) {
      case "heading":
        currentHeading = block.text?.replace(/<[^>]*>/g, "") ?? null
        break

      case "paragraph": {
        const text = block.text?.replace(/<[^>]*>/g, "")?.trim()
        if (!text || text.length < 20) break

        const trimmed =
          text.length > 200 ? text.slice(0, 197) + "..." : text

        slides.push({
          type: "content",
          title: currentHeading ?? undefined,
          text: trimmed,
          backgroundUrl: nextBg(),
        })
        currentHeading = null
        break
      }

      case "image":
        if (block.url) {
          slides.push({
            type: "image",
            imageUrl: block.url,
            caption:
              block.caption ??
              block.alt ??
              currentHeading ??
              undefined,
          })
        }
        break

      case "quote": {
        const quoteText = block.text?.replace(/<[^>]*>/g, "")?.trim()
        if (quoteText) {
          slides.push({ type: "quote", text: quoteText, backgroundUrl: nextBg() })
        }
        break
      }
    }
  }

  // Outro — 첫 번째 이미지를 배경으로
  slides.push({
    type: "outro",
    logoText: "포우포우",
    backgroundUrl: allImages[0] ?? undefined,
  })

  return slides
}

const slides = postToSlides(post)
console.log(`🎬 슬라이드 ${slides.length}장 생성 (${slides.length * 5}초)`)

if (slides.length * 5 > 59) {
  // 60초 초과 시 슬라이드 줄이기
  const maxSlides = Math.floor(59 / 5)
  const intro = slides[0]
  const outro = slides[slides.length - 1]
  const middle = slides.slice(1, -1).slice(0, maxSlides - 2)
  slides.length = 0
  slides.push(intro, ...middle, outro)
  console.log(`⚠️  1분 미만으로 조정: ${slides.length}장 (${slides.length * 5}초)`)
}

// ── 3) Remotion 번들링 & 렌더링 ──
console.log("📦 번들링 중...")
const bundleLocation = await bundle({
  entryPoint: path.join(ROOT, "remotion/index.ts"),
  webpackOverride: (config) => config,
})

const SLIDE_DURATION = 150 // 5초 @ 30fps

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "Shorts",
  inputProps: { slides },
})

// inputProps와 duration 오버라이드
composition.durationInFrames = slides.length * SLIDE_DURATION
composition.props = { slides }

const outputPath = path.join(ROOT, `output/${slug}-shorts.mp4`)

// output 디렉토리 생성
import fs from "fs"
fs.mkdirSync(path.join(ROOT, "output"), { recursive: true })

console.log(`🎥 렌더링 중... → ${outputPath}`)
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  outputLocation: outputPath,
  inputProps: { slides },
})

console.log(`✅ 완료! ${outputPath}`)
console.log(`   길이: ${slides.length * 5}초 | 해상도: 1080×1920 (9:16)`)
