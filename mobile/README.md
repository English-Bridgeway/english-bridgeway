# English-Bridgeway mobile app

Flutter app for Android and iOS, built from the Stitch designs ("Luminous Clarity": indigo
`#4F5DF5`, yellow `#FFD93D`, navy `#1A2B7B`, Plus Jakarta Sans). It uses the same API and the
same learner accounts as the website, so whatever the admin panel changes shows up in the app.

## What's in it

| Tab | Screens |
| --- | --- |
| Home | Hero, streak and current lesson, stats, learning paths, new lessons, popular courses, word of the day |
| Learn | Grammar (topics, lessons with rules, examples, mistakes and practice), Vocabulary (search, categories, saved words), Spoken English (dialogues with listen buttons), Speak with AI, Blog |
| Quiz | Quiz categories, quiz runner with instant feedback and a review, best scores |
| Courses | Course list, course page with curriculum and trial locks, Cashfree checkout, subscription plans |
| Profile | Log in / sign up, profile photo, plan and usage, edit profile, orders, contact form, policies, log out of all devices |

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
- **Access rules** match the website: free trial lessons per course, bought courses, plans and
  special offer prices all come from `GET /api/me`.

Not in the app yet: Speak Live (the WebRTC calls and team rooms). Learners use it on the website
(Profile → Open the website).

## API endpoints used

`GET /content`, `GET /payments/config`, `POST /messages`, `POST /auth/register`, `POST /auth/login`,
`GET|PATCH /me`, `PUT|DELETE /me/avatar`, `GET /avatars/:id`, `GET /me/orders`, `POST /me/logout-all`,
`POST /orders`, `GET /orders/:id`, `GET /ai/status`, `POST /ai/chat`, `POST /ai/speak`.
No server changes were needed. Mobile apps don't send an `Origin` header, so `CORS_ORIGINS` doesn't
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
  services/            api.dart, payments.dart (Cashfree), speech.dart (text-to-speech)
  widgets/common.dart  cards, pills, buttons, headers, listen button
  screens/             one file per area (home, grammar, vocabulary, spoken, quiz, courses, ai_tutor, profile…)
assets/content.json    copy of server/seed/content.json (refresh it when the seed changes)
```
