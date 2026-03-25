import Link from "next/link"
import { getCategories } from "@/lib/data"
import { MobileNav } from "./mobile-nav"

export async function Header() {
  const categories = await getCategories()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className="h-7 w-7"
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
          <span>포우포우</span>
        </Link>

        {/* 데스크톱 내비게이션 */}
        <nav className="hidden items-center gap-1 lg:flex">
          {categories.slice(0, 4).map((cat) => (
            <Link
              key={cat.slug}
              href={`/${cat.slug}`}
              className="px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {cat.name}
            </Link>
          ))}
        </nav>

        {/* 모바일 메뉴 */}
        <MobileNav categories={categories} />
      </div>
    </header>
  )
}
