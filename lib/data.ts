import { supabase } from "./supabase"

// ---- Types ----

export interface ContentBlock {
  type: "paragraph" | "heading" | "image" | "quote" | "list"
  text?: string
  level?: number
  url?: string
  alt?: string
  caption?: string
  items?: string[]
  ordered?: boolean
}

export interface Author {
  id: string
  name: string
  slug: string
  bio: string | null
  avatar_url: string | null
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  emoji: string | null
  sort_order: number
}

export interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: ContentBlock[]
  author_id: string
  primary_category_id: string
  featured_image_url: string | null
  status: string
  read_time: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  // joined
  author?: Author
  primary_category?: Category
  categories?: Category[]
}

// ---- Categories ----

export async function getCategories(): Promise<Category[]> {
  const { data } = await supabase
    .from("pawpaw_categories")
    .select("*")
    .order("sort_order")
  return data ?? []
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data } = await supabase
    .from("pawpaw_categories")
    .select("*")
    .eq("slug", slug)
    .single()
  return data
}

export async function getCategoryPostCount(categoryId: string): Promise<number> {
  const { count } = await supabase
    .from("pawpaw_post_categories")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId)
  return count ?? 0
}

// ---- Posts ----

export async function getPosts(limit?: number): Promise<Post[]> {
  let query = supabase
    .from("pawpaw_posts")
    .select("*, author:pawpaw_authors(*), primary_category:pawpaw_categories!posts_primary_category_id_fkey(*)")
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (limit) query = query.limit(limit)

  const { data } = await query
  return data ?? []
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const { data: post, error } = await supabase
    .from("pawpaw_posts")
    .select("*, author:pawpaw_authors(*), primary_category:pawpaw_categories!posts_primary_category_id_fkey(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (error) {
    console.error("[getPostBySlug]", error.message)
    return null
  }
  if (!post) return null

  // fetch all categories for this post via junction table
  const { data: postCats } = await supabase
    .from("pawpaw_post_categories")
    .select("category:pawpaw_categories!post_categories_category_id_fkey(*)")
    .eq("post_id", post.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post.categories = postCats?.map((pc: any) => pc.category) ?? []

  return post
}

export async function getPostsByCategory(categoryId: string): Promise<Post[]> {
  const { data: postIds } = await supabase
    .from("pawpaw_post_categories")
    .select("post_id")
    .eq("category_id", categoryId)

  if (!postIds || postIds.length === 0) return []

  const ids = postIds.map((r) => r.post_id)

  const { data } = await supabase
    .from("pawpaw_posts")
    .select("*, author:pawpaw_authors(*), primary_category:pawpaw_categories!posts_primary_category_id_fkey(*)")
    .eq("status", "published")
    .in("id", ids)
    .order("published_at", { ascending: false })

  return data ?? []
}

export async function getRelatedPosts(
  currentPostId: string,
  categoryId: string,
  limit = 3,
): Promise<Post[]> {
  const { data: postIds } = await supabase
    .from("pawpaw_post_categories")
    .select("post_id")
    .eq("category_id", categoryId)

  if (!postIds || postIds.length === 0) return []

  const ids = postIds
    .map((r) => r.post_id)
    .filter((id) => id !== currentPostId)

  if (ids.length === 0) return []

  const { data } = await supabase
    .from("pawpaw_posts")
    .select("*, author:pawpaw_authors(*), primary_category:pawpaw_categories!posts_primary_category_id_fkey(*)")
    .eq("status", "published")
    .in("id", ids)
    .order("published_at", { ascending: false })
    .limit(limit)

  return data ?? []
}

// ---- All post slugs (for static generation) ----

export async function getAllPostSlugs(): Promise<string[]> {
  const { data } = await supabase
    .from("pawpaw_posts")
    .select("slug")
    .eq("status", "published")
  return data?.map((p) => p.slug) ?? []
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const { data } = await supabase
    .from("pawpaw_categories")
    .select("slug")
  return data?.map((c) => c.slug) ?? []
}
