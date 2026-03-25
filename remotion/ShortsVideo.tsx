import React from "react"
import { AbsoluteFill, Sequence, Audio } from "remotion"
import { Slide } from "./Slide"
import type { ShortsProps } from "./types"

const SLIDE_DURATION_FRAMES = 150 // 5초 @ 30fps

export function ShortsVideo({ slides }: ShortsProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#111111" }}>
      {slides.map((slide, i) => (
        <Sequence
          key={i}
          from={i * SLIDE_DURATION_FRAMES}
          durationInFrames={SLIDE_DURATION_FRAMES}
        >
          <Slide slide={slide} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
