import Image from "next/image"
import type { ContentBlock } from "@/lib/data"

export function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="leading-[1.8] text-foreground/80">
                {block.text}
              </p>
            )
          case "heading":
            if (block.level === 3) {
              return (
                <h3 key={i} className="mt-8 mb-2 text-lg font-semibold text-foreground">
                  {block.text}
                </h3>
              )
            }
            return (
              <h2 key={i} className="mt-10 mb-3 text-xl font-bold text-foreground">
                {block.text}
              </h2>
            )
          case "image":
            return (
              <figure key={i} className="my-6">
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                  <Image
                    src={block.url ?? ""}
                    alt={block.alt ?? ""}
                    fill
                    className="object-cover"
                    sizes="(max-width: 672px) 100vw, 672px"
                  />
                </div>
                {block.caption && (
                  <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            )
          case "quote":
            return (
              <blockquote
                key={i}
                className="my-4 border-l-2 border-primary/40 pl-4 italic leading-[1.8] text-foreground/70"
              >
                {block.text}
              </blockquote>
            )
          case "list":
            if (block.ordered) {
              return (
                <ol key={i} className="my-3 list-decimal space-y-2 pl-6 leading-[1.8] text-foreground/80">
                  {block.items?.map((item, j) => <li key={j}>{item}</li>)}
                </ol>
              )
            }
            return (
              <ul key={i} className="my-3 list-disc space-y-2 pl-6 leading-[1.8] text-foreground/80">
                {block.items?.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
