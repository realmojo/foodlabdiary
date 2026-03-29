import Image from "next/image"
import type { ContentBlock } from "@/lib/data"

function reorderBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    // paragraph → image 순서면 image를 먼저 오도록 swap
    if (
      block.type === "paragraph" &&
      i + 1 < blocks.length &&
      blocks[i + 1].type === "image"
    ) {
      result.push(blocks[i + 1]) // image 먼저
      result.push(block)          // paragraph 뒤로
      i += 1
      continue
    }
    result.push(block)
    // heading 다음에 paragraph → image 순서면 image를 먼저 오도록 swap
    if (
      block.type === "heading" &&
      i + 2 < blocks.length &&
      blocks[i + 1].type === "paragraph" &&
      blocks[i + 2].type === "image"
    ) {
      result.push(blocks[i + 2]) // image 먼저
      result.push(blocks[i + 1]) // paragraph 뒤로
      i += 2
    }
  }
  return result
}

export function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  const ordered = reorderBlocks(blocks)
  return (
    <div className="space-y-5">
      {ordered.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="leading-[1.8] text-foreground/80" dangerouslySetInnerHTML={{ __html: block.text ?? "" }} />
            )
          case "heading":
            if (block.level === 3) {
              return (
                <h3 key={i} className="mt-8 mb-2 text-lg font-semibold text-foreground" dangerouslySetInnerHTML={{ __html: block.text ?? "" }} />
              )
            }
            return (
              <h2 key={i} className="mt-10 mb-3 text-xl font-bold text-foreground" dangerouslySetInnerHTML={{ __html: block.text ?? "" }} />
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
                dangerouslySetInnerHTML={{ __html: block.text ?? "" }}
              />
            )
          case "list":
            if (block.ordered) {
              return (
                <ol key={i} className="my-3 list-decimal space-y-2 pl-6 leading-[1.8] text-foreground/80">
                  {block.items?.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: item }} />)}
                </ol>
              )
            }
            return (
              <ul key={i} className="my-3 list-disc space-y-2 pl-6 leading-[1.8] text-foreground/80">
                {block.items?.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: item }} />)}
              </ul>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
