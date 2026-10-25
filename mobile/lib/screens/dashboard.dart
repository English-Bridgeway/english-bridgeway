import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'ai_tutor.dart';
import 'courses.dart';
import 'ebooks.dart';
import 'grammar.dart';
import 'home.dart';
import 'quiz.dart';
import 'shell.dart';
import 'spoken.dart';
import 'vocabulary.dart';

/// The course the learner is working on: the one opened last that isn't finished, else a course
/// they bought but haven't started.
Course? courseInProgress(ContentBundle data, ProgressStore progress, AuthStore auth) {
  bool unfinished(Course c) {
    final p = courseProgress(c, progress);
    return p.total == 0 || p.done < p.total;
  }

  for (final id in progress.startedCourses.reversed) {
    final c = data.course(id);
    if (c != null && unfinished(c)) return c;
  }
  for (final id in auth.account?.purchasedCourseIds ?? const <String>[]) {
    final c = data.course(id);
    if (c != null && unfinished(c)) return c;
  }
  return null;
}

/// Home after login: greeting and streak, the course to resume, shortcuts and what to do next.
class DashboardView extends StatelessWidget {
  const DashboardView({super.key});

  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final auth = context.watch<AuthStore>();
    final course = courseInProgress(data, progress, auth);
    final others = [
      for (final id in progress.startedCourses.reversed)
        if (id != course?.id) data.course(id),
    ].whereType<Course>().take(3).toList();

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        const _Greeting(),
        Transform.translate(
          offset: const Offset(0, -30),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: course != null ? _ResumeCourse(course: course) : const _PickCourse(),
          ),
        ),
        const _AccountNote(),
        const SectionHeading('Shortcuts', subtitle: 'Jump straight in'),
        const _Shortcuts(),
        const SizedBox(height: 26),
        const SectionHeading('Up next', subtitle: 'Picked from where you are'),
        const _UpNext(),
        if (others.isNotEmpty) ...[
          const SizedBox(height: 14),
          SectionHeading('My courses', action: 'All courses', onAction: () => MainShell.of(context).select(3)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(children: [
              for (final c in others) Padding(padding: const EdgeInsets.only(bottom: 12), child: _CourseRow(course: c)),
            ]),
          ),
        ],
        const SizedBox(height: 14),
        if (data.vocabularyWords.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: WordOfTheDay(word: data.vocabularyWords[DateTime.now().difference(DateTime(2024)).inDays % data.vocabularyWords.length]),
          ),
      ],
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting();

  static String _hello(DateTime now) => now.hour < 12 ? 'Good morning' : (now.hour < 17 ? 'Good afternoon' : 'Good evening');

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthStore>().user;
    final progress = context.watch<ProgressStore>();
    final first = (user?.name ?? '').trim().split(RegExp(r'\s+')).first;
    final streak = progress.streak;
    final today = DateTime.now();
    final active = progress.activeDays.toSet();
    final todayDone = active.contains(today.toIso8601String().substring(0, 10));
    final scores = progress.quizScores.values.where((s) => s.total > 0).toList();
    final avg = scores.isEmpty ? null : (scores.map((s) => s.score / s.total).reduce((a, b) => a + b) / scores.length * 100).round();
    final lessonsDone = progress.completedLessons.length;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 50),
      decoration: const BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.vertical(bottom: Radius.circular(28))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${_hello(today)},', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 14, fontWeight: FontWeight.w600)),
        Text(first.isEmpty ? 'Welcome back' : first,
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
        const SizedBox(height: 4),
        Text(
          todayDone
              ? 'Great work today. Keep the streak alive tomorrow!'
              : streak > 0
                  ? 'Practise today to make it ${streak + 1} days in a row.'
                  : 'A few minutes a day builds real fluency.',
          style: const TextStyle(color: AppColors.sky, fontSize: 13.5, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 16),
        Row(children: [
          _Stat(icon: Icons.local_fire_department_rounded, value: '$streak', label: 'day streak'),
          const SizedBox(width: 10),
          _Stat(icon: Icons.task_alt_rounded, value: '$lessonsDone', label: lessonsDone == 1 ? 'lesson done' : 'lessons done'),
          const SizedBox(width: 10),
          _Stat(icon: Icons.emoji_events_outlined, value: avg == null ? '–' : '$avg%', label: avg == null ? 'no quiz yet' : 'quiz average'),
        ]),
        const SizedBox(height: 14),
        // This week: one dot per day, filled when the learner practised.
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          for (var i = 6; i >= 0; i--)
            Builder(builder: (_) {
              final d = today.subtract(Duration(days: i));
              final on = active.contains(d.toIso8601String().substring(0, 10));
              return Column(children: [
                Text(const ['M', 'T', 'W', 'T', 'F', 'S', 'S'][d.weekday - 1],
                    style: TextStyle(color: Colors.white.withValues(alpha: i == 0 ? 1 : 0.7), fontSize: 11, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: on ? AppColors.yellow : Colors.white.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                    border: i == 0 ? Border.all(color: Colors.white, width: 1.5) : null,
                  ),
                  child: on ? const Icon(Icons.check_rounded, size: 16, color: AppColors.navy) : null,
                ),
              ]);
            }),
        ]),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value, label;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(icon, color: AppColors.yellow, size: 18),
              const SizedBox(width: 4),
              Flexible(child: Text(value, maxLines: 1, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800))),
            ]),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11.5, fontWeight: FontWeight.w600)),
          ]),
        ),
      );
}

BoxDecoration get _floatingCard => BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadius.card),
      border: Border.all(color: const Color(0xFFF1F5F9)),
      boxShadow: const [BoxShadow(color: Color(0x141A2B7B), blurRadius: 24, offset: Offset(0, 8))],
    );

/// The course in progress, its progress and the next lesson, with Resume.
class _ResumeCourse extends StatelessWidget {
  const _ResumeCourse({required this.course});
  final Course course;
  @override
  Widget build(BuildContext context) {
    final progress = context.watch<ProgressStore>();
    final p = courseProgress(course, progress);
    final next = nextCourseLesson(course, progress);
    final lessons = course.allLessons;
    final pct = p.total == 0 ? 0.0 : p.done / p.total;
    final nextLesson = next >= 0 ? lessons[next] : null;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _floatingCard,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconTile(appIcon(course.icon), size: 46),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.done == 0 ? 'START YOUR COURSE' : 'CONTINUE YOUR COURSE',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.outline, letterSpacing: 0.8)),
              const SizedBox(height: 2),
              Text(course.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, height: 1.25)),
            ]),
          ),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Text('${(pct * 100).round()}%', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.indigo)),
          const SizedBox(width: 10),
          Expanded(child: ProgressLine(pct == 0 ? 0.03 : pct, height: 10)),
          const SizedBox(width: 10),
          Text('${p.done}/${p.total}', style: const TextStyle(fontSize: 12, color: AppColors.outline, fontWeight: FontWeight.w600)),
        ]),
        if (nextLesson != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderSky.withValues(alpha: 0.4)),
            ),
            child: Row(children: [
              const Icon(Icons.play_lesson_outlined, size: 20, color: AppColors.indigo),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Lesson ${next + 1} of ${lessons.length}${nextLesson.minutes > 0 ? ' · ${nextLesson.minutes} min' : ''}',
                      style: const TextStyle(fontSize: 11.5, color: AppColors.outline, fontWeight: FontWeight.w600)),
                  Text(nextLesson.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                ]),
              ),
            ]),
          ),
        ],
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: AppButton(p.done == 0 ? 'Start' : 'Resume', kind: ButtonKind.indigo, leading: Icons.play_arrow_rounded,
                onPressed: next < 0 ? null : () => openCourseLesson(context, course, next)),
          ),
          const SizedBox(width: 10),
          AppButton('Details', kind: ButtonKind.ghost, expand: false, onPressed: () => push(context, CourseScreen(id: course.id))),
        ]),
      ]),
    );
  }
}

/// No course yet: suggests one to start.
class _PickCourse extends StatelessWidget {
  const _PickCourse();
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final auth = context.watch<AuthStore>();
    final suggestion = data.courses.where((c) => auth.canOpenCourse(c)).firstOrNull ?? data.courses.firstOrNull;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _floatingCard,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Row(children: [
          IconTile(Icons.rocket_launch_outlined, size: 46, color: AppColors.navy, background: AppColors.yellow),
          SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Start your first course', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              SizedBox(height: 2),
              Text('Follow a guided path and your progress shows here.', style: TextStyle(fontSize: 12.5, color: AppColors.outline, height: 1.4)),
            ]),
          ),
        ]),
        if (suggestion != null) ...[
          const SizedBox(height: 12),
          _CourseRow(course: suggestion, flat: true),
        ],
        const SizedBox(height: 12),
        AppButton('Browse courses', kind: ButtonKind.indigo, icon: Icons.arrow_forward_rounded, onPressed: () => MainShell.of(context).select(3)),
      ]),
    );
  }
}

class _CourseRow extends StatelessWidget {
  const _CourseRow({required this.course, this.flat = false});
  final Course course;
  final bool flat;
  @override
  Widget build(BuildContext context) {
    final p = courseProgress(course, context.watch<ProgressStore>());
    final pct = p.total == 0 ? 0.0 : p.done / p.total;
    final row = Row(children: [
      IconTile(appIcon(course.icon), size: 40),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(course.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(child: ProgressLine(pct == 0 ? 0.03 : pct, height: 6)),
            const SizedBox(width: 8),
            Text(p.done == 0 ? '${p.total} lessons' : '${(pct * 100).round()}%',
                style: const TextStyle(fontSize: 11.5, color: AppColors.outline, fontWeight: FontWeight.w600)),
          ]),
        ]),
      ),
      const SizedBox(width: 6),
      const Icon(Icons.chevron_right_rounded, color: AppColors.outline),
    ]);
    void open() => push(context, CourseScreen(id: course.id));
    if (flat) {
      return InkWell(
        onTap: open,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.borderSky.withValues(alpha: 0.4))),
          child: row,
        ),
      );
    }
    return AppCard(onTap: open, padding: const EdgeInsets.all(14), child: row);
  }
}

/// Trial or expired plan: one line on what the learner has, with a way to see plans.
class _AccountNote extends StatelessWidget {
  const _AccountNote();
  @override
  Widget build(BuildContext context) {
    final a = context.watch<AuthStore>().account;
    if (a == null || a.full || a.purchasedCourseIds.isNotEmpty) return const SizedBox(height: 0);
    final String text;
    if (a.status == 'expired') {
      text = 'Your plan has ended. Renew to keep every course open.';
    } else if (a.status == 'trial') {
      final left = a.freeLessons;
      text = left == null ? 'You are on the free trial.' : 'Free trial: the first $left lessons of each course are open.';
    } else {
      return const SizedBox(height: 0);
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          const Icon(Icons.workspace_premium_outlined, color: AppColors.amberText, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: AppColors.amberText, fontWeight: FontWeight.w600, height: 1.35))),
          TextButton(
            onPressed: () => MainShell.of(context).select(3),
            child: const Text('See courses', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.navy)),
          ),
        ]),
      ),
    );
  }
}

class _Shortcuts extends StatelessWidget {
  const _Shortcuts();
  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String, Color, Color, VoidCallback)>[
      (Icons.call_rounded, 'Call Bridget', AppColors.navy, AppColors.yellow, () => push(context, const AiTutorScreen())),
      (Icons.spellcheck_rounded, 'Grammar', AppColors.indigo, AppColors.sky, () => push(context, const GrammarScreen())),
      (Icons.translate_rounded, 'Vocabulary', AppColors.amberText, AppColors.amberSoft, () => push(context, const VocabularyScreen())),
      (Icons.forum_outlined, 'Speaking', AppColors.indigo, AppColors.sky, () => push(context, const SpokenListScreen())),
      (Icons.quiz_outlined, 'Quizzes', AppColors.indigo, AppColors.sky, () => MainShell.of(context).select(2)),
      (Icons.local_library_outlined, 'E-books', AppColors.amberText, AppColors.amberSoft, () => push(context, const EbooksScreen())),
      (Icons.bookmark_outline_rounded, 'Saved words', AppColors.indigo, AppColors.sky, () => push(context, const VocabularyScreen(favoritesOnly: true))),
      (Icons.menu_book_outlined, 'Courses', AppColors.navy, const Color(0xFFE5E7F5), () => MainShell.of(context).select(3)),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: AppCard(
        padding: const EdgeInsets.fromLTRB(6, 14, 6, 6),
        child: GridView.count(
          crossAxisCount: 4,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 0.92,
          children: [
            for (final (icon, label, fg, bg, onTap) in items)
              InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(14),
                child: Column(mainAxisAlignment: MainAxisAlignment.start, children: [
                  IconTile(icon, size: 48, color: fg, background: bg),
                  const SizedBox(height: 6),
                  Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}

/// The next grammar lesson, a conversation and a quiz not taken yet.
class _UpNext extends StatelessWidget {
  const _UpNext();
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final lesson = currentLesson(data, progress);
    final spoken = data.spokenLessons.where((s) => !progress.isComplete('spoken/${s.id}')).firstOrNull;
    final quiz = data.quizzes.where((q) => !progress.quizScores.containsKey(q.id)).firstOrNull;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(children: [
        if (lesson != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: LessonRow(
                icon: Icons.menu_book_outlined, kind: 'Grammar', level: lesson.level, title: lesson.title, minutes: lesson.minutes,
                done: progress.isComplete(lesson.key),
                onTap: () => push(context, GrammarLessonScreen(topicId: lesson.topicId, lessonId: lesson.id))),
          ),
        if (spoken != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: LessonRow(
                icon: Icons.record_voice_over_outlined, kind: 'Speaking', level: spoken.level, title: spoken.title, minutes: spoken.minutes,
                onTap: () => push(context, SpokenLessonScreen(id: spoken.id))),
          ),
        if (quiz != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: LessonRow(
                icon: Icons.quiz_outlined, kind: 'Quiz', level: quiz.level, title: quiz.title, minutes: quiz.minutes,
                onTap: () => push(context, QuizRunnerScreen(quiz: quiz))),
          ),
      ]),
    );
  }
}
