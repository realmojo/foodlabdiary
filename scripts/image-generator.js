import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import path from "path"

const stealth = StealthPlugin()
chromium.use(stealth)

const url =
  "https://labs.google/fx/ko/tools/flow/project/2bd14e8f-06b8-4839-8492-9df6f09cab0a"

const authFile = path.join(process.cwd(), "scripts", "gemini-auth.json")

;(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  })

  const context = await browser.newContext({
    storageState: authFile,
    viewport: null,
  })

  const page = await context.newPage()

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })
  })

  const prompt =
    "A realistic photo of a warm cup of burdock tea with steam rising, dried burdock roots placed next to the cup on a dark stone coaster, warm and cozy atmosphere, high detail."

  console.log("Opening:", url)
  await page.goto(url, { waitUntil: "domcontentloaded" })

  // 0. 쿠키 동의 배너가 있으면 "동의함" 클릭
  const cookieAccept = page.locator("button.glue-cookie-notification-bar__accept")
  try {
    await cookieAccept.waitFor({ state: "visible", timeout: 3000 })
    await cookieAccept.click()
    console.log("Clicked cookie accept.")
  } catch {
    // 배너가 없으면 무시
  }

  // 1. "Nano Banana" 드롭다운 버튼 클릭
  const nanoBananaBtn = page.locator('button:has-text("Nano Banana")')
  await nanoBananaBtn.waitFor({ state: "visible", timeout: 15000 })
  await nanoBananaBtn.click()
  console.log("Clicked Nano Banana dropdown.")
  await page.waitForTimeout(1000)

  // 2. "x1" 탭 클릭
  const x1Tab = page.locator('button[role="tab"]:has-text("x1")')
  await x1Tab.waitFor({ state: "visible", timeout: 5000 })
  await x1Tab.click()
  console.log("Clicked x1 tab.")
  await page.waitForTimeout(500)

  // 2-1. 모달 닫기: body 클릭
  await page.locator("body").click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(500)

  // 3. Slate 에디터 입력란 대기 후 클릭 & 프롬프트 입력
  const editor = page.locator('[data-slate-editor="true"]')
  await editor.waitFor({ state: "visible", timeout: 15000 })
  await editor.click()
  await page.keyboard.type(prompt, { delay: 10 })
  await page.keyboard.press("Enter")

  console.log("Prompt submitted. Waiting for image generation...")

  // 4. 기존 이미지 src 목록 기록
  const allImages = page.locator('img[alt="생성된 이미지"]')
  const existingSrcs = new Set()
  const existingCount = await allImages.count()
  for (let i = 0; i < existingCount; i++) {
    const src = await allImages.nth(i).getAttribute("src")
    existingSrcs.add(src)
  }
  console.log(`Existing images: ${existingCount}`)

  // 새 이미지가 추가될 때까지 폴링 (최대 2분)
  const timeout = 120000
  const start = Date.now()
  let newImgSrc = null
  while (!newImgSrc) {
    if (Date.now() - start > timeout) throw new Error("Image generation timed out")
    await page.waitForTimeout(3000)
    const currentCount = await allImages.count()
    console.log(`Waiting... images: ${currentCount}`)
    for (let i = 0; i < currentCount; i++) {
      const src = await allImages.nth(i).getAttribute("src")
      if (!existingSrcs.has(src)) {
        newImgSrc = src
        break
      }
    }
  }
  // 생성 완료 후 렌더링 안정화 대기
  await page.waitForTimeout(2000)
  console.log("Image generated!")

  // 5. 새로 생성된 이미지 URL 추출
  const imageUrl = newImgSrc.startsWith("http") ? newImgSrc : `https://labs.google${newImgSrc}`
  console.log("Image URL:", imageUrl)

  // 6. 브라우저 컨텍스트로 이미지 다운로드 (쿠키/리다이렉트 자동 처리)
  const response = await page.request.get(imageUrl)
  const rawBuffer = Buffer.from(await response.body())
  console.log(`Downloaded: ${rawBuffer.length} bytes`)

  // 7. sharp로 webp 변환
  const webpBuffer = await sharp(rawBuffer).webp({ quality: 85 }).toBuffer()
  console.log(`Converted to webp: ${webpBuffer.length} bytes`)

  // 8. S3 업로드
  const s3 = new S3Client({
    region: process.env.AWS_REGION || "ap-northeast-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })

  const BUCKET = "foodlabdiary"
  const now = new Date()
  const key = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/generated-${Date.now()}.webp`

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: webpBuffer,
      ContentType: "image/webp",
    }),
  )

  const s3Url = `https://${BUCKET}.s3.ap-northeast-2.amazonaws.com/${key}`
  console.log("Uploaded to S3:", s3Url)

  // 9. 생성된 이미지를 Ctrl+Click하여 컨텍스트 메뉴(드롭다운) 열기
  const targetImg = page.locator(`img[src="${newImgSrc}"]`).first()
  await targetImg.waitFor({ state: "visible", timeout: 5000 })

  // Ctrl + Click (macOS에서는 Meta + Click이 아닌 Control + Click)
  await targetImg.click({ modifiers: ["Control"] })
  console.log("Ctrl+Clicked on generated image.")
  await page.waitForTimeout(1000)

  // 10. 드롭다운 메뉴에서 삭제 버튼 클릭
  const deleteBtn = page.getByRole("menuitem", { name: /삭제|delete|제거|Remove/i })
  try {
    await deleteBtn.waitFor({ state: "visible", timeout: 5000 })
    await deleteBtn.click()
    console.log("Clicked delete button in dropdown menu.")
  } catch {
    // menuitem으로 못 찾으면 텍스트 기반으로 재시도
    console.log("Trying alternative selector for delete button...")
    const altDeleteBtn = page.locator('button:has-text("삭제"), [role="menuitem"]:has-text("삭제"), button:has-text("Delete")')
    await altDeleteBtn.first().waitFor({ state: "visible", timeout: 5000 })
    await altDeleteBtn.first().click()
    console.log("Clicked delete button (alternative selector).")
  }
  await page.waitForTimeout(1000)

  await context.close()
  await browser.close()
})()
