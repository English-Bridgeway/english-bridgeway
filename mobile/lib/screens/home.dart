import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'courses.dart';
import 'dashboard.dart';
import 'grammar.dart';
import 'quiz.dart';
import 'shell.dart';
import 'spoken.dart';
import 'vocabulary.dart';
import 'ai_tutor.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final content = context.watch<ContentStore>();
    final data = content.data;
    // Signed in, Home is the learner's dashboard; visitors see the welcome page.
    final signedIn = context.watch<AuthStore>().signedIn;
    return Scaffold(
      appBar: BrandBar(signedIn ? 'Dashboard' : 'Home'),
      body: RefreshIndicator(
        onRefresh: () async {
          await content.refresh();
          if (context.mounted) await context.read<AuthStore>().refresh();
        },
        child: signedIn ? const DashboardView() : ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            const _Hero(),
            // The streak card overlaps the bottom of the hero, as in the design.
            Transform.translate(
              offset: const Offset(0, -34),
              child: const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _StreakCard()),
            ),
            _Stats(stats: data.site.stats),
            const SizedBox(height: 28),
            const SectionHeading("What you'll learn", subtitle: 'Structured pathways for fluency', action: 'Swipe across'),
            const _Pathways(),
            const SizedBox(height: 28),
            SectionHeading('New lessons', action: 'Browse all', onAction: () => MainShell.of(context).select(1)),
            const _NewLessons(),
            const SizedBox(height: 28),
            SectionHeading('Popular courses', action: 'View all', onAction: () => MainShell.of(context).select(3)),
            SizedBox(
              height: 222,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: data.courses.length,
                separatorBuilder: (_, _) => const SizedBox(width: 14),
                itemBuilder: (_, i) => SizedBox(width: 262, child: CourseCard(course: data.courses[i], compact: true)),
              ),
            ),
            const SizedBox(height: 28),
            if (data.vocabularyWords.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: WordOfTheDay(word: data.vocabularyWords[DateTime.now().difference(DateTime(2024)).inDays % data.vocabularyWords.length]),
              ),
            const SizedBox(height: 28),
            const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _CtaCard()),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();
  @override
  Widget build(BuildContext context) {
    final site = context.watch<ContentStore>().data.site;
    final lines = site.tagline.isEmpty
        ? ['Improve Your English.', 'Speak With Confidence.']
        : site.tagline.split(RegExp(r'(?<=\.)\s+')).map(_titleCase).toList();
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.indigo,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        Positioned(right: -60, top: -60, child: _Glow(220, Colors.white.withValues(alpha: 0.10))),
        Positioned(left: -50, bottom: 10, child: _Glow(170, AppColors.yellow.withValues(alpha: 0.15))),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 56),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99)),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.star_rounded, size: 16, color: Color(0xFFF59E0B)),
                SizedBox(width: 6),
                Flexible(child: Text('Free lessons for every level', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy))),
              ]),
            ),
            const SizedBox(height: 14),
            for (final l in lines)
              Text(l,
                  style: const TextStyle(
                      color: AppColors.yellow, fontSize: 30, fontWeight: FontWeight.w800, height: 1.18, letterSpacing: -0.6)),
            const SizedBox(height: 12),
            Text(
              site.description.isNotEmpty ? site.description : 'Master grammar, expand vocabulary, and speak fluently with free bite-sized lessons.',
              style: TextStyle(color: AppColors.sky.withValues(alpha: 0.95), fontSize: 14, height: 1.55, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 18),
            AppButton('Start Learning', icon: Icons.arrow_forward_rounded, onPressed: () => startLearning(context)),
            const SizedBox(height: 10),
            AppButton('Explore Courses', kind: ButtonKind.glass, onPressed: () => MainShell.of(context).select(3)),
            const SizedBox(height: 16),
            for (final t in const ['No sign-up needed', 'Listen to every word', 'Instant quiz feedback'])
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(children: [
                  const Icon(Icons.check_circle_outline_rounded, color: AppColors.yellow, size: 16),
                  const SizedBox(width: 8),
                  Text(t, style: const TextStyle(color: AppColors.sky, fontSize: 12.5, fontWeight: FontWeight.w600)),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }

  static String _titleCase(String s) =>
      s.split(' ').map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1)).join(' ');
}

class _Glow extends StatelessWidget {
  const _Glow(this.size, this.color);
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)])),
      );
}

/// The grammar lesson to continue: the last one opened, else the first not yet done.
GrammarLesson? currentLesson(ContentBundle data, ProgressStore progress) {
  final last = progress.lastLesson;
  if (last != null) {
    final parts = last.split('/');
    final l = parts.length == 2 ? data.lesson(parts[0], parts[1]) : null;
    if (l != null && !progress.isComplete(l.key)) return l;
  }
  return data.grammarLessons.where((l) => !progress.isComplete(l.key)).firstOrNull ?? data.grammarLessons.firstOrNull;
}

void startLearning(BuildContext context) {
  final data = context.read<ContentStore>().data;
  final lesson = currentLesson(data, context.read<ProgressStore>());
  if (lesson == null) {
    MainShell.of(context).select(1);
  } else {
    push(context, GrammarLessonScreen(topicId: lesson.topicId, lessonId: lesson.id));
  }
}

class _StreakCard extends StatelessWidget {
  const _StreakCard();
  @override
  Widget build(BuildContext context) {
    final progress = context.watch<ProgressStore>();
    final data = context.watch<ContentStore>().data;
    final lesson = currentLesson(data, progress);
    final streak = progress.streak;
    final topicLessons = lesson == null ? <GrammarLesson>[] : data.lessonsFor(lesson.topicId);
    final done = topicLessons.where((l) => progress.isComplete(l.key)).length;
    final pct = topicLessons.isEmpty ? 0.0 : done / topicLessons.length;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: const [BoxShadow(color: Color(0x141A2B7B), blurRadius: 24, offset: Offset(0, 8))],
      ),
      child: Column(children: [
        Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(color: AppColors.yellow, shape: BoxShape.circle),
            child: const Icon(Icons.local_fire_department_rounded, color: AppColors.navy, size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(streak == 0 ? 'Start your streak' : '$streak-day streak',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(streak == 0 ? 'Finish a lesson today' : '${progress.completedLessons.length} lessons completed',
                  style: const TextStyle(fontSize: 12, color: AppColors.outline, fontWeight: FontWeight.w500)),
            ]),
          ),
          Pill(streak == 0 ? "Let's go!" : 'Keep it up!', icon: Icons.thumb_up_alt_outlined),
        ]),
        if (lesson != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderSky.withValues(alpha: 0.4)),
            ),
            child: Column(children: [
              Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('CURRENT LESSON',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.outline, letterSpacing: 0.8)),
                    const SizedBox(height: 2),
                    Text(lesson.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  ]),
                ),
                Pill('${(pct * 100).round()}% complete', background: AppColors.indigo.withValues(alpha: 0.1), foreground: AppColors.indigo),
              ]),
              const SizedBox(height: 10),
              ProgressLine(pct == 0 ? 0.04 : pct, height: 10),
              const SizedBox(height: 10),
              Row(children: [
                const Icon(Icons.schedule_rounded, size: 14, color: AppColors.outline),
                const SizedBox(width: 4),
                Text('${lesson.minutes} min lesson', style: const TextStyle(fontSize: 12, color: AppColors.outline, fontWeight: FontWeight.w500)),
                const Spacer(),
                AppButton('Continue', kind: ButtonKind.indigo, small: true, expand: false,
                    onPressed: () => push(context, GrammarLessonScreen(topicId: lesson.topicId, lessonId: lesson.id))),
              ]),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.stats});
  final List<SiteStat> stats;
  @override
  Widget build(BuildContext context) {
    if (stats.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.3,
        children: [
          for (final s in stats.take(4))
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(children: [
                IconTile(appIcon(s.icon), size: 40),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(s.value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                    Text(s.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: AppColors.outline, fontWeight: FontWeight.w500)),
                  ]),
                ),
              ]),
            ),
        ],
      ),
    );
  }
}

class _Pathways extends StatelessWidget {
  const _Pathways();
  @override
  Widget build(BuildContext context) {
    final d = context.watch<ContentStore>().data;
    final items = [
      (Icons.spellcheck_rounded, 'Grammar', '${d.grammarLessons.length} lessons', () => push(context, const GrammarScreen())),
      (Icons.chat_bubble_outline_rounded, 'Vocabulary', '${d.vocabularyWords.length} words', () => push(context, const VocabularyScreen())),
      (Icons.mic_none_rounded, 'Spoken English', '${d.spokenLessons.length} lessons', () => push(context, const SpokenListScreen())),
      (Icons.quiz_outlined, 'Quizzes', '${d.quizzes.length} quizzes', () => push(context, const QuizHomeScreen(standalone: true))),
      (Icons.record_voice_over_outlined, 'Speak with AI', 'Live practice', () => push(context, const AiTutorScreen())),
    ];
    return SizedBox(
      height: 150,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (_, i) {
          final (icon, title, sub, onTap) = items[i];
          return SizedBox(
            width: 148,
            child: AppCard(
              onTap: onTap,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                IconTile(icon, size: 40),
                const Spacer(),
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.outline)),
                const SizedBox(height: 8),
                const Row(children: [
                  Text('Explore', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.indigo)),
                  SizedBox(width: 4),
                  Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.indigo),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }
}

class _NewLessons extends StatelessWidget {
  const _NewLessons();
  @override
  Widget build(BuildContext context) {
    final d = context.watch<ContentStore>().data;
    final rows = <(IconData, String, String, String, int, Widget)>[
      for (final l in d.grammarLessons.take(2))
        (Icons.menu_book_outlined, 'Grammar', l.level, l.title, l.minutes, GrammarLessonScreen(topicId: l.topicId, lessonId: l.id)),
      for (final s in d.spokenLessons.take(2))
        (Icons.record_voice_over_outlined, 'Speaking', s.level, s.title, s.minutes, SpokenLessonScreen(id: s.id)),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(children: [
        for (final (icon, kind, level, title, minutes, screen) in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: LessonRow(icon: icon, kind: kind, level: level, title: title, minutes: minutes, onTap: () => push(context, screen)),
          ),
      ]),
    );
  }
}

/// Row with icon, "Grammar • Beginner", title, minutes and a play button.
class LessonRow extends StatelessWidget {
  const LessonRow({super.key, required this.icon, required this.kind, required this.level, required this.title, required this.minutes, this.onTap, this.done = false});
  final IconData icon;
  final String kind, level, title;
  final int minutes;
  final VoidCallback? onTap;
  final bool done;
  @override
  Widget build(BuildContext context) => AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          IconTile(icon),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(kind, style: const TextStyle(fontSize: 12, color: AppColors.indigo, fontWeight: FontWeight.w600)),
                const Text('  •  ', style: TextStyle(fontSize: 12, color: AppColors.outline)),
                LevelChip(level),
              ]),
              const SizedBox(height: 4),
              Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Row(children: [
                const Icon(Icons.schedule_rounded, size: 13, color: AppColors.outline),
                const SizedBox(width: 4),
                Text('$minutes min', style: const TextStyle(fontSize: 12, color: AppColors.outline)),
              ]),
            ]),
          ),
          const SizedBox(width: 8),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: done ? AppColors.successSoft : AppColors.sky, shape: BoxShape.circle),
            child: Icon(done ? Icons.check_rounded : Icons.play_arrow_rounded, color: done ? AppColors.success : AppColors.indigo, size: 20),
          ),
        ]),
      );
}

class WordOfTheDay extends StatelessWidget {
  const WordOfTheDay({super.key, required this.word});
  final VocabularyWord word;
  @override
  Widget build(BuildContext context) {
    final example = word.examples.firstOrNull;
    return InkWell(
      onTap: () => push(context, WordScreen(id: word.id)),
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.circular(AppRadius.card), boxShadow: cardShadow),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Pill('WORD OF THE DAY', background: Colors.white, foreground: AppColors.navy),
            const Spacer(),
            ListenButton(word.word, onIndigo: true, size: 40),
          ]),
          const SizedBox(height: 14),
          Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 8, children: [
            Text(word.word, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Text(word.partOfSpeech, style: const TextStyle(color: AppColors.yellow, fontSize: 14, fontWeight: FontWeight.w600)),
            ),
          ]),
          Text(word.pronunciation, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13)),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('DEFINITION', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
              const SizedBox(height: 4),
              Text(word.meaning, style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4)),
            ]),
          ),
          if (example != null) ...[
            const SizedBox(height: 12),
            Text('EXAMPLE', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
            const SizedBox(height: 4),
            _Highlighted(text: '"$example"', word: word.word),
          ],
        ]),
      ),
    );
  }
}

/// Example sentence with the word on a yellow chip.
class _Highlighted extends StatelessWidget {
  const _Highlighted({required this.text, required this.word});
  final String text, word;
  @override
  Widget build(BuildContext context) {
    final i = text.toLowerCase().indexOf(word.toLowerCase());
    const style = TextStyle(color: Colors.white, fontSize: 14, height: 1.6, fontWeight: FontWeight.w600);
    if (i < 0) return Text(text, style: style);
    return Text.rich(TextSpan(style: style, children: [
      TextSpan(text: text.substring(0, i)),
      WidgetSpan(
        alignment: PlaceholderAlignment.middle,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(color: AppColors.yellow, borderRadius: BorderRadius.circular(4)),
          child: Text(text.substring(i, i + word.length), style: style.copyWith(color: AppColors.navy)),
        ),
      ),
      TextSpan(text: text.substring(i + word.length)),
    ]));
  }
}

class _CtaCard extends StatelessWidget {
  const _CtaCard();
  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<AuthStore>().signedIn;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      child: Column(children: [
        const IconTile(Icons.celebration_outlined, size: 52),
        const SizedBox(height: 14),
        const Text('Ready to improve your English?', textAlign: TextAlign.center, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Join thousands of learners building real confidence every day.',
            textAlign: TextAlign.center, style: TextStyle(color: AppColors.outline, fontSize: 13.5, height: 1.5)),
        const SizedBox(height: 18),
        AppButton(signedIn ? 'Continue Learning' : 'Start Learning Free',
            icon: Icons.rocket_launch_outlined,
            onPressed: () => signedIn ? startLearning(context) : push(context, const AuthScreen(startWithRegister: true))),
        const SizedBox(height: 10),
        const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.verified_outlined, size: 15, color: AppColors.success),
          SizedBox(width: 6),
          Text('100% Free • No credit card required', style: TextStyle(fontSize: 12, color: AppColors.outline)),
        ]),
      ]),
    );
  }
}
