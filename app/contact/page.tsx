import type { Metadata } from "next"
import { Mail, Clock, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { FAQJsonLd } from "@/components/json-ld"

export const metadata: Metadata = {
  title: "문의하기",
  description: "pawpaw에 문의사항, 제안, 광고 협업 등을 보내주세요.",
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <FAQJsonLd
        items={[
          {
            question: "콘텐츠에 오류가 있어요. 어떻게 제보하나요?",
            answer:
              "hello@petpawpaw.net으로 해당 글의 URL과 함께 수정이 필요한 내용을 보내주시면 확인 후 빠르게 반영하겠습니다.",
          },
          {
            question: "기고를 하고 싶은데 어떻게 하나요?",
            answer:
              "수의사, 훈련사, 반려동물 전문가분들의 기고를 환영합니다. biz@petpawpaw.net으로 간단한 자기소개와 기고 주제를 보내주세요.",
          },
          {
            question: "콘텐츠를 다른 곳에 퍼가도 되나요?",
            answer:
              "포우포우의 콘텐츠는 저작권으로 보호됩니다. 출처를 명확히 밝히고 원문 링크를 포함하는 경우 일부 인용이 가능합니다. 전문 게재를 원하시면 사전에 문의해주세요.",
          },
        ]}
      />
      <h1 className="text-2xl font-bold">문의하기</h1>
      <p className="mt-2 text-muted-foreground">
        궁금한 점이나 제안사항이 있으시면 아래 방법으로 연락해주세요.
      </p>

      <Separator className="my-6" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">이메일 문의</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                일반 문의, 콘텐츠 제안, 오류 제보
              </p>
              <p className="mt-2 text-sm font-medium">hello@petpawpaw.net</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">광고 및 협업</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                광고 게재, 브랜드 협업, 기고 제안
              </p>
              <p className="mt-2 text-sm font-medium">biz@petpawpaw.net</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="flex items-start gap-4 p-6">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">운영 시간</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              평일 오전 10:00 ~ 오후 6:00 (주말 및 공휴일 휴무)
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              이메일 문의는 영업일 기준 1~2일 내에 답변드립니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <div className="text-sm text-muted-foreground">
        <h2 className="mb-3 text-base font-bold text-foreground">
          자주 묻는 질문
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">
              콘텐츠에 오류가 있어요. 어떻게 제보하나요?
            </h3>
            <p className="mt-1">
              hello@petpawpaw.net로 해당 글의 URL과 함께 수정이 필요한 내용을
              보내주시면 확인 후 빠르게 반영하겠습니다.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              기고를 하고 싶은데 어떻게 하나요?
            </h3>
            <p className="mt-1">
              수의사, 훈련사, 반려동물 전문가분들의 기고를 환영합니다.
              biz@petpawpaw.net로 간단한 자기소개와 기고 주제를 보내주세요.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              콘텐츠를 다른 곳에 퍼가도 되나요?
            </h3>
            <p className="mt-1">
              pawpaw의 콘텐츠는 저작권으로 보호됩니다. 출처를 명확히 밝히고 원문
              링크를 포함하는 경우 일부 인용이 가능합니다. 전문 게재를 원하시면
              사전에 문의해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
