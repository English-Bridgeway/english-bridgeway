import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Tabs } from "../../components/Tabs";
import { Card } from "../../components/Card";
import { Badge, LevelBadge } from "../../components/Badge";
import { usePageMeta } from "../../hooks/usePageMeta";
import { spokenCategories, spokenLessons } from "../../data/spokenEnglish";
import { cn } from "../../utils/cn";

type Cat = "All" | (typeof spokenCategories)[number];

export default function SpokenEnglish() {
  usePageMeta({
    title: "Spoken English Practice: Real Conversations",
    description: "Practise spoken English with real conversations for greetings, introductions, phone calls, shopping, restaurants, travel, office and interviews.",
  });
  const [cat, setCat] = useState<Cat>("All");
  const lessons = spokenLessons.filter((l) => cat === "All" || l.category === cat);

  return (
    <>
      <PageHeader crumbs={[{ label: "Spoken English" }]} title="Spoken English"
        description="Short, realistic conversations you can listen to, repeat and act out. Each lesson includes useful phrases, key vocabulary and a speaking task." />
      <section className="container-page py-10">
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <Tabs options={["All", ...spokenCategories] as Cat[]} value={cat} onChange={setCat} label="Filter by situation" className="flex-nowrap md:flex-wrap" />
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {lessons.map((l) => (
            <Card key={l.id} interactive className="group flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ink">{l.category}</Badge>
                <LevelBadge level={l.level} />
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {l.minutes} min</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold">
                <Link to={`/spoken-english/${l.id}`} className="after:absolute after:inset-0 focus:outline-none">{l.title}</Link>
              </h2>
              <p className="mt-1 text-sm text-muted">Situation: {l.situation}</p>
              <div className="mt-4 flex-1 space-y-2" aria-hidden="true">
                {l.dialogue.slice(0, 2).map((d, i) => (
                  <p key={i} className={cn("w-fit max-w-[90%] rounded-2xl px-3 py-1.5 text-sm", d.speaker === "A" ? "rounded-bl-md bg-ink-50 text-ink-900" : "ml-auto rounded-br-md bg-amber-50 text-ink-900")}>
                    <span className="font-semibold">{d.name}:</span> {d.text}
                  </p>
                ))}
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-ink-700">
                Practise conversation <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
