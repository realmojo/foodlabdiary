import React from "react"
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import type { ShortsSlide } from "./types"

const accent = "#F59E0B"
const white = "#FFFFFF"

/* ── 애니메이션 헬퍼 ── */
function useFadeUp(delay = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const progress = spring({ frame: frame - delay, fps, config: { damping: 20 } })
  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(progress, [0, 1], [40, 0])}px)`,
  }
}

/* ── 배경 이미지 + 어둡게 오버레이 (Ken Burns 효과) ── */
function ImageBackground({ url }: { url: string }) {
  const frame = useCurrentFrame()
  const scale = interpolate(frame, [0, 150], [1, 1.08], {
    extrapolateRight: "clamp",
  })

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={url}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
      {/* 어두운 오버레이 — 텍스트 가독성 확보 */}
      <AbsoluteFill
        style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
      />
    </AbsoluteFill>
  )
}

/* ── Intro 슬라이드 ── */
function IntroSlide({ slide }: { slide: ShortsSlide }) {
  const badgeStyle = useFadeUp(3)
  const titleStyle = useFadeUp(8)
  const metaStyle = useFadeUp(18)

  return (
    <AbsoluteFill>
      {slide.backgroundUrl && <ImageBackground url={slide.backgroundUrl} />}
      {!slide.backgroundUrl && (
        <AbsoluteFill style={{ backgroundColor: "#111" }} />
      )}

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 56,
        }}
      >
        {slide.category && (
          <div
            style={{
              ...badgeStyle,
              backgroundColor: accent,
              color: "#111",
              padding: "10px 28px",
              borderRadius: 999,
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 36,
            }}
          >
            {slide.category}
          </div>
        )}

        <h1
          style={{
            ...titleStyle,
            color: white,
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.4,
            textAlign: "center",
            wordBreak: "keep-all",
            textShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          {slide.title}
        </h1>

        <div
          style={{
            ...metaStyle,
            marginTop: 44,
            color: "rgba(255,255,255,0.75)",
            fontSize: 26,
            display: "flex",
            gap: 16,
          }}
        >
          {slide.author && <span>{slide.author}</span>}
          {slide.date && <span>{slide.date}</span>}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── Content 슬라이드 ── */
function ContentSlide({ slide }: { slide: ShortsSlide }) {
  const headStyle = useFadeUp(3)
  const bodyStyle = useFadeUp(10)
  const plainText = slide.text?.replace(/<[^>]*>/g, "") ?? ""

  return (
    <AbsoluteFill>
      {slide.backgroundUrl && <ImageBackground url={slide.backgroundUrl} />}
      {!slide.backgroundUrl && (
        <AbsoluteFill style={{ backgroundColor: "#111" }} />
      )}

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 56,
        }}
      >
        {slide.title && (
          <h2
            style={{
              ...headStyle,
              color: accent,
              fontSize: 40,
              fontWeight: 700,
              marginBottom: 28,
              textAlign: "center",
              wordBreak: "keep-all",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}
          >
            {slide.title}
          </h2>
        )}
        <p
          style={{
            ...bodyStyle,
            color: white,
            fontSize: 34,
            lineHeight: 1.65,
            textAlign: "center",
            wordBreak: "keep-all",
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}
        >
          {plainText}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── Image 슬라이드 (풀스크린 이미지 + 캡션) ── */
function ImageSlide({ slide }: { slide: ShortsSlide }) {
  const imgUrl = slide.imageUrl ?? slide.backgroundUrl
  const frame = useCurrentFrame()
  const scale = interpolate(frame, [0, 150], [1, 1.08], {
    extrapolateRight: "clamp",
  })
  const captionStyle = useFadeUp(10)

  return (
    <AbsoluteFill style={{ backgroundColor: "#111" }}>
      {imgUrl && (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={imgUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${scale})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "45%",
              background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
            }}
          />
        </AbsoluteFill>
      )}

      {slide.caption && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 48,
            right: 48,
            ...captionStyle,
          }}
        >
          <p
            style={{
              color: white,
              fontSize: 34,
              lineHeight: 1.5,
              textAlign: "center",
              wordBreak: "keep-all",
              textShadow: "0 2px 10px rgba(0,0,0,0.6)",
            }}
          >
            {slide.caption}
          </p>
        </div>
      )}
    </AbsoluteFill>
  )
}

/* ── Quote 슬라이드 ── */
function QuoteSlide({ slide }: { slide: ShortsSlide }) {
  const quoteStyle = useFadeUp(5)

  return (
    <AbsoluteFill>
      {slide.backgroundUrl && <ImageBackground url={slide.backgroundUrl} />}
      {!slide.backgroundUrl && (
        <AbsoluteFill style={{ backgroundColor: "#111" }} />
      )}

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 56,
        }}
      >
        <div
          style={{
            ...quoteStyle,
            borderLeft: `6px solid ${accent}`,
            paddingLeft: 32,
          }}
        >
          <p
            style={{
              color: white,
              fontSize: 38,
              lineHeight: 1.65,
              fontStyle: "italic",
              wordBreak: "keep-all",
              textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            }}
          >
            {slide.text?.replace(/<[^>]*>/g, "")}
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── Outro 슬라이드 ── */
function OutroSlide({ slide }: { slide: ShortsSlide }) {
  const logoStyle = useFadeUp(5)
  const ctaStyle = useFadeUp(15)

  return (
    <AbsoluteFill>
      {slide.backgroundUrl && <ImageBackground url={slide.backgroundUrl} />}
      {!slide.backgroundUrl && (
        <AbsoluteFill style={{ backgroundColor: "#111" }} />
      )}

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 56,
        }}
      >
        <div style={logoStyle}>
          <svg viewBox="0 0 512 512" width={120} height={120}>
            <rect width="512" height="512" rx="96" fill={accent} />
            <g fill={white}>
              <ellipse cx="256" cy="320" rx="100" ry="85" />
              <ellipse cx="145" cy="195" rx="45" ry="55" transform="rotate(-15 145 195)" />
              <ellipse cx="200" cy="160" rx="40" ry="50" transform="rotate(-5 200 160)" />
              <ellipse cx="312" cy="160" rx="40" ry="50" transform="rotate(5 312 160)" />
              <ellipse cx="367" cy="195" rx="45" ry="55" transform="rotate(15 367 195)" />
            </g>
          </svg>
        </div>

        <h2
          style={{
            ...logoStyle,
            color: white,
            fontSize: 48,
            fontWeight: 800,
            marginTop: 28,
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {slide.logoText ?? "포우포우"}
        </h2>

        <p
          style={{
            ...ctaStyle,
            color: "rgba(255,255,255,0.7)",
            fontSize: 28,
            marginTop: 24,
          }}
        >
          petpawpaw.net
        </p>

        <div
          style={{
            ...ctaStyle,
            marginTop: 40,
            backgroundColor: accent,
            color: "#111",
            padding: "14px 40px",
            borderRadius: 999,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          더 많은 이야기 보러가기
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── 메인 Slide 라우터 ── */
export function Slide({ slide }: { slide: ShortsSlide }) {
  switch (slide.type) {
    case "intro":
      return <IntroSlide slide={slide} />
    case "content":
      return <ContentSlide slide={slide} />
    case "image":
      return <ImageSlide slide={slide} />
    case "quote":
      return <QuoteSlide slide={slide} />
    case "outro":
      return <OutroSlide slide={slide} />
    default:
      return <ContentSlide slide={slide} />
  }
}
