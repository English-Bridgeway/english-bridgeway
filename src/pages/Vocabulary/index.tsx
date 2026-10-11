import { useMemo, useState } from "react";
import { Heart, Search } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { VocabularyCard } from "../../components/VocabularyCard";
import { WordOfTheDay } from "../../components/WordOfTheDay";
import { Tabs } from "../../components/Tabs";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/Button";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useDebounce } from "../../hooks/useDebounce";
import { vocabCategories, vocabularyWords } from "../../data/vocabulary";
import { useLearning } from "../../context/LearningContext";
import { cn } from "../../utils/cn";

const levels = ["All", "Beginner", "Intermediate", "Advanced"] as const;
type Cat = "All categories" | (typeof vocabCategories)[number];

export default function Vocabulary() {
  usePageMeta({
    title: "English Vocabulary Words with Meanings",
    description: "Learn English vocabulary by topic and level: pronunciation, meanings, example sentences, synonyms and antonyms, with audio.",
  });
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 150);
  const [level, setLevel] = useState<(typeof levels)[number]>("All");
  const [cat, setCat] = useState<Cat>("All categories");
  const [favOnly, setFavOnly] = useState(false);
  const { favoriteWords } = useLearning();

  const words = useMemo(() => {
    const term = dq.toLowerCase().trim();
    return vocabularyWords.filter((w) =>
      (level === "All" || w.level === level) &&
      (cat === "All categories" || w.category === cat) &&
      (!favOnly || favoriteWords.includes(w.id)) &&
      (!term || `${w.word} ${w.meaning} ${w.synonyms.join(" ")}`.toLowerCase().includes(term)),
    );
  }, [dq, level, cat, favOnly, favoriteWords]);

  const catOptions = [
    { value: "All categories" as Cat, label: "All categories", count: vocabularyWords.length },
    ...vocabCategories.map((c) => ({ value: c as Cat, label: c, count: vocabularyWords.filter((w) => w.category === c).length })),
  ];

  const reset = () => { setQ(""); setLevel("All"); setCat("All categories"); setFavOnly(false); };

  return (
    <>
      <PageHeader crumbs={[{ label: "Vocabulary" }]} title="Vocabulary"
        description="Build a strong word bank with meanings, pronunciation, examples, synonyms and opposites. Tap the heart to save words for review." />

      <div className="container-page py-10">
        <WordOfTheDay />

        <section aria-labelledby="word-list" className="mt-14">
          <h2 id="word-list" className="text-2xl font-semibold">Word lists</h2>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <label htmlFor="vocab-search" className="sr-only">Search words</label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input id="vocab-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search words or meanings"
                className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs options={levels} value={level} onChange={setLevel} label="Filter by difficulty" />
              <button type="button" aria-pressed={favOnly} onClick={() => setFavOnly((f) => !f)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium", favOnly ? "border-brand-sky bg-brand-sky text-white" : "border-line bg-white text-muted hover:text-ink-800")}>
                <Heart className={cn("h-4 w-4", favOnly && "fill-current")} aria-hidden="true" /> Favourites ({favoriteWords.length})
              </button>
            </div>
          </div>
          <div className="mt-4 -mx-4 overflow-x-auto px-4 pb-1">
            <Tabs options={catOptions} value={cat} onChange={setCat} label="Filter by category" className="flex-nowrap sm:flex-wrap" />
          </div>

          <p className="mt-6 text-sm text-muted" aria-live="polite">{words.length} {words.length === 1 ? "word" : "words"}</p>
          {words.length ? (
            <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {words.map((w) => <VocabularyCard key={w.id} word={w} />)}
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState title={favOnly && !favoriteWords.length ? "No favourite words yet" : "No words match these filters"}
                action={<Button variant="outline" onClick={reset}>Show all words</Button>}>
                {favOnly && !favoriteWords.length ? "Tap the heart on any word card to save it here." : "Try a different search or remove a filter."}
              </EmptyState>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
