import type { Metadata } from "next"
import { PawPrint, Heart, Users, BookOpen } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "소개",
  description: "pawpaw는 반려동물과 함께하는 더 나은 일상을 위한 정보 매거진입니다.",
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center gap-3">
        <PawPrint className="h-8 w-8" />
        <h1 className="text-2xl font-bold">pawpaw 소개</h1>
      </div>

      <Separator className="my-6" />

      <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
        <section>
          <p>
            pawpaw는 반려동물과 함께하는 더 나은 일상을 위해 만들어진 반려동물 정보
            매거진입니다. 강아지, 고양이를 비롯한 다양한 반려동물의 건강, 훈련, 영양,
            라이프스타일에 관한 신뢰할 수 있는 정보를 제공합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <Heart className="h-5 w-5" />
            우리의 미션
          </h2>
          <p>
            모든 반려동물이 건강하고 행복한 삶을 살 수 있도록, 보호자에게 정확하고
            실용적인 정보를 전달하는 것이 pawpaw의 목표입니다. 인터넷에 떠도는
            검증되지 않은 정보 대신, 수의학적 근거와 전문가의 조언을 바탕으로 한
            콘텐츠를 만들어갑니다.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <Users className="h-5 w-5" />
            우리 팀
          </h2>
          <p>
            pawpaw 팀은 수의사, 반려동물 훈련 전문가, 영양 컨설턴트, 그리고 무엇보다
            반려동물을 사랑하는 에디터들로 구성되어 있습니다. 각 분야의 전문성을
            바탕으로 보호자들이 실생활에서 바로 적용할 수 있는 실질적인 정보를
            전달합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <BookOpen className="h-5 w-5" />
            콘텐츠 원칙
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>수의학적 근거를 기반으로 한 정확한 정보 제공</li>
            <li>전문가 검수를 거친 신뢰할 수 있는 콘텐츠</li>
            <li>보호자가 쉽게 이해하고 실천할 수 있는 실용적 가이드</li>
            <li>반려동물의 복지를 최우선으로 고려하는 편집 방향</li>
          </ul>
        </section>

        <section>
          <p>
            pawpaw와 함께 반려동물과의 일상을 더 건강하고 풍요롭게 만들어보세요.
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
