# English-Bridgeway mobile app

Flutter app for Android and iOS, built from the Stitch designs ("Luminous Clarity": indigo
`#4F5DF5`, yellow `#FFD93D`, navy `#1A2B7B`, Plus Jakarta Sans). It uses the same API and the
same learner accounts as the website, so whatever the admin panel changes shows up in the app.

## What's in it

| Tab | Screens |
| --- | --- |
| Home | Signed out: hero, streak and current lesson, stats, learning paths, new lessons, popular courses, word of the day. Signed in: **dashboard** with greeting, streak, lessons done, quiz average, this week's activity, the course in progress with Resume, shortcuts, up next (grammar, speaking, quiz), my courses, word of the day |
| Learn | Grammar (topics, lessons with rules, examples, mistakes and practice), Vocabulary (search, categories, saved words), Spoken English (dialogues with listen buttons), Speak with AI, E-books, Blog |
| Quiz | Quiz categories, quiz runner with instant feedback and a review, best scores |
| Courses | Course list, course page with curriculum and trial locks, Cashfree checkout, subscription plans |
| Profile | Log in / sign up, profile photo, plan and usage, edit profile, orders, contact form, policies, log out of all devices |

- **Welcome pages**: three pages on the first start after an install (what the app teaches, the
  AI tutor call with the mic on by itself and mistakes explained in Marathi, the dashboard), then
  Create account / Log in / Explore first. Seen once (`onboarding-done` in shared preferences).
- **Update popup**: on start the app checks for a newer version. Installed from Google Play, it uses
  Play's in-app update (update priority 4 or 5 in the Play Developer API makes it required). Installed
  from the APK, it reads `GET /api/app/version` and offers the APK published in **Admin → Mobile app**;
  "Update now" opens the download in the browser, and Android installs it over the old app (data
  and login are kept because it's signed with the same key). "Later" asks again a day later; a
  version marked **Required update** in the admin blocks the app until it's updated.
- **Speak with AI**: chat with Bridget by typing or speaking (speech-to-text). Replies are read
  aloud in the ElevenLabs voice when the server has it set up (`/api/ai/speak`), otherwise in the
  phone's voice. Corrections show in a yellow box. Situations: free talk, interview, restaurant,
  shopping, travel, doctor, office.
- **Listen buttons** on words, examples and dialogue lines use the phone's text-to-speech with the
  rate and pitch from Admin → Site settings → Listen voice.
- **Offline first**: the app ships with a copy of `server/seed/content.json`, shows the last
  content it downloaded, and refreshes from `GET /api/content` on start (pull down to refresh).
- **Progress** (finished lessons, quiz scores, saved words, streak) is kept on the phone, like
  the website keeps it in the browser.
- **E-books**: Learn → E-books lists the PDFs from Admin → E-books. Learners with a paid course
  (bought on the website or in the app) read them in the app (`pdfrx` viewer) or download them
  (the phone's browser saves the PDF); others see a lock and why. The server checks access for
  every PDF request.
- **Access rules** match the website: free trial lessons per course, bought courses, plans and
  special offer prices all come from `GET /api/me`.

Not in the app yet: Speak Live (the WebRTC calls and team rooms). Learners use it on the website
(Profile → Open the website).

## API endpoints used

`GET /content`, `GET /payments/config`, `POST /messages`, `POST /auth/register`, `POST /auth/login`,
`GET|PATCH /me`, `PUT|DELETE /me/avatar`, `GET /avatars/:id`, `GET /me/orders`, `POST /me/logout-all`,
`POST /orders`, `GET /orders/:id`, `GET /ai/status`, `POST /ai/chat`, `POST /ai/speak`, `GET /ebooks`,
`POST /ebooks/:id/link`, `GET /ebooks/:id/file` (signed link), `GET /ebooks/:id/cover`, `GET /app/version`, `GET /app/android.apk`. Mobile apps don't send an `Origin` header, so `CORS_ORIGINS` doesn't
need the app.

## Run it

Needs Flutter 3.47 (Dart 3.13) and Android Studio or Xcode.

```bash
cd mobile
flutter pub get
flutter run                                   # talks to https://englishbridgeway.com/api
flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api   # local server from the Android emulator
```

`flutter analyze` and `flutter test` should both pass.

## Releasing an update to APK users

1. Raise `version:` in `pubspec.yaml` when the release has something new (for example `1.1.0` to `1.2.0`).
2. Publish a GitHub Release (**Actions → Mobile release**). The server reads the latest release
   (tag `app-v1.1.0-build10100`, an `.apk` asset) and phones are offered it; the "- " lines of its
   notes before "## Install" show in the popup. Nothing else to do.
3. Or, without a release: take the `english-bridgeway-apk` artifact from a **Mobile app** run and upload
   `app-release.apk` in **Admin → Mobile app** with the version and build number from the run summary.
   The admin page also has **Required update**, which applies to releases too.

The build number comes from the version (major × 10000 + minor × 100 + patch, so 1.1.0 is 10100).

Phones with an older build show the update popup the next time the app starts. An uploaded APK's
build number must match the APK, or phones will keep asking to update.

Android only installs an update signed with the same key as the installed app. The workflow signs
the APK with the upload key when the `ANDROID_KEYSTORE_*` secrets are set (see below); without them
each run gets a temporary key, the run summary warns, and that APK can't be published as an update.
A phone that has an APK with a temporary key (any APK built before the secrets were added) needs to
uninstall it once and install a signed APK; after that, updates install over it.

## Build for the stores

```bash
flutter build apk --release        # Android APK (mobile/build/app/outputs/flutter-apk/app-release.apk)
flutter build appbundle --release  # Android App Bundle for Google Play
flutter build ipa --release        # iOS (on a Mac with Xcode)
```

The GitHub Action in `.github/workflows/mobile.yml` runs analyze and tests and builds an APK on
every pull request that touches `mobile/`. Download it from the run's **Artifacts**. Run the
workflow by hand (Actions → Mobile app → Run workflow) to build against another API.

Before publishing:

- **Android signing**: create an upload keystore once and keep it (and its passwords) safe:
  `keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`.
  To build on your computer, put the file in `android/app/` and write `android/key.properties`
  (`storeFile=upload-keystore.jks`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…`); both are
  git-ignored. Without that file, release builds are signed with the debug key.
- **Signed bundle from GitHub**: add the repository secrets `ANDROID_KEYSTORE_BASE64`
  (`base64 -w0 upload-keystore.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
  `ANDROID_KEY_PASSWORD`, then run the workflow by hand. The `english-bridgeway-aab` artifact is
  the file to upload to Google Play. Its version code is the run number, so every run can be uploaded.
- **No buying in the Play build**: Google Play requires its own billing for digital courses, so the
  bundle is built with `--dart-define=IN_APP_PURCHASES=false`. That build shows no prices, plans or
  buy buttons; learners buy on the website and their courses unlock in the app after they log in.
  The APK from pull requests keeps Cashfree checkout for testing.
- **App id**: `com.englishbridgeway.english_bridgeway` (Android `applicationId`, iOS bundle id).
  Change it before the first upload if you want another one; it can't change afterwards.
- **iOS**: open `ios/Runner.xcworkspace`, pick your team under Signing & Capabilities. Microphone,
  speech recognition, camera and photo permission texts are already in `Info.plist`.
- **Payments**: Cashfree uses the same mode (sandbox or production) as the website, from Admin →
  Payments. Test a sandbox payment on a real phone before going live.

## Code map

```
lib/
  main.dart            app start, providers, splash
  theme.dart           design tokens from the Stitch DESIGN.md
  models.dart          content and account types (mirror src/types on the website)
  state.dart           ContentStore, AuthStore (access rules), ProgressStore
  nav.dart             push() and openHref() for website paths in course curricula
  services/            api.dart, payments.dart (Cashfree), speech.dart (text-to-speech), updates.dart (update popup)
  widgets/common.dart  cards, pills, buttons, headers, listen button
  screens/             one file per area (onboarding, home, dashboard, grammar, vocabulary, spoken, quiz, courses, ai_tutor, profile…)
assets/content.json    copy of server/seed/content.json (refresh it when the seed changes)
```
