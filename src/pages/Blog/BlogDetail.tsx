import { useState } from "react";
import { useParams } from "react-router-dom";
import { Clock, Link2, Lightbulb, Share2 } from "lucide-react";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { Badge } from "../../components/Badge";
import { BlogCard, BlogCover } from "../../components/BlogCard";
import { usePageMeta } from "../../hooks/usePageMeta";
import { blogPosts, getPost } from "../../data/blog";
import { site } from "../../data/site";
import { formatDate } from "../../utils/format";
import type { BlogBlock } from "../../types";
import NotFound from "../NotFound";

function Block({ b }: { b: BlogBlock }) {
  switch (b.type) {
    case "p": return <p>{b.text}</p>;
    case "h2": return <h2 className="!mt-10 text-2xl font-semibold">{b.text}</h2>;
    case "list": return <ul className="list-disc space-y-1.5 pl-6 marker:text-ink-400">{b.items.map((i) => <li key={i}>{i}</li>)}</ul>;
    case "pairs": return (
      <dl className="divide-y divide-line rounded-2xl border border-line bg-white">
        {b.items.map((i) => (
          <div key={i.term} className="p-4"><dt className="font-semibold text-ink-900">{i.term}</dt><dd className="mt-1 text-muted">{i.detail}</dd></div>
        ))}
      </dl>
    );
    case "tip": return (
      <aside className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <p><span className="font-semibold">Tip: </span>{b.text}</p>
      </aside>
    );
  }
}

export default function BlogDetail() {
  const { slug = "" } = useParams();
  const post = getPost(slug);
  usePageMeta({ title: post?.title ?? "Article not found", description: post?.excerpt, type: "article" });
  const [copied, setCopied] = useState(false);
  if (!post) return <NotFound />;

  const url = `${site.url}/blog/${post.slug}`;
  const enc = encodeURIComponent;
  const shares = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${post.title} ${url}`)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(post.title)}&url=${enc(url)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const related = blogPosts.filter((p) => p.slug !== post.slug).sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category)).slice(0, 3);

  return (
    <>
      <article className="container-page max-w-3xl py-10">
        <Breadcrumbs items={[{ label: "Blog", to: "/blog" }, { label: post.title }]} />
        <header className="mt-6">
          <Badge tone="ink">{post.category}</Badge>
          <h1 className="mt-4 text-3xl font-bold sm:text-[2.6rem] sm:leading-tight">{post.title}</h1>
          <p className="mt-4 text-lg text-muted">{post.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800" aria-hidden="true">{post.author.split(" ").map((n) => n[0]).join("")}</span>
              <span className="font-semibold text-ink-900">{post.author}</span>
            </span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" /> {post.readingMinutes} min read</span>
          </div>
        </header>
        <BlogCover post={post} className="mt-8 h-56 rounded-3xl sm:h-72" large />
        <div className="mt-10 space-y-5 text-[1.0625rem] leading-relaxed">
          {post.content.map((b, i) => <Block key={i} b={b} />)}
        </div>
        <footer className="mt-12 flex flex-wrap items-center gap-2 border-t border-line pt-6">
          <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold"><Share2 className="h-4 w-4" aria-hidden="true" /> Share</span>
          {shares.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium hover:border-ink-300">
              {s.label}<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))}
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium hover:border-ink-300">
            <Link2 className="h-4 w-4" aria-hidden="true" /> {copied ? "Link copied" : "Copy link"}
          </button>
        </footer>
      </article>
      <section className="container-page">
        <h2 className="text-xl font-semibold">Related articles</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((p) => <BlogCard key={p.slug} post={p} />)}</div>
      </section>
    </>
  );
}
