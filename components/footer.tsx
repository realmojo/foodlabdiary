import Link from "next/link"
import { getCategories } from "@/lib/data"

export async function Footer() {
  const categories = await getCategories()

  return (
    <footer className="border-t bg-muted/40">
      {/* 편집 원칙 배너 */}
      <div className="border-b bg-muted/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-foreground">
            수의학적 근거 기반 · 전문가 검수 완료 · 보호자 중심 콘텐츠
          </p>
          <p className="max-w-xl text-xs text-muted-foreground">
            포우포우의 모든 콘텐츠는 수의사 및 반려동물 전문가의 검수를 거쳐
            발행됩니다. 의학적 진단이나 치료를 대체하지 않으며, 정확한 진료는
            담당 수의사와 상담하시기 바랍니다.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* 브랜드 */}
          <div className="sm:col-span-2 lg:col-span-1">
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
              반려동물과 함께하는 더 나은 일상을 위한 정보 매거진.
              수의사, 훈련사, 영양 컨설턴트가 함께 만듭니다.
            </p>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">일반 문의</span>{" "}
                hello@petpawpaw.net
              </p>
              <p>
                <span className="font-medium text-foreground">광고·협업</span>{" "}
                biz@petpawpaw.net
              </p>
            </div>
          </div>

          {/* 카테고리 */}
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

          {/* 서비스 안내 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">서비스</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  소개 · 편집 원칙
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  문의하기
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  전문가 기고 안내
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

        {/* 하단 저작권 및 면책 */}
        <div className="mt-10 space-y-2 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} 포우포우(pawpaw). All rights reserved.</p>
          <p>
            본 사이트의 콘텐츠는 정보 제공 목적으로 작성되었으며 전문적인 수의학적
            진단·처방을 대체하지 않습니다.
          </p>
        </div>
      </div>
    </footer>
  )
}
