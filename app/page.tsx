import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WebsiteJsonLd } from "@/components/json-ld"
import { getCategories, getPosts } from "@/lib/data"
import type { Post } from "@/lib/data"

export const revalidate = 60

function formatDate(dateStr: string | null) {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function HeroCard({
  post,
  size,
}: {
  post: Post
  size: "large" | "medium" | "small"
}) {
  const heightClass =
    size === "large"
      ? "row-span-2 min-h-[480px]"
      : size === "medium"
        ? "min-h-[280px]"
        : "min-h-[200px]"

  return (
    <a
      href={`/${post.slug}`}
      className={`group relative flex flex-col justify-end overflow-hidden bg-muted ${heightClass}`}
    >
      {post.featured_image_url && (
        <Image
          src={post.featured_image_url}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes={size === "large" ? "50vw" : size === "medium" ? "50vw" : "25vw"}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="relative p-4">
        {post.primary_category && (
          <span className="mb-2 inline-block bg-white/90 px-2 py-0.5 text-xs font-semibold text-black">
            {post.primary_category.name}
          </span>
        )}
        <h2
          className={`font-bold leading-tight text-white ${
            size === "large"
              ? "text-xl sm:text-2xl"
              : size === "medium"
                ? "text-lg"
                : "text-sm"
          }`}
        >
          {post.title}
        </h2>
        {size === "large" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
            <span>{formatDate(post.published_at)}</span>
          </div>
        )}
      </div>
    </a>
  )
}

function PostListItem({ post }: { post: Post }) {
  return (
    <a
      href={`/${post.slug}`}
      className="group flex gap-4 py-3 first:pt-0 last:pb-0"
    >
      <div className="relative h-20 w-28 shrink-0 overflow-hidden bg-muted">
        {post.featured_image_url && (
          <Image
            src={post.featured_image_url}
            alt={post.title}
            fill
            className="object-cover"
            sizes="112px"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center">
        <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">
          {post.title}
        </h3>
        <span className="mt-1 text-xs text-muted-foreground">
          {formatDate(post.published_at)}
        </span>
      </div>
    </a>
  )
}

function SidebarPostItem({ post }: { post: Post }) {
  return (
    <a
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
        <h3 className="text-xs font-semibold leading-snug group-hover:underline line-clamp-2">
          {post.title}
        </h3>
        <span className="mt-1 text-[11px] text-muted-foreground">
          {formatDate(post.published_at)}
        </span>
      </div>
    </a>
  )
}

export default async function HomePage() {
  const [categories, allPosts] = await Promise.all([
    getCategories(),
    getPosts(20),
  ])

  const heroPosts = allPosts.slice(0, 4)
  const primaryCategory = categories[0]
  const featuredPost = allPosts[0]
  const listPosts = allPosts.slice(1, 5)
  const popularPosts = [...allPosts].sort(() => 0.5 - Math.random()).slice(0, 4)

  return (
    <div>
      <WebsiteJsonLd />
      {/* ===== Hero Bento Grid ===== */}
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:grid-rows-2">
          {heroPosts[0] && <HeroCard post={heroPosts[0]} size="large" />}
          {heroPosts[1] && <HeroCard post={heroPosts[1]} size="medium" />}
          <div className="grid grid-cols-2 gap-1">
            {heroPosts[2] && <HeroCard post={heroPosts[2]} size="small" />}
            {heroPosts[3] && <HeroCard post={heroPosts[3]} size="small" />}
          </div>
        </div>
      </section>

      {/* ===== Category Section ===== */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        {/* Category Tab Header */}
        <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b scrollbar-none">
          {categories.slice(0, 6).map((cat, idx) => (
            <a
              key={cat.slug}
              href={`/${cat.slug}`}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                idx === 0
                  ? "border-yellow-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </a>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr_0.8fr]">
          {/* Left: Featured Post */}
          <div>
            {featuredPost && (
              <div>
                <a
                  href={`/${featuredPost.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    {featuredPost.featured_image_url && (
                      <Image
                        src={featuredPost.featured_image_url}
                        alt={featuredPost.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 1024px) 100vw, 33vw"
                      />
                    )}
                  </div>
                  {featuredPost.primary_category && (
                    <span className="mt-3 inline-block bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
                      {featuredPost.primary_category.name}
                    </span>
                  )}
                  <h2 className="mt-2 text-lg font-bold leading-tight group-hover:underline">
                    {featuredPost.title}
                  </h2>
                </a>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(featuredPost.published_at)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {featuredPost.content?.find((b) => b.type === "paragraph")?.text?.replace(/<[^>]*>/g, "")}
                </p>
                {/* Pagination arrows */}
                <div className="mt-4 flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Center: Post List */}
          <div className="divide-y">
            {listPosts.map((post) => (
              <PostListItem key={post.slug} post={post} />
            ))}
          </div>

          {/* Right: Popular Posts */}
          <div>
            <div className="mb-4 inline-block bg-foreground px-3 py-1 text-sm font-bold text-background">
              인기글
            </div>
            <div className="divide-y">
              {popularPosts.map((post) => (
                <SidebarPostItem key={post.slug} post={post} />
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={primaryCategory ? `/${primaryCategory.slug}` : "/"}>
                  Load more
                  <ChevronRight className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
