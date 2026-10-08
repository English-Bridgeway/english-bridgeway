import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { storage } from "../utils/storage";

/**
 * Learner progress kept on this device. When accounts are added, replace the storage
 * reads/writes with API calls (e.g. GET/PUT /me/progress) and keep the same context shape.
 */
interface LearningState {
  completedLessons: string[]; // "topicId/lessonId"
  favoriteWords: string[]; // word ids
  quizScores: Record<string, { score: number; total: number; date: string }>; // key: quiz id
  activeDays: string[]; // yyyy-mm-dd, for the streak
}

interface LearningContextValue extends LearningState {
  toggleLessonComplete: (key: string) => void;
  isLessonComplete: (key: string) => boolean;
  toggleFavorite: (wordId: string) => void;
  isFavorite: (wordId: string) => boolean;
  saveQuizScore: (quizId: string, score: number, total: number) => void;
  streak: number;
}

const KEY = "english-bridgeway:learning";
const empty: LearningState = { completedLessons: [], favoriteWords: [], quizScores: {}, activeDays: [] };
const today = () => new Date().toISOString().slice(0, 10);

const LearningContext = createContext<LearningContextValue | null>(null);

function computeStreak(days: string[]) {
  const set = new Set(days);
  let streak = 0;
  const d = new Date();
  // Count back from today (or yesterday, if today has no activity yet).
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LearningState>(() => ({ ...empty, ...storage.get(KEY, empty) }));

  useEffect(() => storage.set(KEY, state), [state]);

  const markActive = (s: LearningState): LearningState =>
    s.activeDays.includes(today()) ? s : { ...s, activeDays: [...s.activeDays, today()].slice(-366) };

  const toggleLessonComplete = useCallback((key: string) => {
    setState((s) => {
      const has = s.completedLessons.includes(key);
      const next = { ...s, completedLessons: has ? s.completedLessons.filter((k) => k !== key) : [...s.completedLessons, key] };
      return has ? next : markActive(next);
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      favoriteWords: s.favoriteWords.includes(id) ? s.favoriteWords.filter((w) => w !== id) : [...s.favoriteWords, id],
    }));
  }, []);

  const saveQuizScore = useCallback((quizId: string, score: number, total: number) => {
    setState((s) => {
      const prev = s.quizScores[quizId];
      const best = !prev || score / total >= prev.score / prev.total;
      return markActive(best ? { ...s, quizScores: { ...s.quizScores, [quizId]: { score, total, date: today() } } } : s);
    });
  }, []);

  const value = useMemo<LearningContextValue>(
    () => ({
      ...state,
      toggleLessonComplete,
      isLessonComplete: (k) => state.completedLessons.includes(k),
      toggleFavorite,
      isFavorite: (id) => state.favoriteWords.includes(id),
      saveQuizScore,
      streak: computeStreak(state.activeDays),
    }),
    [state, toggleLessonComplete, toggleFavorite, saveQuizScore],
  );

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error("useLearning must be used inside LearningProvider");
  return ctx;
}
