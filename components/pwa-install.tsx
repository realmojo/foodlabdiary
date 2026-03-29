"use client"

import { useEffect, useState, useCallback } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 이미 설치했거나 dismiss한 경우 표시하지 않음
    if (localStorage.getItem("pwa-dismissed")) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  // 10초 후 표시
  useEffect(() => {
    if (!deferredPrompt) return

    const timer = setTimeout(() => setShow(true), 10_000)
    return () => clearTimeout(timer)
  }, [deferredPrompt])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShow(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShow(false)
    setDeferredPrompt(null)
    localStorage.setItem("pwa-dismissed", "1")
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-xl border bg-background p-4 shadow-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          className="h-10 w-10 shrink-0"
          aria-hidden="true"
        >
          <rect width="512" height="512" rx="96" fill="#16A34A" />
          <g transform="translate(256,256)">
            <ellipse cx="0" cy="20" rx="155" ry="145" fill="#FFFFFF" opacity="0.95" />
            <ellipse cx="0" cy="20" rx="120" ry="112" fill="none" stroke="#16A34A" strokeWidth="3" opacity="0.25" />
            <g transform="translate(-90,-140) rotate(25, 90, 140)" fill="#FFFFFF">
              <rect x="82" y="-30" width="5" height="80" rx="2" />
              <rect x="72" y="-30" width="5" height="55" rx="2" />
              <rect x="92" y="-30" width="5" height="55" rx="2" />
              <rect x="70" y="22" width="29" height="8" rx="4" />
              <rect x="82" y="30" width="5" height="50" rx="2" />
            </g>
            <g transform="translate(90,-140) rotate(-25, -90, 140)" fill="#FFFFFF">
              <path d="M-8,-30 Q-8,-30 -4,-30 L2,-30 Q10,-10 10,10 L2,25 -2,25 -2,10 Q-8,0 -8,-30Z" />
              <rect x="-2" y="25" width="5" height="50" rx="2" />
            </g>
            <g transform="translate(0,-15)">
              <path d="M0,-10 Q25,-45 10,-70 Q-5,-50 0,-10Z" fill="#22C55E" opacity="0.8" />
              <path d="M0,-10 Q-20,-50 -5,-72 Q10,-55 0,-10Z" fill="#22C55E" opacity="0.6" />
            </g>
          </g>
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold">푸드랩다이어리 앱 설치</p>
          <p className="text-xs text-muted-foreground">
            홈 화면에 추가하고 더 빠르게 이용하세요
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleInstall}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
          >
            설치
          </button>
          <button
            onClick={handleDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
