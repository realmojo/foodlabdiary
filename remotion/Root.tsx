import React from "react"
import { Composition } from "remotion"
import { ShortsVideo } from "./ShortsVideo"
import type { ShortsSlide } from "./types"

// 프리뷰용 샘플 데이터
const sampleSlides: ShortsSlide[] = [
  {
    type: "intro",
    title: "건강한 식생활을 위한 정보",
    category: "건강",
    author: "푸드랩다이어리",
    date: "2026년 3월",
  },
  {
    type: "content",
    title: "균형 잡힌 식단의 중요성",
    text: "하루 세 끼 균형 잡힌 식사를 통해 필요한 영양소를 골고루 섭취하는 것이 건강 유지의 기본입니다. 탄수화물, 단백질, 지방의 비율을 적절히 조절하세요.",
  },
  {
    type: "image",
    imageUrl: "https://placehold.co/1080x1920/16A34A/fff?text=Sample",
    caption: "균형 잡힌 한 끼 식사",
  },
  {
    type: "quote",
    text: "올바른 식습관은 건강한 삶의 시작입니다. 오늘 먹는 음식이 내일의 나를 만듭니다.",
  },
  {
    type: "outro",
    logoText: "푸드랩다이어리",
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
