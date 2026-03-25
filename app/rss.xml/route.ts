import { getPosts } from "@/lib/data"

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petpawpaw.net"
  const posts = await getPosts(50)

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/${post.slug}</link>
      <guid isPermaLink="true">${siteUrl}/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || "")}</description>
      <pubDate>${post.published_at ? new Date(post.published_at).toUTCString() : ""}</pubDate>
      ${post.primary_category ? `<category>${escapeXml(post.primary_category.name)}</category>` : ""}
      ${post.author ? `<dc:creator>${escapeXml(post.author.name)}</dc:creator>` : ""}
    </item>`
    )
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>포우포우 - 반려동물 정보 매거진</title>
    <link>${siteUrl}</link>
    <description>강아지, 고양이, 반려동물과 함께하는 더 나은 일상을 위한 정보 매거진</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
