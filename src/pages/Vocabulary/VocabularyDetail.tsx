import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { Badge, LevelBadge } from "../../components/Badge";
import { ListenButton } from "../../components/ListenButton";
import { FavoriteButton } from "../../components/FavoriteButton";
import { Card } from "../../components/Card";
import { QuizRunner } from "../../components/QuizRunner";
import { VocabularyCard } from "../../components/VocabularyCard";
import { usePageMeta } from "../../hooks/usePageMeta";
import { getWord, vocabularyWords } from "../../data/vocabulary";
import type { QuizQuestion, VocabularyWord } from "../../types";
import NotFound from "../NotFound";

/** Builds practice questions from the word's own data. */
function practiceFor(w: VocabularyWord): QuizQuestion[] {
  const others = vocabularyWords.filter((o) => o.id !== w.id);
  const pick = (n: number, seed: number) => Array.from({ length: n }, (_, i) => others[(seed * 7 + i * 5) % others.length]);
  const seed = w.word.length + w.word.charCodeAt(0);
  const shuffle = <T,>(arr: T[]) => arr.map((v, i) => ({ v, k: (i * 31 + seed) % 7 })).sort((a, b) => a.k - b.k).map((x) => x.v);
  const qs: QuizQuestion[] = [
    {
      id: `${w.id}-meaning`, type: "mcq", prompt: `What does “${w.word}” mean?`,
      options: shuffle([w.meaning, ...pick(3, seed).map((o) => o.meaning)]), answer: w.meaning,
      explanation: `${w.word} (${w.partOfSpeech}): ${w.meaning}`,
    },
  ];
  const example = w.examples.find((e) => e.toLowerCase().includes(w.word.toLowerCase()));
  if (example) {
    const re = new RegExp(w.word.replace(/[-]/g, "\\-"), "i");
    qs.push({ id: `${w.id}-fill`, type: "fill", prompt: example.replace(re, "___"), answer: [w.word], explanation: `The missing word is “${w.word}”.` });
  }
  if (w.synonyms.length) {
    qs.push({
      id: `${w.id}-syn`, type: "mcq", prompt: `Which word is closest in meaning to “${w.word}”?`,
      options: shuffle([w.synonyms[0], ...pick(3, seed + 1).map((o) => o.word)]), answer: w.synonyms[0],
      explanation: `“${w.synonyms[0]}” is a synonym of “${w.word}”.`,
    });
  }
  return qs;
}

export default function VocabularyDetail() {
  const { word: id = "" } = useParams();
  const w = getWord(id);
  usePageMeta({
    title: w ? `${w.word}: Meaning, Pronunciation and Examples` : "Word not found",
    description: w ? `${w.word} ${w.pronunciation} (${w.partOfSpeech}): ${w.meaning} See example sentences, synonyms and antonyms.` : undefined,
  });
  if (!w) return <NotFound />;
  const similar = vocabularyWords.filter((o) => o.category === w.category && o.id !== w.id).slice(0, 3);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Vocabulary", to: "/vocabulary" }, { label: w.word }]}
        eyebrow={<div className="flex flex-wrap gap-2"><LevelBadge level={w.level} /><Badge tone="ink">{w.category}</Badge></div>}
        title={w.word}
      >
        <p className="text-lg text-muted"><span className="font-mono">{w.pronunciation}</span> · <em>{w.partOfSpeech}</em></p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ListenButton text={w.word} label="Listen" />
          <ListenButton text={w.examples[0]} label="Hear example" />
          <FavoriteButton wordId={w.id} word={w.word} withLabel />
        </div>
      </PageHeader>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="text-xl font-semibold">Meaning</h2>
            <p className="mt-2 text-lg">{w.meaning}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">Examples</h2>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
              {w.examples.map((e) => (
                <li key={e} className="flex items-center gap-3 p-4"><p className="flex-1 italic">“{e}”</p><ListenButton text={e} compact /></li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold">Practice</h2>
            <Card className="mt-3 p-5 sm:p-7"><QuizRunner key={w.id} questions={practiceFor(w)} title={`Practise “${w.word}”`} /></Card>
          </section>
        </div>
        <aside className="space-y-4">
          {[["Synonyms", w.synonyms, "green"], ["Antonyms", w.antonyms, "red"], ["Related words", w.related, "ink"]].map(([label, list, tone]) => (
            <Card key={label as string} className="p-5">
              <h2 className="text-base font-semibold">{label as string}</h2>
              {(list as string[]).length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {(list as string[]).map((s) => <li key={s}><Badge tone={tone as "green" | "red" | "ink"} className="text-sm">{s}</Badge></li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-muted">None commonly used.</p>}
            </Card>
          ))}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="container-page">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold">More {w.category} words</h2>
            <Link to="/vocabulary" className="text-sm font-semibold text-ink-700 hover:text-ink-900">All words →</Link>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <VocabularyCard key={s.id} word={s} />)}</div>
        </section>
      )}
    </>
  );
}
