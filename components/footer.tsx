import Link from "next/link"
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
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              반려동물과 함께하는 더 나은 일상을 위한 정보 매거진.<br />
              수의학·영양학 자료를 기반으로 신뢰할 수 있는 콘텐츠를 제공합니다.
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
                  <Link
                    href={`/${cat.slug}`}
                    className="inline-block rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:rounded-none lg:border-0 lg:px-0 lg:py-0 lg:text-sm"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">서비스</h3>
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
            </ul>
          </div>

          {/* 법적 고지 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">법적 고지</h3>
            <ul className="space-y-2">
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
            <p className="mt-3">&copy; {new Date().getFullYear()} 포우포우(pawpaw). All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
