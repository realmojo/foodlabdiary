import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, User } from "lucide-react"
import type { Post } from "@/lib/data"

export function PostCard({ post }: { post: Post }) {
  const category = post.primary_category

  return (
    <a href={`/${post.slug}`}>
      <Card className="group h-full transition-colors hover:bg-muted/50">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            {category && (
              <Badge variant="secondary" className="text-xs">
                {category.emoji} {category.name}
              </Badge>
            )}
          </div>
          <h3 className="font-semibold leading-snug group-hover:underline">
            {post.title}
          </h3>
          <p className="flex-1 text-sm text-muted-foreground line-clamp-2">
            {post.excerpt?.replace(/<[^>]*>/g, "")}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {post.author && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {post.author.name}
              </span>
            )}
            {post.read_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {post.read_time}
              </span>
            )}
            {post.published_at && (
              <span>{new Date(post.published_at).toLocaleDateString("ko-KR")}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  )
}

