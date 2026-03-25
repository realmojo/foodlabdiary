import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Clock, User, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PostCard } from "@/components/post-card"
import { BlockRenderer } from "@/components/block-renderer"
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/json-ld"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import {
  getCategories,
  getCategoryBySlug,
  getPostsByCategory,
  getPostBySlug,
  getRelatedPosts,
  getPosts,
  getAllPostSlugs,
  getAllCategorySlugs,
} from "@/lib/data"
import type { Post, Category } from "@/lib/data"

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const [categorySlugs, postSlugs] = await Promise.all([
    getAllCategorySlugs(),
    getAllPostSlugs(),
  ])
  return [...categorySlugs, ...postSlugs].map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petpawpaw.net"

  const category = await getCategoryBySlug(slug)
  if (category) {
    return {
      title: category.name,
      description: category.description ?? undefined,
      alternates: { canonical: `/${slug}` },
      openGraph: {
        title: `${category.name} - 포우포우`,
        description: category.description ?? undefined,
        url: `${siteUrl}/${slug}`,
        type: "website",
      },
    }
  }

  const post = await getPostBySlug(slug)
  if (post) {
    return {
      title: post.title,
      description: post.excerpt ?? undefined,
      alternates: { canonical: `/${slug}` },
      openGraph: {
        title: post.title,
        description: post.excerpt ?? undefined,
        url: `${siteUrl}/${slug}`,
        type: "article",
        publishedTime: post.published_at ?? undefined,
        authors: post.author?.name ? [post.author.name] : undefined,
        images: post.featured_image_url ? [post.featured_image_url] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description: post.excerpt ?? undefined,
        images: post.featured_image_url ? [post.featured_image_url] : undefined,
      },
    }
  }

  return {}
}

export default async function SlugPage({ params }: Props) {
  const { slug } = await params

  // 1) Check if it's a category
  const category = await getCategoryBySlug(slug)
  if (category) {
    return <CategoryView slug={slug} />
  }

  // 2) Check if it's a post
  const post = await getPostBySlug(slug)
  if (post) {
    return <PostView post={post} />
  }

  notFound()
}

// ---- Category View ----

async function CategoryView({ slug }: { slug: string }) {
  const [category, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
  ])

  if (!category) notFound()

  const categoryPosts = await getPostsByCategory(category.id)

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          홈으로
        </Link>
      </div>

      <section className="pb-8">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{category.emoji}</span>
          <div>
            <h1 className="text-2xl font-bold">{category.name}</h1>
            <p className="mt-1 text-muted-foreground">{category.description}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          총 {categoryPosts.length}개의 포스트
        </p>
      </section>

      <Separator />

      <section className="py-8">
        {categoryPosts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            아직 작성된 포스트가 없습니다.
          </p>
        )}
      </section>

      <Separator />

      <section className="py-8">
        <h2 className="mb-4 text-sm font-semibold">다른 카테고리</h2>
        <div className="flex flex-wrap gap-2">
          {categories
            .filter((c) => c.slug !== slug)
            .map((cat) => (
              <Link
                key={cat.slug}
                href={`/${cat.slug}`}
                className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                {cat.emoji} {cat.name}
              </Link>
            ))}
        </div>
      </section>
    </div>
  )
}

// ---- Sidebar Components ----

function SidebarPostItem({ post }: { post: Post }) {
  return (
    <Link
      href={`/${post.slug}`}
      className="group flex gap-3 py-3 first:pt-0 last:pb-0"
    >
      <div className="relative h-16 w-20 shrink-0 overflow-hidden bg-muted">
        {post.featured_image_url && (
          <Image
            src={post.featured_image_url}
            alt={post.title}
            fill
            className="object-cover"
            sizes="80px"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center">
        <h3 className="line-clamp-2 text-xs leading-snug font-semibold group-hover:underline">
          {post.title}
        </h3>
        {post.published_at && (
          <span className="mt-1 text-[11px] text-muted-foreground">
            {new Date(post.published_at).toLocaleDateString("ko-KR")}
          </span>
        )}
      </div>
    </Link>
  )
}

function Sidebar({ recentPosts }: { recentPosts: Post[] }) {
  return (
    <aside>
      {recentPosts.length > 0 && (
        <div>
          <div className="mb-4 inline-block bg-foreground px-3 py-1 text-sm font-bold text-background">
            최근 포스팅
          </div>
          <div className="divide-y">
            {recentPosts.map((p) => (
              <SidebarPostItem key={p.slug} post={p} />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

// ---- Post View ----

async function PostView({
  post,
}: {
  post: NonNullable<Awaited<ReturnType<typeof getPostBySlug>>>
}) {
  const primaryCategory = post.primary_category
  const [relatedPosts, recentPosts] = await Promise.all([
    getRelatedPosts(post.id, post.primary_category_id),
    getPosts(10),
  ])

  // 사이드바 인기글에서 현재 글 제외
  const sidebarPosts = recentPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 4)

  const breadcrumbItems = [
    { name: "홈", href: "/" },
    ...(primaryCategory
      ? [{ name: primaryCategory.name, href: `/${primaryCategory.slug}` }]
      : []),
    { name: post.title, href: `/${post.slug}` },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4">
      <ArticleJsonLd post={post} />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="py-4">
        <Link
          href={primaryCategory ? `/${primaryCategory.slug}` : "/"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {primaryCategory ? primaryCategory.name : "홈으로"}
        </Link>
      </div>

      {/* PC: 본문 + 사이드바 / 모바일: 본문 → 사이드바 */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
        {/* 본문 */}
        <article className="min-w-0 pb-12">
          <div className="mb-3 flex flex-wrap gap-2">
            {post.categories?.map((cat) => (
              <Link key={cat.slug} href={`/${cat.slug}`}>
                <Badge variant="secondary">
                  {cat.emoji} {cat.name}
                </Badge>
              </Link>
            ))}
          </div>

          <header className="pb-6">
            <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
              {post.title}
            </h1>
            <p className="mt-3 text-muted-foreground">{post.excerpt}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              {post.author && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {post.author.name}
                </span>
              )}
              {post.published_at && (
                <span>
                  {new Date(post.published_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
              {post.read_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {post.read_time} 읽기
                </span>
              )}
            </div>
          </header>

          <Separator />

          <div className="py-6 text-[16px] sm:text-[17px]">
            <BlockRenderer blocks={post.content} />
          </div>

          <Separator />

          <div className="flex items-center gap-2 py-6">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {post.categories?.map((cat) => (
              <Link key={cat.slug} href={`/${cat.slug}`}>
                <Badge variant="outline">{cat.name}</Badge>
              </Link>
            ))}
          </div>
        </article>

        {/* 사이드바 (PC: 오른쪽 고정, 모바일: 본문 아래) */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Sidebar recentPosts={sidebarPosts} />
        </div>
      </div>

      {/* 관련 포스트 (전체 너비) */}
      {relatedPosts.length > 0 && (
        <>
          <Separator />
          <section className="py-10">
            <h2 className="mb-6 text-lg font-bold">관련 포스트</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((rp) => (
                <PostCard key={rp.slug} post={rp} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
