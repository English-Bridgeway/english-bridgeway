// Site-wide settings. Change the name, contact details and links here.
export const site = {
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
} as const;

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
