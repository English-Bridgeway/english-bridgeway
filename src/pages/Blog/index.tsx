import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { BlogCard, BlogCover } from "../../components/BlogCard";
import { Tabs } from "../../components/Tabs";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { usePageMeta } from "../../hooks/usePageMeta";
import { blogCategories, blogPosts } from "../../data/blog";
import { formatDate } from "../../utils/format";
import type { BlogCategory } from "../../types";

type Cat = "All" | BlogCategory;

export default function Blog() {
  usePageMeta({
    title: "English Learning Blog: Tips, Idioms and Common Mistakes",
    description: "Practical English tips, idioms, grammar explainers, vocabulary guides and common mistakes, with new posts every week.",
  });
  const [cat, setCat] = useState<Cat>("All");
  const [featured, ...rest] = blogPosts;
  const list = cat === "All" ? rest : blogPosts.filter((p) => p.category === cat);

  return (
    <>
      <PageHeader crumbs={[{ label: "Blog" }]} title="Blog" description="Short, practical reads to help you speak and write better English. New posts every week." />
      <div className="container-page py-10">
        {cat === "All" && (
          <article className="relative grid overflow-hidden rounded-3xl border border-line bg-white shadow-card md:grid-cols-2">
            <BlogCover post={featured} className="min-h-56" large />
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <div className="flex items-center gap-2"><Badge tone="amber">Featured</Badge><Badge tone="ink">{featured.category}</Badge></div>
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
                <Link to={`/blog/${featured.slug}`} className="after:absolute after:inset-0 hover:text-ink-600">{featured.title}</Link>
              </h2>
              <p className="mt-3 text-muted">{featured.excerpt}</p>
              <p className="mt-5 flex flex-wrap gap-x-3 text-sm text-muted">
                <span className="font-semibold text-ink-800">{featured.author}</span>
                <time dateTime={featured.date}>{formatDate(featured.date)}</time>
                <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" />{featured.readingMinutes} min read</span>
              </p>
            </div>
          </article>
        )}
        <div className="mt-10 -mx-4 overflow-x-auto px-4 pb-1">
          <Tabs options={["All", ...blogCategories] as Cat[]} value={cat} onChange={setCat} label="Filter by category" className="flex-nowrap md:flex-wrap" />
        </div>
        {list.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <BlogCard key={p.slug} post={p} />)}</div>
        ) : (
          <div className="mt-6"><EmptyState title={`No ${cat} posts yet`}>New articles are added every week. Try another category.</EmptyState></div>
        )}
      </div>
    </>
  );
}
