import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { getWordOfTheDay } from "../../data/vocabulary";
import { LevelBadge } from "../Badge";
import { ListenButton } from "../ListenButton";
import { FavoriteButton } from "../FavoriteButton";
import { cn } from "../../utils/cn";

export function WordOfTheDay({ className }: { className?: string }) {
  const w = getWordOfTheDay();
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <section aria-labelledby="wotd-title" className={cn("relative overflow-hidden rounded-3xl bg-brand-primary p-6 text-white sm:p-10", className)}>
      <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-ink-600/40" aria-hidden="true" />
      <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-amber-400/15" aria-hidden="true" />
      <div className="relative grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Word of the Day · {date}
          </p>
          <h2 id="wotd-title" className="mt-3 text-5xl font-bold text-white sm:text-6xl">{w.word}</h2>
          <p className="mt-2 text-ink-100">
            <span className="font-mono">{w.pronunciation}</span> · <em>{w.partOfSpeech}</em>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <LevelBadge level={w.level} />
            <ListenButton text={w.word} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30" />
            <FavoriteButton wordId={w.id} word={w.word} />
          </div>
        </div>
        <div className="rounded-2xl bg-white/8 p-5 ring-1 ring-white/10">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-200">Meaning</p>
          <p className="mt-1 text-lg">{w.meaning}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-200">Example</p>
          <p className="mt-1 border-l-3 border-amber-400 pl-3 italic text-ink-50">“{w.examples[0]}”</p>
          <Link to={`/vocabulary/${w.id}`} className="mt-5 inline-block text-sm font-semibold text-amber-300 hover:text-amber-100">
            Practise this word →
          </Link>
        </div>
      </div>
    </section>
  );
}
