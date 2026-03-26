export function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petpawpaw.net"

  const body = `User-Agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml

# LLMs.txt - AI 검색 엔진을 위한 사이트 정보
# https://llmstxt.org
User-Agent: GPTBot
Allow: /

User-Agent: Google-Extended
Allow: /

User-Agent: ChatGPT-User
Allow: /

User-Agent: Claude-Web
Allow: /

User-Agent: PerplexityBot
Allow: /

User-Agent: Applebot-Extended
Allow: /

#DaumWebMasterTool:3db7e4837d0c9aa2a3e6df2bb383f2377a23b05a0f3689939509532dd6ca5fb0:/qlJZVLLsC1mJUlhCsN2iw==
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
