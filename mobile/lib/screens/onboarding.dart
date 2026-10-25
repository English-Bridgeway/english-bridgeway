import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';

/// Set once the learner has seen the welcome pages, so they only show after a new install.
const onboardingDoneKey = 'onboarding-done';

enum OnboardingExit { explore, register, login }

/// Three welcome pages on the first start: what the app teaches, the AI tutor call, and the
/// dashboard that follows the learner's progress.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});
  final ValueChanged<OnboardingExit> onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _Page {
  const _Page(this.art, this.title, this.body, this.points);
  final Widget art;
  final String title, body;
  final List<(IconData, String)> points;
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pages = PageController();
  int _index = 0;

  static const _content = [
    _Page(
      _LearnArt(),
      'Learn English, step by step',
      'Bite-sized lessons for every level, from your first sentence to fluent conversations.',
      [
        (Icons.spellcheck_rounded, 'Grammar and vocabulary with audio for every word'),
        (Icons.forum_outlined, 'Real-life conversations and full courses'),
        (Icons.quiz_outlined, 'Quizzes with instant feedback'),
      ],
    ),
    _Page(
      _TutorArt(),
      'Call Bridget, your AI tutor',
      'Tap call and just speak. The mic turns on by itself, so it feels like a real phone call.',
      [
        (Icons.mic_rounded, 'Hands-free: Bridget listens, then answers out loud'),
        (Icons.auto_fix_high_rounded, 'She points out each mistake and gives the correct sentence'),
        (Icons.translate_rounded, 'Mistakes explained in Marathi, so you really understand'),
      ],
    ),
    _Page(
      _DashboardArt(),
      'Your progress, all in one place',
      'Log in and Home becomes your dashboard. Pick up your course exactly where you left off.',
      [
        (Icons.play_circle_outline_rounded, 'Resume your course with one tap'),
        (Icons.local_fire_department_outlined, 'Keep your daily streak going'),
        (Icons.local_library_outlined, 'E-books, quizzes and shortcuts to everything'),
      ],
    ),
  ];

  bool get _last => _index == _content.length - 1;

  void _next() => _pages.nextPage(duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        child: Column(children: [
          SizedBox(
            height: 52,
            child: Row(children: [
              const SizedBox(width: 16),
              ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.asset('assets/logo.png', width: 30, height: 30)),
              const SizedBox(width: 8),
              const Text('ENGLISH-BRIDGEWAY', style: TextStyle(fontSize: 11, letterSpacing: 0.8, fontWeight: FontWeight.w800, color: AppColors.primary)),
              const Spacer(),
              AnimatedOpacity(
                opacity: _last ? 0 : 1,
                duration: const Duration(milliseconds: 200),
                child: TextButton(
                  onPressed: _last ? null : () => widget.onDone(OnboardingExit.explore),
                  child: const Text('Skip', style: TextStyle(color: AppColors.outline, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 8),
            ]),
          ),
          Expanded(
            child: PageView.builder(
              controller: _pages,
              itemCount: _content.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (_, i) => _PageView(page: _content[i]),
            ),
          ),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < _content.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: i == _index ? 26 : 8,
                height: 8,
                decoration: BoxDecoration(color: i == _index ? AppColors.indigo : AppColors.outlineVariant, borderRadius: BorderRadius.circular(99)),
              ),
          ]),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
            child: _last
                ? Column(children: [
                    AppButton('Create free account', kind: ButtonKind.indigo, icon: Icons.arrow_forward_rounded,
                        onPressed: () => widget.onDone(OnboardingExit.register)),
                    const SizedBox(height: 10),
                    AppButton('I already have an account', kind: ButtonKind.ghost, onPressed: () => widget.onDone(OnboardingExit.login)),
                    TextButton(
                      onPressed: () => widget.onDone(OnboardingExit.explore),
                      child: const Text('Explore first', style: TextStyle(color: AppColors.outline, fontWeight: FontWeight.w600)),
                    ),
                  ])
                : AppButton('Next', kind: ButtonKind.indigo, icon: Icons.arrow_forward_rounded, onPressed: _next),
          ),
        ]),
      ),
    );
  }
}

class _PageView extends StatelessWidget {
  const _PageView({required this.page});
  final _Page page;
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      // Short phones give the picture less room so the text never scrolls off.
      final artHeight = (box.maxHeight * 0.44).clamp(170.0, 300.0);
      return SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SizedBox(height: 4),
          SizedBox(height: artHeight, width: double.infinity, child: page.art),
          const SizedBox(height: 22),
          Text(page.title, style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w800, height: 1.2, letterSpacing: -0.4)),
          const SizedBox(height: 8),
          Text(page.body, style: const TextStyle(fontSize: 14.5, height: 1.5, color: AppColors.onSurfaceVariant)),
          const SizedBox(height: 16),
          for (final (icon, text) in page.points)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(color: AppColors.sky, borderRadius: BorderRadius.circular(10)),
                  child: Icon(icon, size: 18, color: AppColors.indigo),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.35))),
              ]),
            ),
        ]),
      );
    });
  }
}

/// Indigo panel with soft glows, the backdrop of each picture.
class _ArtFrame extends StatelessWidget {
  const _ArtFrame({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.circular(28)),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          Positioned(right: -50, top: -50, child: _glow(200, Colors.white.withValues(alpha: 0.12))),
          Positioned(left: -40, bottom: -40, child: _glow(170, AppColors.yellow.withValues(alpha: 0.18))),
          Center(child: Padding(padding: const EdgeInsets.all(18), child: FittedBox(child: child))),
        ]),
      );

  static Widget _glow(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)])),
      );
}

class _Bubble extends StatelessWidget {
  const _Bubble(this.text, {this.mine = false, this.label});
  final String text;
  final bool mine;
  final String? label;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(maxWidth: 230),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: mine ? AppColors.yellow : Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: cardShadow,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          if (label != null)
            Text(label!, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.indigo)),
          Text(text, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.navy, height: 1.35)),
        ]),
      );
}

class _LearnArt extends StatelessWidget {
  const _LearnArt();
  @override
  Widget build(BuildContext context) {
    Widget tile(IconData icon, String title, String sub, Color bg, Color fg) => Container(
          width: 128,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: cardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 34, height: 34, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: fg, size: 19)),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.navy)),
            Text(sub, style: const TextStyle(fontSize: 11, color: AppColors.outline, fontWeight: FontWeight.w500)),
          ]),
        );
    return _ArtFrame(
      child: Column(children: [
        Row(children: [
          tile(Icons.spellcheck_rounded, 'Grammar', 'Tenses, articles…', AppColors.sky, AppColors.indigo),
          const SizedBox(width: 12),
          tile(Icons.translate_rounded, 'Vocabulary', 'Listen & save', AppColors.amberSoft, AppColors.amberText),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          tile(Icons.forum_outlined, 'Speaking', 'Conversations', AppColors.amberSoft, AppColors.amberText),
          const SizedBox(width: 12),
          tile(Icons.quiz_outlined, 'Quizzes', 'Instant feedback', AppColors.sky, AppColors.indigo),
        ]),
      ]),
    );
  }
}

class _TutorArt extends StatelessWidget {
  const _TutorArt();
  @override
  Widget build(BuildContext context) => _ArtFrame(
        child: Column(children: [
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(color: AppColors.yellow, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3)),
              child: const Icon(Icons.support_agent_rounded, color: AppColors.navy, size: 30),
            ),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Bridget', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
              Row(children: [
                Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text('On call · listening', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ]),
          ]),
          const SizedBox(height: 16),
          const Align(alignment: Alignment.centerRight, child: _Bubble('Yesterday I go to market.', mine: true)),
          const SizedBox(height: 8),
          const Align(alignment: Alignment.centerLeft, child: _Bubble('Yesterday I went to the market.', label: 'CORRECTION')),
          const SizedBox(height: 8),
          const Align(alignment: Alignment.centerLeft, child: _Bubble('भूतकाळासाठी "go" ऐवजी "went" वापरा.', label: 'EXPLAINED IN MARATHI')),
          const SizedBox(height: 16),
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.white.withValues(alpha: 0.35), blurRadius: 16, spreadRadius: 4)]),
              child: const Icon(Icons.mic_rounded, color: AppColors.indigo, size: 26),
            ),
            const SizedBox(width: 18),
            Container(
              width: 50,
              height: 50,
              decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
              child: const Icon(Icons.call_end_rounded, color: Colors.white, size: 24),
            ),
          ]),
        ]),
      );
}

class _DashboardArt extends StatelessWidget {
  const _DashboardArt();
  @override
  Widget build(BuildContext context) => _ArtFrame(
        child: Container(
          width: 264,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: floatingShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(children: [
              Text('Hi Priya 👋', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.navy)),
              Spacer(),
              Icon(Icons.local_fire_department_rounded, color: Color(0xFFF59E0B), size: 18),
              Text(' 5', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy)),
            ]),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.borderSky.withValues(alpha: 0.5))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('CONTINUE COURSE', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.outline)),
                const SizedBox(height: 2),
                const Text('Spoken English in 30 Days', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: AppColors.navy)),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: const LinearProgressIndicator(value: 0.62, minHeight: 7, backgroundColor: AppColors.sky, color: AppColors.indigo),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  const Text('62% · Lesson 12 of 20', style: TextStyle(fontSize: 11, color: AppColors.outline, fontWeight: FontWeight.w600)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.circular(99)),
                    child: const Text('Resume', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ]),
              ]),
            ),
            const SizedBox(height: 10),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              for (final (icon, label) in const [
                (Icons.record_voice_over_rounded, 'AI call'),
                (Icons.spellcheck_rounded, 'Grammar'),
                (Icons.quiz_outlined, 'Quiz'),
                (Icons.local_library_outlined, 'E-books'),
              ])
                Column(children: [
                  Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.sky, borderRadius: BorderRadius.circular(12)), child: Icon(icon, size: 20, color: AppColors.indigo)),
                  const SizedBox(height: 4),
                  Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.navy)),
                ]),
            ]),
          ]),
        ),
      );
}
