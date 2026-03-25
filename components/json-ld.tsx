import type { Post, Category, ContentBlock } from "@/lib/data"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://petpawpaw.net"

const PUBLISHER = {
  "@type": "Organization" as const,
  name: "포우포우",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject" as const,
    url: `${SITE_URL}/icon.svg`,
  },
  sameAs: [],
}

export function WebsiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "포우포우",
    url: SITE_URL,
    description:
      "강아지, 고양이, 반려동물과 함께하는 더 나은 일상을 위한 정보 매거진",
    inLanguage: "ko-KR",
    publisher: PUBLISHER,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    url: `${SITE_URL}/${post.slug}`,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    image: post.featured_image_url || undefined,
    author: post.author
      ? {
          "@type": "Person",
          name: post.author.name,
        }
      : undefined,
    publisher: PUBLISHER,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/${post.slug}`,
    },
    articleSection: post.primary_category?.name,
    inLanguage: "ko-KR",
    keywords: [
      post.primary_category?.name,
      ...(post.categories?.map((c) => c.name) ?? []),
      "반려동물",
    ]
      .filter(Boolean)
      .join(", "),
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
