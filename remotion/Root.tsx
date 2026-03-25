import React from "react"
import { Composition } from "remotion"
import { ShortsVideo } from "./ShortsVideo"
import type { ShortsSlide } from "./types"

// 프리뷰용 샘플 데이터
const sampleSlides: ShortsSlide[] = [
  {
    type: "intro",
    title: "반려동물과 함께하는 더 나은 일상",
    category: "강아지",
    author: "포우포우",
    date: "2026년 3월",
  },
  {
    type: "content",
    title: "산책 시 주의사항",
    text: "강아지와 산책할 때는 리드줄 길이를 1.5m 이내로 유지하고, 다른 강아지와의 접촉 시 주인의 허락을 먼저 구해야 합니다.",
  },
  {
    type: "image",
    imageUrl: "https://placehold.co/1080x1920/F59E0B/fff?text=Sample",
    caption: "올바른 리드줄 사용법",
  },
  {
    type: "quote",
    text: "반려동물은 가족입니다. 책임감 있는 반려가 행복한 동반자 관계의 시작입니다.",
  },
  {
    type: "outro",
    logoText: "포우포우",
  },
]

const SLIDE_DURATION = 150 // 5초 @ 30fps

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Shorts"
        component={ShortsVideo}
        durationInFrames={sampleSlides.length * SLIDE_DURATION}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ slides: sampleSlides }}
      />
    </>
  )
}
