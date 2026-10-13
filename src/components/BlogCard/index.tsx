import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import type { BlogPost } from "../../types";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { Badge } from "../Badge";
import { formatDate } from "../../utils/format";
import { cn } from "../../utils/cn";

/** Generated cover art so posts need no image files. */
export function BlogCover({ post, className, large }: { post: BlogPost; className?: string; large?: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Cover illustration for ${post.title}`}
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundColor: "var(--primary-color)" }}
    >
      <div className="absolute -right-6 -bottom-8 opacity-15">
        <Icon name={post.cover.icon} className={large ? "h-64 w-64 text-white" : "h-40 w-40 text-white"} strokeWidth={1.25} />
      </div>
      <div className="absolute left-5 top-5 grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
        <Icon name={post.cover.icon} className="h-5 w-5" />
      </div>
    </div>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Card interactive className="flex h-full flex-col overflow-hidden">
      <BlogCover post={post} className="h-40" />
      <div className="flex flex-1 flex-col p-5">
        <Badge tone="ink" className="self-start">{post.category}</Badge>
        <h3 className="mt-3 text-lg font-semibold leading-snug">
          <Link to={`/blog/${post.slug}`} className="after:absolute after:inset-0 focus:outline-none">{post.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{post.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-xs text-muted">
          <span className="font-semibold text-ink-800">{post.author}</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {post.readingMinutes} min read</span>
          <span className="ml-auto font-semibold text-ink-700">Read more →</span>
        </div>
      </div>
    </Card>
  );
}
