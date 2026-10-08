import {
  AlertTriangle, AlignLeft, BookOpen, BookOpenCheck, Box, Brain, Clock, Gauge, GraduationCap, Languages,
  Library, Link, ListChecks, MapPin, MessageSquareQuote, MessagesSquare, Mic, Palette, Repeat, Sparkles,
  Sprout, Type, User, Video, Zap, type LucideIcon, type LucideProps,
} from "lucide-react";

// Data files reference icons by name so they stay serialisable (API-friendly).
const icons: Record<string, LucideIcon> = {
  AlertTriangle, AlignLeft, BookOpen, BookOpenCheck, Box, Brain, Clock, Gauge, GraduationCap, Languages,
  Library, Link, ListChecks, MapPin, MessageSquareQuote, MessagesSquare, Mic, Palette, Repeat, Sparkles,
  Sprout, Type, User, Video, Zap,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = icons[name] ?? BookOpen;
  return <C aria-hidden="true" {...props} />;
}
