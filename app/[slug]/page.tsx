import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { Clock, User, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  const category = await getCategoryBySlug(slug)

  if (!category) notFound()

  const categoryPosts = await getPostsByCategory(category.id)

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <BreadcrumbJsonLd items={[
        { name: "홈", href: "/" },
        { name: category.name, href: `/${slug}` },
      ]} />

      {/* 카테고리 헤더 */}
      <section className="py-6">
        <h1 className="text-xl font-bold">{category.emoji} {category.name}</h1>
        {category.description && (
          <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          총 {categoryPosts.length}개의 포스트
        </p>
      </section>

      {/* 포스트 목록 */}
      <section className="pb-8">
        {categoryPosts.length > 0 ? (
          <div className="divide-y">
            {categoryPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/${post.slug}`}
                className="group flex gap-4 py-4"
              >
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded bg-muted sm:h-24 sm:w-36">
                  {post.featured_image_url && (
                    <Image
                      src={post.featured_image_url}
                      alt={post.title}
                      fill
                      className="object-cover"
                      sizes="144px"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-col justify-center">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline sm:text-base">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-1 hidden text-sm text-muted-foreground line-clamp-1 sm:block">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {post.author && <span>{post.author.name}</span>}
                    {post.published_at && (
                      <span>
                        {new Date(post.published_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                    {post.read_time && <span>{post.read_time} 읽기</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            아직 작성된 포스트가 없습니다.
          </p>
        )}
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
    getRelatedPosts(post.id, post.primary_category_id, 6),
    getPosts(20),
  ])

  // 사이드바 인기글에서 현재 글 제외
  const sidebarPosts = recentPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 4)

  // 추천 콘텐츠: 같은 카테고리 우선, 부족하면 최근 글로 채움 (최대 6개)
  const relatedSlugs = new Set(relatedPosts.map((p) => p.slug))
  const extraPosts = recentPosts.filter(
    (p) => p.slug !== post.slug && !relatedSlugs.has(p.slug)
  )
  const recommendedPosts = [...relatedPosts, ...extraPosts].slice(0, 6)

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

      {/* 추천 콘텐츠 */}
      {recommendedPosts.length > 0 && (
        <>
          <Separator />
          <section className="py-10">
            <h2 className="mb-6 text-lg font-bold">추천 콘텐츠</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {recommendedPosts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/${rp.slug}`}
                  className="group flex gap-4 rounded-md border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded bg-muted sm:h-28 sm:w-40">
                    {rp.featured_image_url && (
                      <Image
                        src={rp.featured_image_url}
                        alt={rp.title}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col justify-center">
                    {rp.primary_category && (
                      <span className="mb-1 text-xs text-muted-foreground">
                        {rp.primary_category.emoji} {rp.primary_category.name}
                      </span>
                    )}
                    <h3 className="line-clamp-2 text-sm leading-snug font-semibold group-hover:underline">
                      {rp.title}
                    </h3>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {rp.published_at &&
                        new Date(rp.published_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
