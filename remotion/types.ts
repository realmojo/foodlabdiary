export interface ShortsSlide {
  type: "intro" | "content" | "image" | "quote" | "outro"
  title?: string
  text?: string
  imageUrl?: string       // 슬라이드 전용 이미지
  backgroundUrl?: string  // 배경 이미지 (모든 슬라이드에 사용 가능)
  caption?: string
  category?: string
  author?: string
  date?: string
  logoText?: string
}

export interface ShortsProps {
  slides: ShortsSlide[]
}
