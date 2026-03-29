import { getCategories } from "@/lib/data"
import { MobileNav } from "./mobile-nav"

export async function Header() {
  const categories = await getCategories()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className="h-7 w-7"
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
          <span>푸드랩다이어리</span>
        </a>

        {/* 데스크톱 내비게이션 */}
        <nav className="hidden items-center gap-1 lg:flex">
          {categories.slice(0, 4).map((cat) => (
            <a
              key={cat.slug}
              href={`/${cat.slug}`}
              className="px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {cat.name}
            </a>
          ))}
        </nav>

        {/* 모바일 메뉴 */}
        <MobileNav categories={categories} />
      </div>
    </header>
  )
}

