"use client"

import { useCallback, useState } from "react"

interface ShareButtonsProps {
  url: string
  title: string
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const shareKakao = useCallback(() => {
    const kakaoUrl = `https://story.kakao.com/share?url=${encodeURIComponent(url)}`
    window.open(kakaoUrl, "_blank", "noopener,noreferrer,width=600,height=500")
  }, [url])

  const shareFacebook = useCallback(() => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(fbUrl, "_blank", "noopener,noreferrer,width=600,height=500")
  }, [url])

  const shareX = useCallback(() => {
    const xUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
    window.open(xUrl, "_blank", "noopener,noreferrer,width=600,height=500")
  }, [url, title])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const input = document.createElement("input")
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [url])

  const shareNative = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // user cancelled
      }
    }
  }, [title, url])

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">공유</span>

      {/* 카카오 */}
      <button
        onClick={shareKakao}
        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-muted"
        aria-label="카카오스토리 공유"
        title="카카오스토리"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
          <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.8 5.22 4.51 6.6l-1.12 4.08a.37.37 0 0 0 .56.4l4.76-3.15c.42.04.85.07 1.29.07 5.52 0 10-3.58 10-7.9S17.52 3 12 3z" />
        </svg>
      </button>

      {/* 페이스북 */}
      <button
        onClick={shareFacebook}
        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-muted"
        aria-label="페이스북 공유"
        title="페이스북"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </button>

      {/* X (Twitter) */}
      <button
        onClick={shareX}
        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-muted"
        aria-label="X 공유"
        title="X"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      {/* 링크 복사 */}
      <button
        onClick={copyLink}
        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-muted"
        aria-label="링크 복사"
        title={copied ? "복사됨!" : "링크 복사"}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </button>

      {/* 네이티브 공유 (모바일) */}
      {"share" in (typeof navigator !== "undefined" ? navigator : {}) && (
        <button
          onClick={shareNative}
          className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-muted sm:hidden"
          aria-label="공유하기"
          title="공유하기"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      )}
    </div>
  )
}
