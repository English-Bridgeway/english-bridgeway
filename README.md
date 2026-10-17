# English-Bridgeway

A modern English-learning platform built with **React 19, TypeScript, Vite, React Router, Tailwind CSS v4 and Lucide icons**,
with an **admin panel** that manages every lesson, word, quiz, course and blog post, and **Cashfree** payments for paid courses.
The backend in `server/` is **Express + TypeScript + PostgreSQL (Sequelize)**, following the same patterns as Inveon Events.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

`npm run build:preview` makes a portable build (relative paths + hash routing) that runs from any folder or an embedded preview.

Without `VITE_API_BASE` the site runs in **demo mode**: the admin panel (`/admin`, demo login filled in), checkout and the contact
form all work, but data is kept in the browser only. Connect the API (below) for real use.

## Run everything with Docker

One command starts PostgreSQL, the API and the website (Nginx), with the API served under `/api` on the same address.

```bash
cp .env.docker.example .env     # set JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters)
docker compose up -d --build    # http://localhost:8080, admin panel at http://localhost:8080/admin
docker compose logs -f server   # watch start-up
```

On the first start the API creates its tables, loads the built-in lessons from `server/seed/content.json` and creates the
first owner from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Data is kept in the `db-data` volume.

| Task | Command |
|---|---|
| Add or reset an admin | `docker compose exec -e ADMIN_PASSWORD='new-password-123' server node dist/scripts/createAdmin.js you@example.com "Your Name" owner` |
| Reload the built-in content (overwrites items with the same slug) | `docker compose exec server node dist/scripts/seed.js --force` |
| Update after pulling new code | `docker compose up -d --build` |
| Stop / stop and delete the database | `docker compose down` / `docker compose down -v` |

For a real server, set `PUBLIC_SITE_URL` and `API_PUBLIC_URL` to your domain (both the same, e.g. `https://www.example.com`),
put HTTPS in front of port 8080 (Caddy, Nginx or your host's load balancer), change `POSTGRES_PASSWORD` before the first start,
and add `https://www.example.com/api/webhooks/cashfree` as the webhook URL in Cashfree.
Files: `Dockerfile` (website), `server/Dockerfile` (API), `docker/nginx.conf`, `docker-compose.yml`.

### Deploying on a server (e.g. AWS EC2 with a host Nginx)

```bash
cd /var/www/english-bridgeway && git pull
docker compose up -d --build                    # site + API + voice chat on :8080
docker compose --profile turn up -d --build     # same, plus the TURN relay (recommended)
```

1. **HTTPS is required for voice chat.** Browsers only allow the microphone on `https://` (or localhost).
   Keep certbot on the host Nginx in front of port 8080.
2. **Let WebSockets through the host Nginx.** Voice chat uses `/api/socket.io/`. In the host site config:
   ```nginx
   location / {
     proxy_pass http://127.0.0.1:8080;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_set_header Host $host;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
     proxy_read_timeout 1h;
   }
   ```
   then `sudo nginx -t && sudo systemctl reload nginx`.
3. **TURN relay (needed for reliable calls).** Without it, calls between many mobile networks (Jio/Airtel CGNAT) and
   office/college Wi-Fi end in "Can't connect" because the two browsers can't reach each other directly. In `.env` set
   `TURN_SECRET` (`openssl rand -hex 32`) and `TURN_EXTERNAL_IP` (the EC2 public IP, or leave empty to detect it), then start
   with `--profile turn`. `TURN_URLS` defaults to `turn:<your PUBLIC_SITE_URL host>:3478` (UDP and TCP) when it is empty.
   Open these in the EC2 security group: **3478 TCP+UDP** and **49160-49200 UDP**.

| Port | Used by |
| --- | --- |
| 8080 (TCP, host only) | Website, API and voice chat WebSocket, behind the host Nginx on 80/443 |
| 3478 (TCP+UDP) | TURN relay (only with `--profile turn`) |
| 49160-49200 (UDP) | TURN relayed audio (only with `--profile turn`) |

## Learner accounts and course payments

- Learners sign up at `/register` and log in at `/login` (passwords bcrypt-hashed, 30-day sessions kept on the device,
  rate-limited). After logging in learners land in their own portal at `/learn` (see below); lessons on the public site stay
  open to everyone.
- Buying a paid course requires an account. The order is tied to that account and uses its email; when Cashfree confirms
  the payment (return page or webhook) the course unlocks for that learner on every device. Refunded orders lock it again.
- Cashfree runs in **sandbox (test) mode** by default. Use Cashfree's test cards/UPI there; switch to production in
  Admin → Payment gateway when you go live.
- API: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me` (profile and owned course ids), `GET /api/me/orders`,
  `POST /api/me/logout-all`. `POST /api/orders` now needs the learner's `Authorization: Bearer` token.

## Learner portal (`/learn`), free trial and access

- **The portal** has its own layout: Overview (progress, streak, quiz scores), **My courses** (every course with its state:
  free, bought, open with access, or locked), a **course player** (`/learn/courses/:id`, lesson list on the side, the lesson in
  the middle, Previous / Mark as done / Next), **Speak with AI**, **Speak Live**, **Plan & payments** and **My profile**
  (photo upload, mobile, WhatsApp, date of birth, city, level, goal…). `/dashboard` and `/speak` redirect here.
- **Free trial and limits** (all set in Admin → Learners → **Free trial and limits**):

  | | Free trial (`trialHours`, 24 by default) | Paid (subscription, access given, or any bought course) |
  | --- | --- | --- |
  | Lessons | first `freeLessons` (1) of every course; the rest show a lock and the buy / subscribe screen | every lesson (a bought course always stays open) |
  | Speak with AI | `trialAiMessages` (100) in total | `paidAiPerDay` (1000) a day, 0 = no limit |
  | Speak Live calls | `trialCallMinutes` (2) in total, then the call ends and the learner is sent to the plans | `paidCallMinutesPerDay` (45) a day, 0 = no limit |

  Daily allowances restart at midnight India time. When the trial ends, lessons, the AI tutor and calls stay locked until the
  learner pays. Usage is stored per learner per day in `learner_usage`; rules in `server/src/services/usage.ts`.
- **Subscriptions:** Admin → **Subscription plans** (owner) defines plans: name, price, duration (monthly, quarterly,
  half-yearly or yearly), on sale, "Best value" badge. Learners see **Subscribe · all courses** on course pages, the plan cards
  in My courses and Plan & payments, and pay through the same Cashfree checkout. A paid plan moves the learner's access end date
  (`learners.access_until`) forward by its months, counted from the later of now, their current end date or their trial end,
  so admin-granted time and plans add up. Plans do not auto-renew; buying again extends. Refunding a plan order takes its months
  back off. A "% off any course" offer also lowers plan prices; unlimited-access learners aren't offered plans. Plans live in the
  `settings` table (`subscriptionPlans`); plan orders are rows in `orders` with `plan_id`/`plan_months` and `course_id = plan:<id>`.
- **Admin → Learners** lists every learner (search, filters for trial / access / ended / buyers / offers / blocked). A learner's
  page shows their photo, contact and profile details and payments, and lets the owner **give N months** (added to any time
  left), **set an end date**, **give unlimited access**, **restart the trial**, **remove access**, give a **special offer**
  (percent off or a fixed price, for one course or all, optional end date: the learner sees it and Cashfree charges that price),
  **block / unblock** (blocking signs them out everywhere at once; the reason is shown when they try to log in), keep a
  private note, or delete the account.
- The rules live in `server/src/services/access.ts` and `usage.ts`; the server checks them for payments, the AI tutor and calls.
- A learner's admin page also shows their **usage** (lessons, AI messages, call time) and their **call history**.
- API: `PATCH /api/me` (name, phone, `profile`), `PUT/DELETE /api/me/avatar` (photo as a data: URL, shrunk to 256×256 in the
  browser), `GET /api/avatars/:id`, `GET /api/ai/status`, `POST /api/ai/chat`, `GET /api/plans`, `POST /api/orders` with
  `{ planId }` (a subscription) or `{ courseId }` (one course); admin: `/api/admin/learners…`, `/api/admin/settings/access`,
  `/api/admin/settings/ai`, `/api/admin/settings/plans`.

## Speak with AI (`/learn/ai`)

Learners talk out loud with "Bridget", an AI English tutor: the browser's speech recognition turns their voice into text
(Chrome, Edge, Safari; typing works everywhere), the server asks the AI, and the reply is read aloud in the site's female
Listen voice. Situations: free talk, job interview, restaurant, shopping, travel, doctor, office. When the learner makes a
mistake the tutor shows a "Better:" correction. Hands-free mode listens again after each reply.

**Set it up (Admin → AI tutor, owner only):** pick a provider, paste an API key, tick *Speak with AI is on*, save, then
**Test saved settings**. Any OpenAI-compatible API works:

| Provider | API base URL | Example model | Key |
| --- | --- | --- | --- |
| Groq (free tier) | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` | console.groq.com/keys |
| Google Gemini (free tier) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` | aistudio.google.com/apikey |
| OpenRouter | `https://openrouter.ai/api/v1` | a `:free` model | openrouter.ai/keys |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | platform.openai.com/api-keys |
| Ollama (own server) | `http://<host>:11434/v1` | `llama3.1` | none |

The key is stored encrypted in the database and never reaches browsers. `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY` in
`.env` are used when nothing is saved in the admin panel. Message limits come from Admin → Learners → Free trial and limits
(see the table above) and are stored in the database. In demo mode the browser calls the provider directly with the key saved in the
demo admin panel; some providers block that, so test on the real server.

## Speak Live: voice chat (`/learn/live`)

- **Learners online:** everyone logged in shows up while they are anywhere on the site. Press **Call** for a one-to-one call;
  the other learner gets a ringing pop-up on whatever page they are on (Answer / Decline, rings for 45 seconds, then
  "No answer"). Someone already on a call can **Keep call**, **End & answer**, or **Merge** the caller in (it becomes a
  private group call).
- **Call states:** Ringing → Connecting → Connected (with a running timer) → Reconnecting when a network drops. A dropped
  connection keeps the call for 30 seconds while the page reconnects; a WebRTC path that fails is restarted automatically,
  and "Can't connect" offers **Try again**.
- **Call history:** each call is saved per learner in `call_logs` (with whom, direction, start, talk time, result: completed,
  no answer, declined, missed, minutes ran out, connection lost). Learners see "Recent calls" on Speak Live; admins see it
  on the learner's page. Talk time counts while two or more people are in the call and uses the learner's call minutes.
- **Team rooms:** start a room (public, or private for invited people only), invite online learners or share the
  invite link, up to `VOICE_MAX_ROOM_SIZE` people (default 6). Mute, leave, and a small call bar on other pages.
- **How it works:** audio goes directly between browsers over WebRTC (encrypted, nothing recorded); with several people
  each browser connects to each other one. The API (`server/src/services/voice.ts`, Socket.IO at `/api/socket.io`)
  only handles who is online, rooms, invitations and the WebRTC set-up messages. STUN finds a direct path; the
  optional coturn TURN server relays audio when there is none. TURN logins are short-lived (12 hours) and made from `TURN_SECRET`.
- Voice chat runs in one API process (rooms are kept in memory). For several API processes you would add the
  Socket.IO Redis adapter. In demo mode (no `VITE_API_BASE`) the page explains that calls need the server.

## Admin panel (`/admin`)

| Section | What it does |
|---|---|
| Dashboard | Revenue, paid and pending orders, unread messages, content counts, recent activity |
| Content | Add, edit, hide/publish, reorder and delete grammar topics and lessons, vocabulary, spoken English lessons, quiz categories, quizzes (with questions), courses (price, curriculum) and blog posts |
| Orders & payments | Every course order with Cashfree payment ID and UTR, status filters, search, "Check" against Cashfree, refunds, CSV export |
| Messages | Contact form inbox: read, reply by email, archive, delete |
| Site settings | Site name, tagline, contact details, social links, home-page numbers, Listen voice |
| Payment gateway | Turn payments on/off, sandbox or production, Cashfree App ID and Secret key (stored encrypted), key test, webhook URL |
| Admins | Owners (everything) and editors (content, orders, messages); add, disable, reset passwords |
| Activity log | Every sign-in and change, with who did it |

## Policy pages and pricing (payment gateway approval)

Cashfree (and most Indian payment gateways) check for these public pages before approving a website. All are server-rendered, linked from the footer and listed in `/sitemap.xml`:

- `/contact`: Contact Us, with the legal business name, email, phone, WhatsApp, registered address and GSTIN.
- `/terms`, `/refunds`, `/privacy`: Terms and Conditions, Refunds and Cancellations, Privacy Policy.
- `/pricing`: every subscription plan and course with its price in INR, plus the free lessons.

Edit the business details and the policy text in **Admin → Policies & business** (owner only; stored in the `settings` table under `policies`). The text uses `{business}`, `{address}`, `{email}`, `{phone}` and `{jurisdiction}` placeholders, so filling in the business details once updates every page. Default wording lives in `src/data/policies.ts`.

## Backend and payments (`server/`)

```bash
# 1. PostgreSQL (or use your own server)
docker compose -f server/docker-compose.yml up -d

# 2. API
cd server
cp .env.example .env      # set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PUBLIC_SITE_URL, API_PUBLIC_URL
npm install
npm run dev               # http://localhost:4000 — creates tables, loads the built-in content, creates the first admin

# 3. Website pointed at the API
cd ..
echo "VITE_API_BASE=http://localhost:4000/api" > .env
npm run dev               # open http://localhost:5173/admin
```

- **Content** lives in the `content_items` table. On first start the API loads `server/seed/content.json`, which is generated
  from `src/data/*.ts` by `npm run export-content`. After that, the admin panel is the source of truth.
- **Payments:** a course with a price shows a Buy button. The API creates a Cashfree order (the price always comes from the
  database), the browser opens Cashfree checkout, and Cashfree returns to `/payment/status`. The order is confirmed by asking
  Cashfree's API, both on that return and from the signed webhook at `/api/webhooks/cashfree`, so a payment is never marked paid
  on the browser's word. Add your keys in Admin → Payment gateway and the webhook URL in the Cashfree dashboard.
- **Security:** admin passwords are bcrypt-hashed; sessions are signed JWTs kept in sessionStorage; sign-in is rate-limited;
  the Cashfree secret is AES-256-GCM encrypted at rest and only ever shown masked; webhook signatures are checked on the raw body.
- **Production:** `npm run build` in the root, then `cd server && npm run build && npm start`. The API serves the built site from
  `dist/` too, so one Node process (behind Nginx/HTTPS) runs everything; build the site with `VITE_API_BASE=/api` in that case.
- Add more admins in the panel, or from the terminal: `npm run create-admin -- you@example.com "Your Name" owner`.

## Project structure

```
src/
├── components/   Reusable UI: Navbar, Footer, Button, Badge, Card, Modal, Alert, Tabs, Breadcrumbs,
│                 ProgressBar, Skeleton, FormField, CourseCard, LessonCard, VocabularyCard, QuizCard,
│                 BlogCard, TopicCard, Dialogue, QuizRunner, SearchDialog, WordOfTheDay, ...
├── pages/        Home, Grammar (dashboard/topic/lesson), Vocabulary (list/detail), SpokenEnglish
│                 (list/lesson), Quiz (categories/category/play), Courses (list/detail), Blog
│                 (list/article), Contact, Dashboard, Search, Auth (Login/Register), SpeakLive, NotFound
├── voice/        useVoiceChat (WebRTC + Socket.IO), VoiceContext (online presence, call pop-ups on every page)
├── admin/        Admin panel: AdminApp (routes), pages/, schemas.ts (form definition per content type),
│                 api/ (http client for server/, plus the in-browser demo backend)
├── data/         Built-in content: grammar.ts, vocabulary.ts, spokenEnglish.ts, quizzes.ts, courses.ts,
│                 blog.ts, site.ts; content.ts applies the admin-managed content over these at start-up
├── layouts/      MainLayout.tsx (navbar, footer, lazy-route Suspense)
├── routes/       AppRoutes.tsx (all routes, lazy loaded)
├── context/      AuthContext (learner accounts and owned courses), LearningContext (progress, favourites, scores, streak)
├── seo/          routeSeo.ts (title, description, canonical, Open Graph, JSON-LD for every URL), SeoHead.tsx
├── entry-server.tsx  Server rendering entry used by the API to send search engines full HTML
├── hooks/        useDebounce
├── utils/        api.ts, search.ts, quiz.ts, speech.ts, storage.ts, sitemap.ts, format.ts, cn.ts
└── types/        Shared TypeScript interfaces
server/
├── src/routes/   public.ts (content, orders, contact), account.ts (learner sign-up/login, /me), admin.ts (admin API), webhooks.ts (Cashfree)
├── src/services/ cashfree.ts, orders.ts, settings.ts (encrypted gateway keys), content.ts, auth.ts, learners.ts, voice.ts (voice chat),
│                 ssr.ts (server-rendered pages, sitemap.xml, robots.txt)
└── seed/         content.json (built-in content loaded into an empty database)
```

## Customising

- **Site name, email, WhatsApp, location, social links, home-page stats:** Admin → Site settings (defaults in `src/data/site.ts`)
- **Listen voice:** Admin → Site settings → Listen voice. Automatic picks a friendly female English voice (Edge's natural
  voices, Google UK English Female, Samantha, Zira and so on) with a slightly higher pitch; you can choose a named voice, pitch
  and speed and try it there. Voices come from each visitor's browser, so a named voice falls back to Automatic where it is missing.
- **Content:** Admin → Content. The arrays in `src/data/*.ts` are only the starting content.
- **Colours and fonts:** the `@theme` block in `src/index.css`.

## Extending

- **New content fields:** add the field to `src/types`, to the page that shows it, and to its form in `src/admin/schemas.ts`.
- **Contact form:** messages go to the API and appear in Admin → Messages. See `src/utils/api.ts`.
- **Auth:** learner accounts live in `src/context/AuthContext.tsx` and `src/utils/account.ts`; wrap a route in
  `<RequireAuth>` (see `src/routes/AppRoutes.tsx`) to make it members-only.
- **Progress:** `src/context/LearningContext.tsx` stores progress in localStorage; swap the storage calls for
  API calls to sync across devices.
- **Search:** `src/utils/search.ts` searches local data; replace `search()` with a server call.
- **SEO:** see [docs/SEO.md](docs/SEO.md). Page titles, descriptions and structured data come from
  `src/seo/routeSeo.ts`; new routes need an entry there. The API serves `/sitemap.xml` (from `src/utils/sitemap.ts`).

## SEO

Pages are rendered on the server so search engines get full HTML, with titles, descriptions,
canonical links, Open Graph tags, JSON-LD, `/sitemap.xml` and `/robots.txt`, and each content item
has editable SEO fields in the admin panel. Setup steps for Google Search Console and Bing are in
[docs/SEO.md](docs/SEO.md).

## Hosting

With Docker (above), Nginx sends page requests to the API, which renders them for search engines.
On a static host the site still works as a single-page app: serve `index.html` for unknown paths
(Netlify `_redirects`: `/* /index.html 200`; Vercel does this automatically), but pages are then
drawn in the browser only.
