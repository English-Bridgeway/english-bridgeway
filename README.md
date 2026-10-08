# English-Bridgeway

A modern English-learning platform frontend built with **React 19, TypeScript, Vite, React Router, Tailwind CSS v4 and Lucide icons**.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

`npm run build:preview` makes a portable build (relative paths + hash routing) that runs from any folder or an embedded preview.

## Project structure

```
src/
├── components/   Reusable UI: Navbar, Footer, Button, Badge, Card, Modal, Alert, Tabs, Breadcrumbs,
│                 ProgressBar, Skeleton, FormField, CourseCard, LessonCard, VocabularyCard, QuizCard,
│                 BlogCard, TopicCard, Dialogue, QuizRunner, SearchDialog, WordOfTheDay, ...
├── pages/        Home, Grammar (dashboard/topic/lesson), Vocabulary (list/detail), SpokenEnglish
│                 (list/lesson), Quiz (categories/category/play), Courses (list/detail), Blog
│                 (list/article), Contact, Dashboard, Search, Auth (Login/Register), NotFound
├── data/         Mock data: grammar.ts, vocabulary.ts, spokenEnglish.ts, quizzes.ts, courses.ts,
│                 blog.ts, dashboard.ts, site.ts (name, contact details, nav, stats)
├── layouts/      MainLayout.tsx (navbar, footer, lazy-route Suspense)
├── routes/       AppRoutes.tsx (all routes, lazy loaded)
├── context/      AuthContext (auth placeholder), LearningContext (progress, favourites, scores, streak)
├── hooks/        usePageMeta (title, description, Open Graph), useDebounce
├── utils/        api.ts, search.ts, quiz.ts, speech.ts, storage.ts, sitemap.ts, format.ts, cn.ts
└── types/        Shared TypeScript interfaces
```

## Customising

- **Site name, email, WhatsApp, location, social links, home-page stats:** `src/data/site.ts`
- **Content:** edit the arrays in `src/data/*.ts`. Pages read only from these files.
- **Colours and fonts:** the `@theme` block in `src/index.css`.

## Connecting a backend later

- **Data:** each `src/data/*.ts` file exports plain objects matching `src/types`. Replace them with API calls
  (e.g. in a hook) without changing the components.
- **Contact form:** set `VITE_CONTACT_ENDPOINT` in a `.env` file (Formspree URL or your API). Without it the
  form runs in demo mode and does not deliver messages. See `src/utils/api.ts`.
- **Auth:** implement `signIn`, `signUp` and `signOut` in `src/context/AuthContext.tsx`. Login, Register,
  Navbar and Dashboard already use that interface.
- **Progress:** `src/context/LearningContext.tsx` stores progress in localStorage; swap the storage calls for
  API calls to sync across devices.
- **Search:** `src/utils/search.ts` searches local data; replace `search()` with a server call.
- **Sitemap:** `src/utils/sitemap.ts` exposes `getAllPaths()` and `buildSitemapXml()` for every public URL.

## Hosting

This is a single-page app. Configure your host to serve `index.html` for unknown paths
(Netlify `_redirects`: `/* /index.html 200`; Vercel does this automatically).
