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
          <rect width="512" height="512" rx="96" fill="#F59E0B" />
          <g fill="#FFFFFF">
            <ellipse cx="256" cy="320" rx="100" ry="85" />
            <ellipse cx="145" cy="195" rx="45" ry="55" transform="rotate(-15 145 195)" />
            <ellipse cx="200" cy="160" rx="40" ry="50" transform="rotate(-5 200 160)" />
            <ellipse cx="312" cy="160" rx="40" ry="50" transform="rotate(5 312 160)" />
            <ellipse cx="367" cy="195" rx="45" ry="55" transform="rotate(15 367 195)" />
          </g>
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold">포우포우 앱 설치</p>
          <p className="text-xs text-muted-foreground">
            홈 화면에 추가하고 더 빠르게 이용하세요
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={handleInstall}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
          >
            설치
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
