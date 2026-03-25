import type { Metadata } from "next"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "이용약관",
  description: "pawpaw 서비스 이용약관",
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        최종 수정일: 2026년 3월 25일
      </p>

      <Separator className="my-6" />

      <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">제1조 (목적)</h2>
          <p>
            이 약관은 pawpaw(이하 "서비스")가 제공하는 인터넷 관련 서비스의 이용과
            관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을
            규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            제2조 (정의)
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>"서비스"란 pawpaw가 제공하는 모든 온라인 콘텐츠 및 관련 서비스를 말합니다.</li>
            <li>"이용자"란 본 약관에 따라 서비스를 이용하는 모든 사용자를 말합니다.</li>
            <li>"콘텐츠"란 서비스에 게시된 글, 이미지, 동영상 등 모든 형태의 정보를 말합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            제3조 (약관의 효력 및 변경)
          </h2>
          <p>
            본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게
            공지함으로써 효력이 발생합니다. 서비스는 관련 법령에 위배되지 않는 범위
            내에서 약관을 변경할 수 있으며, 변경된 약관은 공지 후 효력이 발생합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            제4조 (서비스의 제공)
          </h2>
          <p>서비스는 다음과 같은 업무를 수행합니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>반려동물 관련 정보성 콘텐츠 제공</li>
            <li>기타 서비스가 정하는 업무</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            제5조 (저작권)
          </h2>
          <p>
            서비스에 게시된 모든 콘텐츠의 저작권은 pawpaw 또는 원저작자에게
            있습니다. 이용자는 서비스를 통해 얻은 정보를 서비스의 사전 동의 없이
            상업적으로 이용하거나 제3자에게 제공할 수 없습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            제6조 (면책조항)
          </h2>
          <p>
            서비스에 게시된 정보는 참고 목적으로 제공되며, 전문적인 수의학적 진단이나
            치료를 대체할 수 없습니다. 반려동물의 건강 문제가 의심되는 경우 반드시
            수의사와 상담하시기 바랍니다. 서비스는 콘텐츠의 정확성을 위해 노력하지만,
            이용자가 정보를 활용하여 발생한 결과에 대해 법적 책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            제7조 (이용자의 의무)
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>타인의 개인정보를 침해하는 행위를 하여서는 안 됩니다.</li>
            <li>서비스의 운영을 방해하는 행위를 하여서는 안 됩니다.</li>
            <li>서비스의 콘텐츠를 무단으로 복제, 배포하여서는 안 됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            제8조 (분쟁 해결)
          </h2>
          <p>
            서비스와 이용자 간에 발생한 분쟁은 대한민국 법률에 따라 해결하며,
            관할 법원은 서비스 본사 소재지를 관할하는 법원으로 합니다.
          </p>
        </section>
      </div>
    </div>
  )
}
