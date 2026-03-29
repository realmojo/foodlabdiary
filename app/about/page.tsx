import type { Metadata } from "next"
import { Utensils, Heart, Users, BookOpen } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "소개",
  description: "푸드랩다이어리는 건강한 식생활을 위한 영양·식단 정보 매거진입니다.",
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center gap-3">
        <Utensils className="h-8 w-8" />
        <h1 className="text-2xl font-bold">푸드랩다이어리 소개</h1>
      </div>

      <Separator className="my-6" />

      <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
        <section>
          <p>
            푸드랩다이어리는 건강한 식생활을 위해 만들어진 영양·식단 정보
            매거진입니다. 건강 관리, 식단 구성, 영양소 분석 등
            신뢰할 수 있는 정보를 제공합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <Heart className="h-5 w-5" />
            우리의 미션
          </h2>
          <p>
            모든 사람이 올바른 식습관을 통해 건강한 삶을 영위할 수 있도록,
            정확하고 실용적인 정보를 전달하는 것이 푸드랩다이어리의 목표입니다.
            인터넷에 떠도는 검증되지 않은 정보 대신, 영양학적 근거와 전문가의
            조언을 바탕으로 한 콘텐츠를 만들어갑니다.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <Users className="h-5 w-5" />
            우리 팀
          </h2>
          <p>
            푸드랩다이어리 팀은 편집자, 에디터, 기자들로 구성되어 있습니다.
            다양한 취재와 조사를 바탕으로 독자들이 실생활에서 바로 적용할 수
            있는 실질적인 정보를 전달합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <BookOpen className="h-5 w-5" />
            콘텐츠 원칙
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>영양학적 근거를 기반으로 한 정확한 정보 제공</li>
            <li>전문가 검수를 거친 신뢰할 수 있는 콘텐츠</li>
            <li>누구나 쉽게 이해하고 실천할 수 있는 실용적 가이드</li>
            <li>독자의 건강을 최우선으로 고려하는 편집 방향</li>
          </ul>
        </section>

        <section>
          <p>
            푸드랩다이어리와 함께 더 건강하고 균형 잡힌 식생활을 만들어보세요.
            궁금한 점이나 제안 사항이 있다면 언제든지{" "}
            <a href="/contact" className="font-medium text-foreground underline">
              문의하기
            </a>
            를 통해 연락해주세요.
          </p>
        </section>
      </div>
    </div>
  )
}
