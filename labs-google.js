import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import path from "path"

const stealth = StealthPlugin()

chromium.use(stealth)
;(async () => {
  const userDataDir = path.join(process.cwd(), "gemini-auth-session")

  console.log("🚀 Launching Chrome for manual login...")
  console.log("Note: This script tries to use your system Google Chrome.")

  try {
    // 1. 브라우저 실행
    // launchPersistentContext: 프로필(쿠키, 스토리지)을 userDataDir에 저장하며 실행
    // channel: "chrome": 번들된 Chromium 대신 설치된 정식 Chrome 사용 (봇 탐지 회피에 유리)
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
        "--disable-blink-features=AutomationControlled", // 중요: 자동화 제어 흔적 제거
      ],
      ignoreDefaultArgs: ["--enable-automation"], // "자동화된 소프트웨어..." 알림바 제거
      viewport: null, // 창 크기를 브라우저 기본값으로
    })

    const page =
      context.pages().length > 0 ? context.pages()[0] : await context.newPage()

    // WebDriver 속성 숨기기 (Stealth 플러그인이 해주지만 이중 안전장치)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      })
    })

    console.log("Navigating to Gemini Login page...")
    await page.goto("https://labs.google/fx/ko/tools/flow")

    console.log("\n⚠️  [ACTION REQUIRED] ⚠️")
    console.log("브라우저에서 구글 로그인을 진행해주세요.")
    console.log(
      "2단계 인증 등 모든 절차를 완료하고 Gemini 메인 화면이 나올 때까지 기다리세요."
    )
    console.log(
      "로그인이 완료되어도 창을 닫지 마세요! 시간이 되면 자동으로 저장하고 종료합니다."
    )
    console.log(
      "----------------------------------------------------------------"
    )

    // 3분 대기 (로그인 시간 충분히 확보)
    const waitTimeSeconds = 180
    for (let i = 0; i < waitTimeSeconds / 10; i++) {
      // 사용자가 실수로 브라우저를 닫았는지 확인
      if (context.pages().length === 0) {
        console.log("Browser closed by user manually.")
        break
      }
      await page.waitForTimeout(10000)
      const remaining = waitTimeSeconds - (i + 1) * 10
      console.log(
        `⏳ ... ${remaining}초 남음 (로그인 완료 후 계속 기다려주세요)`
      )
    }

    console.log("\n💾 Saving auth state to gemini-auth.json...")
    await context.storageState({ path: "gemini-auth.json" })

    console.log("✅ Auth state saved successfully!")
    console.log("Closing browser...")
    await context.close()
  } catch (e) {
    console.error("❌ Error:", e)
    console.log(
      "만약 'Executable doesn't exist' 에러라면 Chrome이 설치되어 있는지 확인하거나 channel 옵션을 지워보세요."
    )
  }
})()
