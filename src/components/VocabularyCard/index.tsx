import { Link } from "react-router-dom";
import type { VocabularyWord } from "../../types";
import { Card } from "../Card";
import { Badge, LevelBadge } from "../Badge";
import { ListenButton } from "../ListenButton";
import { FavoriteButton } from "../FavoriteButton";

export function VocabularyCard({ word }: { word: VocabularyWord }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold">
            <Link to={`/vocabulary/${word.id}`} className="hover:text-ink-600">{word.word}</Link>
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-mono">{word.pronunciation}</span> · <em>{word.partOfSpeech}</em>
          </p>
        </div>
        <div className="flex gap-1.5">
          <ListenButton text={word.word} compact />
          <FavoriteButton wordId={word.id} word={word.word} />
        </div>
      </div>
      <p className="mt-3 text-[0.95rem]">{word.meaning}</p>
      <p className="mt-3 border-l-3 border-amber-300 pl-3 text-sm italic text-muted">“{word.examples[0]}”</p>
      <dl className="mt-4 space-y-1 text-sm">
        {word.synonyms.length > 0 && (
          <div className="flex gap-2"><dt className="font-semibold text-ink-800">Synonyms</dt><dd className="text-muted">{word.synonyms.join(", ")}</dd></div>
        )}
        {word.antonyms.length > 0 && (
          <div className="flex gap-2"><dt className="font-semibold text-ink-800">Antonyms</dt><dd className="text-muted">{word.antonyms.join(", ")}</dd></div>
        )}
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <LevelBadge level={word.level} />
        <Badge tone="ink">{word.category}</Badge>
        <Link to={`/vocabulary/${word.id}`} className="ml-auto text-sm font-semibold text-ink-700 hover:text-ink-900">Details →</Link>
      </div>
    </Card>
  );
}
