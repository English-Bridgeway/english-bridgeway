// Site-wide settings. These are the defaults; the admin panel (Settings → Site) can
// override every field, and the saved values are applied at start-up (see data/content.ts).
export interface SiteSettings {
  name: string;
  tagline: string;
  description: string;
  url: string;
  email: string;
  whatsapp: string;
  whatsappLink: string;
  location: string;
  hours: string;
  social: { youtube: string; instagram: string; facebook: string; linkedin: string };
  stats: { label: string; value: string; icon: string }[];
  /** Read-aloud voice for Listen buttons. An empty name picks a friendly female English voice automatically. */
  voice: { name: string; pitch: number; rate: number };
}

export const site: SiteSettings = {
  name: "English-Bridgeway",
  tagline: "Improve your English. Speak with confidence.",
  description:
    "Learn grammar, build vocabulary, practise spoken English and test your knowledge with simple, practical lessons.",
  url: "https://www.englishbridgeway.example",
  email: "hello@englishbridgeway.example",
  whatsapp: "+91 98765 43210",
  whatsappLink: "https://wa.me/919876543210",
  location: "Pune, Maharashtra, India",
  hours: "Mon to Sat, 9:00 a.m. to 7:00 p.m. IST",
  social: {
    youtube: "https://www.youtube.com/",
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    linkedin: "https://www.linkedin.com/",
  },
  // Marketing numbers shown on the home page. Update as the library grows.
  stats: [
    { label: "Lessons", value: "500+", icon: "BookOpen" },
    { label: "Vocabulary words", value: "1,000+", icon: "Languages" },
    { label: "Quizzes", value: "100+", icon: "ListChecks" },
    { label: "Courses", value: "20+", icon: "GraduationCap" },
  ],
  voice: { name: "", pitch: 1.15, rate: 0.92 },
};

export const mainNav = [
  { label: "Home", to: "/" },
  { label: "Grammar", to: "/grammar" },
  { label: "Vocabulary", to: "/vocabulary" },
  { label: "Spoken English", to: "/spoken-english" },
  { label: "Quiz", to: "/quiz" },
  { label: "Courses", to: "/courses" },
  { label: "Blog", to: "/blog" },
  { label: "Contact", to: "/contact" },
] as const;
