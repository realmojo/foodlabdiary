import Link from "next/link"
import { PawPrint } from "lucide-react"
import { getCategories } from "@/lib/data"

export async function Footer() {
  const categories = await getCategories()

  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <PawPrint className="h-5 w-5" />
              <span>pawpaw</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              반려동물과 함께하는 더 나은 일상을 위한 정보를 제공합니다.
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">카테고리</h3>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/${cat.slug}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {cat.emoji} {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">안내</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  소개
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  문의하기
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  개인정보처리방침
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          &copy; 2026 pawpaw. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
