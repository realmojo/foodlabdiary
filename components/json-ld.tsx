import type { Post, Category, ContentBlock } from "@/lib/data"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://foodlabdiary.com"

const PUBLISHER = {
  "@type": "Organization" as const,
  "@id": `${SITE_URL}/#organization`,
  name: "푸드랩다이어리",
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
        name: "푸드랩다이어리",
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
        name: "푸드랩다이어리",
        url: SITE_URL,
        description:
          "건강한 식생활을 위한 영양·식단 정보 매거진",
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
    description: post.content?.find((b: ContentBlock) => b.type === "paragraph")?.text?.replace(/<[^>]*>/g, ""),
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
      "건강",
      "식단",
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

export function CollectionJsonLd({
  name,
  description,
  slug,
  posts,
}: {
  name: string
  description: string | null
  slug: string
  posts: Post[]
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/${slug}/#collection`,
    name,
    description: description ?? undefined,
    url: `${SITE_URL}/${slug}`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.slice(0, 20).map((post, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/${post.slug}`,
        name: post.title,
      })),
    },
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
