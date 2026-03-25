import type { Metadata } from "next"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "pawpaw 개인정보처리방침",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        시행일: 2026년 3월 25일
      </p>

      <Separator className="my-6" />

      <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
        <section>
          <p>
            pawpaw(이하 "서비스")는 이용자의 개인정보를 중요시하며, 「개인정보
            보호법」 등 관련 법규를 준수합니다. 본 개인정보처리방침을 통해
            이용자의 개인정보가 어떤 용도와 방식으로 이용되고 있으며, 어떤 보호
            조치가 취해지고 있는지 알려드립니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            1. 수집하는 개인정보 항목
          </h2>
          <p>서비스는 다음과 같은 개인정보를 수집할 수 있습니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>문의 시:</strong> 이름, 이메일 주소, 문의 내용
            </li>
            <li>
              <strong>자동 수집:</strong> 접속 IP, 브라우저 종류, 방문 일시,
              서비스 이용 기록, 쿠키
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            2. 개인정보의 수집 및 이용 목적
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>문의에 대한 답변 및 처리</li>
            <li>서비스 개선 및 통계 분석</li>
            <li>불법적 이용 방지</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            3. 개인정보의 보유 및 이용 기간
          </h2>
          <p>
            이용자의 개인정보는 수집 목적이 달성된 후 지체 없이 파기합니다. 단,
            관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
            <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
            <li>웹사이트 방문 기록: 3개월</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            4. 개인정보의 제3자 제공
          </h2>
          <p>
            서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
            다만, 법령에 의해 요구되는 경우 또는 이용자의 사전 동의가 있는
            경우에 한해 예외적으로 제공할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            5. 쿠키의 사용
          </h2>
          <p>
            서비스는 이용자에게 맞춤형 서비스를 제공하기 위해 쿠키를 사용합니다.
            이용자는 브라우저 설정을 통해 쿠키 허용 여부를 선택할 수 있습니다.
            쿠키 저장을 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            6. 개인정보의 안전성 확보 조치
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>개인정보의 암호화 전송 (SSL/TLS)</li>
            <li>해킹 등에 대비한 기술적 대책</li>
            <li>개인정보 접근 권한 최소화</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            7. 이용자의 권리
          </h2>
          <p>
            이용자는 언제든지 자신의 개인정보에 대해 열람, 수정, 삭제를 요청할
            수 있으며, 개인정보 처리에 대한 동의를 철회할 수 있습니다. 관련
            요청은 이메일(hello@petpawpaw.net)로 연락해주세요.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            8. 개인정보 보호책임자
          </h2>
          <ul className="list-none space-y-1">
            <li>담당: pawpaw 운영팀</li>
            <li>이메일: hello@petpawpaw.net</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
