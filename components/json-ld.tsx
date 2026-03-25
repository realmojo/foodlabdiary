import type { Post, Category, ContentBlock } from "@/lib/data"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://petpawpaw.net"

const PUBLISHER = {
  "@type": "Organization" as const,
  "@id": `${SITE_URL}/#organization`,
  name: "포우포우",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject" as const,
    "@id": `${SITE_URL}/#logo`,
    url: `${SITE_URL}/icon.svg`,
    width: 512,
    height: 512,
  },
  sameAs: [],
}

export function WebsiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "포우포우",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          "@id": `${SITE_URL}/#logo`,
          url: `${SITE_URL}/icon.svg`,
          width: 512,
          height: 512,
        },
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "포우포우",
        url: SITE_URL,
        description:
          "강아지, 고양이, 반려동물과 함께하는 더 나은 일상을 위한 정보 매거진",
        inLanguage: "ko-KR",
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/?s={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function ArticleJsonLd({ post }: { post: Post }) {
  const sections = post.content
    .filter((b: ContentBlock) => b.type === "heading" && b.text)
    .map((b: ContentBlock) => b.text!)

  const postUrl = `${SITE_URL}/${post.slug}`

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${postUrl}/#article`,
    headline: post.title,
    description: post.excerpt?.replace(/<[^>]*>/g, ""),
    url: postUrl,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    image: post.featured_image_url
      ? {
          "@type": "ImageObject",
          url: post.featured_image_url,
        }
      : undefined,
    author: post.author
      ? {
          "@type": "Person",
          name: post.author.name,
        }
      : undefined,
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    articleSection: post.primary_category?.name,
    inLanguage: "ko-KR",
    wordCount: post.content
      .filter((b: ContentBlock) => b.type === "paragraph" && b.text)
      .reduce((sum: number, b: ContentBlock) => sum + (b.text?.length ?? 0), 0),
    keywords: [...new Set([
      post.primary_category?.name,
      ...(post.categories?.map((c) => c.name) ?? []),
      "반려동물",
    ].filter(Boolean))].join(", "),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["article h1", "article header p"],
    },
    about: sections.map((s) => ({
      "@type": "Thing",
      name: s,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function FAQJsonLd({
  items,
}: {
  items: { question: string; answer: string }[]
}) {
  if (items.length === 0) return null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; href: string }[]
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
