import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
        ChangeNotifierProvider(create: (_) => ContentStore(api, prefs)..load()),
        ChangeNotifierProvider(create: (_) => AuthStore(api, prefs)..refresh()),
        ChangeNotifierProvider(create: (_) => ProgressStore(prefs)),
      ],
      child: MaterialApp(
        title: 'English-Bridgeway',
        debugShowCheckedModeBanner: false,
        theme: theme ?? buildTheme(),
        home: const _Loader(),
      ),
    );
  }
}

/// Shows the splash until the content (bundled, cached or live) is in.
class _Loader extends StatelessWidget {
  const _Loader();
  @override
  Widget build(BuildContext context) {
    final content = context.watch<ContentStore>();
    if (!content.ready) return const SplashScreen();
    Speech.instance
      ..rate = content.data.site.voiceRate
      ..pitch = content.data.site.voicePitch;
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
