import { getCategories } from "@/lib/data"

export async function Footer() {
  const categories = await getCategories()

  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* 상단: 브랜드 + 링크 그리드 */}
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr_auto_auto]">
          {/* 브랜드 */}
          <div>
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
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              건강한 식생활을 위한 영양·식단 정보 매거진.<br />
              신뢰할 수 있는 자료를 기반으로 올바른 식습관을 안내합니다.
            </p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">문의</span>{" "}
                <a href="mailto:strikers1999@kakao.com" className="underline hover:text-foreground">
                  strikers1999@kakao.com
                </a>
              </p>
            </div>
          </div>

          {/* 카테고리 — 모바일: 가로 칩, 데스크톱: 세로 리스트 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">카테고리</h3>
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-2">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <a
                    href={`/${cat.slug}`}
                    className="inline-block rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:rounded-none lg:border-0 lg:px-0 lg:py-0 lg:text-sm"
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">서비스</h3>
            <ul className="space-y-2">
              <li>
                <a href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  소개
                </a>
              </li>
              <li>
                <a href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  문의하기
                </a>
              </li>
            </ul>
          </div>

          {/* 법적 고지 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">법적 고지</h3>
            <ul className="space-y-2">
              <li>
                <a href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  이용약관
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  개인정보처리방침
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 사업자 정보 & 저작권 */}
        <div className="mt-10 border-t pt-6 text-xs text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <p>
              <span className="font-medium text-foreground">상호명:</span> 모조데이 |{" "}
              <span className="font-medium text-foreground">대표:</span> 정만경 |{" "}
              <span className="font-medium text-foreground">사업자등록번호:</span> 259-13-02051
            </p>
            <p>
              <span className="font-medium text-foreground">주소:</span> 서울시 영등포구 선유로 71, 102동 602호 |{" "}
              <span className="font-medium text-foreground">이메일:</span>{" "}
              <a href="mailto:strikers1999@kakao.com" className="underline hover:text-foreground">
                strikers1999@kakao.com
              </a>
            </p>
            <p className="mt-3">&copy; {new Date().getFullYear()} 푸드랩다이어리(foodlabdiary). All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
