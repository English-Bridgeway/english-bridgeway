import { Heart } from "lucide-react";
import { useLearning } from "../../context/LearningContext";
import { cn } from "../../utils/cn";

export function FavoriteButton({ wordId, word, withLabel }: { wordId: string; word: string; withLabel?: boolean }) {
  const { isFavorite, toggleFavorite } = useLearning();
  const on = isFavorite(wordId);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(wordId)}
      aria-pressed={on}
      aria-label={withLabel ? undefined : on ? `Remove ${word} from favourites` : `Add ${word} to favourites`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border transition-colors",
        withLabel ? "h-9 px-3.5 text-sm font-medium" : "h-9 w-9",
        on ? "border-red-200 bg-red-50 text-red-600" : "border-line bg-white text-muted hover:text-red-600",
      )}
    >
      <Heart className={cn("h-4 w-4", on && "fill-current")} aria-hidden="true" />
      {withLabel && (on ? "Saved" : "Add to favourites")}
    </button>
  );
}
