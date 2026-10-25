import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'screens/auth.dart';
import 'screens/onboarding.dart';
import 'screens/shell.dart';
import 'services/api.dart';
import 'services/speech.dart';
import 'state.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent));
  final prefs = await SharedPreferences.getInstance();
  // Load the brand font before the first frame so text isn't measured with a fallback font.
  try {
    for (final w in [FontWeight.w400, FontWeight.w500, FontWeight.w600, FontWeight.w700, FontWeight.w800]) {
      GoogleFonts.plusJakartaSans(fontWeight: w);
    }
    await GoogleFonts.pendingFonts().timeout(const Duration(seconds: 4));
  } catch (_) {
    // Offline on first launch: the default font is used until the next start.
  }
  final api = Api();
  runApp(BridgewayApp(api: api, prefs: prefs));
}

class BridgewayApp extends StatelessWidget {
  const BridgewayApp({super.key, required this.api, required this.prefs, this.theme});
  final Api api;
  final SharedPreferences prefs;
  final ThemeData? theme;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: api),
        Provider.value(value: prefs),
        ChangeNotifierProvider(create: (_) => ContentStore(api, prefs)..load()),
        ChangeNotifierProvider(create: (_) => AuthStore(api, prefs)..refresh()),
        ChangeNotifierProvider(create: (_) => ProgressStore(prefs)),
      ],
      child: MaterialApp(
        title: 'English-Bridgeway',
        debugShowCheckedModeBanner: false,
        navigatorKey: rootNavigatorKey,
        theme: theme ?? buildTheme(),
        home: const _Loader(),
      ),
    );
  }
}

/// The app's root navigator, for screens opened from outside a page (after the welcome pages).
final rootNavigatorKey = GlobalKey<NavigatorState>();

/// Shows the splash until the content (bundled, cached or live) is in, then the welcome pages
/// on the first start, then the app.
class _Loader extends StatefulWidget {
  const _Loader();
  @override
  State<_Loader> createState() => _LoaderState();
}

class _LoaderState extends State<_Loader> {
  late bool _onboarded = context.read<SharedPreferences>().getBool(onboardingDoneKey) ?? false;

  void _finishOnboarding(OnboardingExit exit) {
    context.read<SharedPreferences>().setBool(onboardingDoneKey, true);
    setState(() => _onboarded = true);
    if (exit == OnboardingExit.explore) return;
    WidgetsBinding.instance.addPostFrameCallback((_) => rootNavigatorKey.currentState
        ?.push(MaterialPageRoute(builder: (_) => AuthScreen(startWithRegister: exit == OnboardingExit.register))));
  }

  @override
  Widget build(BuildContext context) {
    final content = context.watch<ContentStore>();
    if (!content.ready) return const SplashScreen();
    Speech.instance
      ..rate = content.data.site.voiceRate
      ..pitch = content.data.site.voicePitch;
    if (!_onboarded) return OnboardingScreen(onDone: _finishOnboarding);
    return const MainShell();
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.indigo,
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            ClipRRect(borderRadius: BorderRadius.circular(24), child: Image.asset('assets/logo.png', width: 96, height: 96)),
            const SizedBox(height: 18),
            const Text('English-Bridgeway', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text('Speak with confidence', style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
            const SizedBox(height: 28),
            const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(color: AppColors.yellow, strokeWidth: 2.5)),
          ]),
        ),
      );
}
