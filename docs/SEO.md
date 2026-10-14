# SEO for englishbridgeway.com

## What the site does for search engines

- **Real HTML for every page.** The API server renders each public page (home, grammar, vocabulary,
  spoken English, quizzes, courses, blog, contact) with React before sending it, so Google, Bing,
  WhatsApp and Facebook see the full text, headings and links without running JavaScript. The
  browser then takes over the same HTML (hydration), which also makes the first paint faster.
  Pages for signed-in learners (`/dashboard`, `/speak`, `/payment/*`) and `/admin` are drawn in the
  browser only and are marked `noindex`.
- **Title, description, canonical URL, robots, Open Graph and X (Twitter) tags** for every URL,
  written from the content itself (`src/seo/routeSeo.ts`). Unknown URLs and missing items answer with
  a real **404** and `noindex`. `/grammar/` redirects to `/grammar` (301) so each page has one URL.
- **Structured data (JSON-LD):** EducationalOrganization and WebSite with a sitelinks search box on
  every page; BreadcrumbList on inner pages; Course with offer (price in INR) and course instance on
  course pages; ItemList on course, topic and quiz-category lists; Article + LearningResource for
  grammar lessons; Quiz (with questions, answers and explanations) for quizzes and lesson practice;
  DefinedTerm for vocabulary words; LearningResource for spoken English lessons; BlogPosting for
  blog articles.
- **`/sitemap.xml`** lists every published, indexable page with its last-edited date, generated from
  the live database. **`/robots.txt`** allows everything except `/admin`, `/api/`, `/dashboard` and
  `/payment/`, and points to the sitemap.
- **Admin-editable SEO:** every content item (lessons, words, quizzes, courses, blog posts, ...) has a
  *Search engines (SEO)* section with SEO title, meta description (with a length counter), social
  share image, and *Hide this page from search engines*. Admin → Site settings → *Search engines*
  holds the Google and Bing verification codes, the default share image and the X handle. Changes
  show in the rendered pages and the sitemap immediately.
- **Share image and icons:** `public/og-image.png` (1200 × 630), app icons and a web manifest.

The canonical address comes from Admin → Site settings → *Website address*. Until that is set to the
real domain, the server uses `PUBLIC_SITE_URL`, and the site never publishes a `.example` or
`localhost` address (it falls back to `https://englishbridgeway.com`).

## Going live checklist

1. In `.env` on the server set `PUBLIC_SITE_URL=https://englishbridgeway.com` and
   `API_PUBLIC_URL=https://englishbridgeway.com`, then `docker compose up -d --build`.
2. Admin → Site settings: set *Website address* to `https://englishbridgeway.com` and replace the
   placeholder contact email and WhatsApp number.
3. Pick one address and redirect the other. In the host Nginx (the one with certbot):

   ```nginx
   server {
     listen 443 ssl;
     server_name www.englishbridgeway.com;
     # ssl_certificate lines from certbot
     return 301 https://englishbridgeway.com$request_uri;
   }
   ```

   and make sure `http://` redirects to `https://` (certbot's "redirect" option does this).
4. Check a page as Google sees it: `curl -s https://englishbridgeway.com/grammar | grep -o "<title>.*</title>"`
   should print the grammar page title, and `https://englishbridgeway.com/sitemap.xml` should list
   the pages.

## Google Search Console

1. Open <https://search.google.com/search-console> and sign in with the Google account that should
   own the site.
2. **Add property** → choose **Domain** → enter `englishbridgeway.com`. Google shows a TXT record
   (`google-site-verification=...`). Add it in your domain's DNS (Hostinger → Domains → DNS / Nameservers →
   add a TXT record with host `@`), wait a few minutes, then click **Verify**. A Domain property covers
   `https`, `http`, `www` and every subdomain.

   *Alternative without DNS:* choose **URL prefix** → `https://englishbridgeway.com/` → **HTML tag**.
   Copy only the `content="..."` value, paste it in Admin → Site settings → *Google Search Console code*,
   save, then click **Verify**.
3. **Sitemaps** (left menu) → enter `sitemap.xml` → **Submit**. Status should turn to *Success* with
   the number of discovered pages.
4. **URL inspection** → paste `https://englishbridgeway.com/` → **Request indexing**. Repeat for the
   most important pages (courses, grammar, a few lessons). Use **Test live URL → View tested page →
   Screenshot/HTML** to confirm Google sees the full content.
5. Over the next days check **Pages** (indexing), **Enhancements** (Breadcrumbs, Courses, Sitelinks
   search box, Review snippets if any) and **Core Web Vitals**. Fix anything marked *Error*.
6. Optional: **Settings → Associations** to link Google Analytics; **Links** to watch who links to you.

## Bing Webmaster Tools (also feeds DuckDuckGo, Yahoo and ChatGPT search)

1. Open <https://www.bing.com/webmasters> → **Import from Google Search Console** (fastest), or add the
   site and choose **HTML Meta Tag**: paste the `msvalidate.01` code in Admin → Site settings → *Bing
   Webmaster code*, save, verify.
2. **Sitemaps** → submit `https://englishbridgeway.com/sitemap.xml`.

## Checking structured data

- <https://search.google.com/test/rich-results> with a course, lesson or blog URL.
- <https://validator.schema.org> for the full JSON-LD.
- <https://www.opengraph.xyz> or WhatsApp itself to preview share cards.

## Content tips that move rankings

- Write a unique SEO title (under 60 characters) and description (120 to 160 characters) for the
  most important pages, using the words learners search for ("present simple tense examples",
  "English speaking practice online").
- Publish blog posts regularly and link to lessons and courses from them.
- Ask partners, schools and social profiles to link to the site, and put the real social links in
  Admin → Site settings (they become `sameAs` in the Organization data).
