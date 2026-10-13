import type { Activity } from "../types";

export const recentActivity: Activity[] = [
  { id: "a1", kind: "lesson", label: "Completed a lesson", detail: "Present Continuous Tense", when: "Today, 8:40 a.m." },
  { id: "a2", kind: "quiz", label: "Scored 8/10", detail: "Grammar Essentials quiz", when: "Yesterday" },
  { id: "a3", kind: "word", label: "Saved a word", detail: "punctual", when: "Yesterday" },
  { id: "a4", kind: "course", label: "Started a course", detail: "Beginner English", when: "3 days ago" },
];

// Demo progress shown before the student has done anything on this device.
export const demoProgress = {
  currentCourseId: "beginner-english",
  coursePercent: 65,
  completedLessons: 26,
  averageQuizScore: 82,
  streakDays: 12,
  weeklyMinutes: [15, 20, 0, 25, 18, 30, 12],
};
