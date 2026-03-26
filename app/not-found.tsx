import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
      <span className="text-6xl">🐾</span>
      <h1 className="mt-4 text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-muted-foreground">
        요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
