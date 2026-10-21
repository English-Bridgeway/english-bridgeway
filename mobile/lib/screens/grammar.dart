import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'courses.dart';
import 'home.dart';
import 'quiz.dart';

const _tips = [
  ('Since vs For', 'Use "since" for a specific point in time, and "for" for a duration of time: I have lived here since 2020 / for five years.'),
  ('Myself', 'Don\'t introduce yourself with "Myself Rahul". Say "I\'m Rahul" or "My name is Rahul".'),
  ('Discuss', '"Discuss" already means "talk about", so say "We discussed the plan", not "discussed about".'),
  ('State verbs', 'Verbs like know, have (own), like and want are not used in the continuous: "I know", not "I am knowing".'),
  ('A or an', 'Choose by sound, not spelling: an hour, an MBA, a university, a one-way street.'),
  ('This morning', 'Say "this morning" and "tonight", not "today morning" or "today night".'),
  ('Elder or older', 'Use "elder" only before a noun (my elder sister). Comparing, say "older than".'),
];

(String, String) tipOfTheDay() => _tips[DateTime.now().difference(DateTime(2024)).inDays % _tips.length];

(Color, Color) _levelTile(String level) => switch (level) {
      'Intermediate' => (AppColors.amberText, AppColors.amberSoft),
      'Advanced' => (AppColors.navy, const Color(0xFFE5E7F5)),
      _ => (AppColors.indigo, AppColors.sky),
    };

/// Grammar topics, matching the "Grammar" Stitch screen.
class GrammarScreen extends StatefulWidget {
  const GrammarScreen({super.key});
  @override
  State<GrammarScreen> createState() => _GrammarScreenState();
}

class _GrammarScreenState extends State<GrammarScreen> {
  String _level = 'All levels';
  String _query = '';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final q = _query.toLowerCase().trim();
    final topics = data.grammarTopics.where((t) {
      if (_level != 'All levels' && t.level != _level) return false;
      if (q.isEmpty) return true;
      final lessons = data.lessonsFor(t.id);
      return '${t.title} ${t.summary} ${lessons.map((l) => l.title).join(' ')}'.toLowerCase().contains(q);
    }).toList();
    final total = data.grammarLessons.length;
    final done = data.grammarLessons.where((l) => progress.isComplete(l.key)).length;
    final tip = tipOfTheDay();

    return Scaffold(
      appBar: AppBar(title: const Text('Grammar')),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        IndigoHeader(
          title: 'Grammar',
          subtitle: 'Clear explanations, real examples and the mistakes to avoid. Choose a topic and start with its first lesson.',
          bottomPadding: 52,
          child: SearchField(controller: _search, hint: 'Search topics, e.g. articles…', onChanged: (v) => setState(() => _query = v)),
        ),
        Transform.translate(
          offset: const Offset(0, -30),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: AppCard(
              padding: const EdgeInsets.all(14),
              child: Column(children: [
                Row(children: [
                  const Icon(Icons.verified_outlined, color: AppColors.indigo, size: 22),
                  const SizedBox(width: 10),
                  Expanded(child: Text('$done of $total lessons done', style: const TextStyle(fontWeight: FontWeight.w700))),
                  Text('${total == 0 ? 0 : (done * 100 / total).round()}%',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.indigo)),
                ]),
                const SizedBox(height: 10),
                ProgressLine(total == 0 ? 0 : done / total),
              ]),
            ),
          ),
        ),
        LevelFilter(value: _level, onChanged: (v) => setState(() => _level = v)),
        const SizedBox(height: 16),
        if (topics.isEmpty)
          EmptyState(
            icon: Icons.manage_search_rounded,
            title: 'No grammar topics found',
            message: 'Try searching for keywords like "verbs", "past" or "questions", or clear the filters.',
            action: 'Reset filters',
            onAction: () => setState(() {
              _level = 'All levels';
              _query = '';
              _search.clear();
            }),
          ),
        for (final t in topics)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: _TopicCard(topic: t, lessons: data.lessonsFor(t.id)),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TipCard(title: tip.$1, text: tip.$2),
        ),
      ]),
    );
  }
}

class _TopicCard extends StatelessWidget {
  const _TopicCard({required this.topic, required this.lessons});
  final GrammarTopic topic;
  final List<GrammarLesson> lessons;
  @override
  Widget build(BuildContext context) {
    final (fg, bg) = _levelTile(topic.level);
    final progress = context.watch<ProgressStore>();
    final done = lessons.where((l) => progress.isComplete(l.key)).length;
    final next = lessons.where((l) => !progress.isComplete(l.key)).firstOrNull ?? lessons.firstOrNull;
    return AppCard(
      onTap: () => push(context, GrammarTopicScreen(topicId: topic.id)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IconTile(appIcon(topic.icon), color: fg, background: bg),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(topic.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
              LevelChip(topic.level),
            ]),
            const SizedBox(height: 4),
            Text(topic.summary, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppColors.onSurfaceVariant, height: 1.35)),
            const SizedBox(height: 10),
            Row(children: [
              const Icon(Icons.library_books_outlined, size: 15, color: AppColors.outline),
              const SizedBox(width: 5),
              Text(done > 0 ? '$done/${lessons.length} done' : '${lessons.length} lesson${lessons.length == 1 ? '' : 's'}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.outline)),
              const Spacer(),
              if (next != null)
                InkWell(
                  onTap: () => push(context, GrammarLessonScreen(topicId: topic.id, lessonId: next.id)),
                  child: Row(children: [
                    Text(done == lessons.length && done > 0 ? 'Review' : 'Start lesson',
                        style: const TextStyle(fontSize: 13, color: AppColors.indigo, fontWeight: FontWeight.w600)),
                    const Icon(Icons.arrow_forward_rounded, size: 15, color: AppColors.indigo),
                  ]),
                ),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class TipCard extends StatelessWidget {
  const TipCard({super.key, required this.title, required this.text, this.showQuiz = true});
  final String title, text;
  final bool showQuiz;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.sky.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: AppColors.borderSky),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.lightbulb_outline_rounded, color: AppColors.navy, size: 20),
            SizedBox(width: 8),
            Text('TIP OF THE DAY', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.8, fontSize: 13)),
          ]),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 4),
          Text(text, style: const TextStyle(fontSize: 13.5, height: 1.5, color: AppColors.onSurfaceVariant)),
          if (showQuiz) ...[
            const SizedBox(height: 14),
            AppButton('Practice Quiz', icon: Icons.arrow_forward_rounded, onPressed: () {
              final quizzes = context.read<ContentStore>().data.quizzes;
              final grammar = quizzes.where((q) => q.categoryId == 'grammar').firstOrNull ?? quizzes.firstOrNull;
              if (grammar != null) push(context, QuizRunnerScreen(quiz: grammar));
            }),
          ],
        ]),
      );
}

/// One topic's lessons.
class GrammarTopicScreen extends StatelessWidget {
  const GrammarTopicScreen({super.key, required this.topicId});
  final String topicId;
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final topic = data.topic(topicId);
    if (topic == null) return const _Missing();
    final lessons = data.lessonsFor(topicId);
    return Scaffold(
      appBar: AppBar(title: Text(topic.title)),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        IndigoHeader(title: topic.title, subtitle: topic.summary, child: LevelChip(topic.level)),
        const SizedBox(height: 18),
        SectionHeading('Lessons', subtitle: '${lessons.length} lesson${lessons.length == 1 ? '' : 's'} in this topic'),
        for (final l in lessons)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: LessonRow(
              icon: appIcon(topic.icon),
              kind: 'Grammar',
              level: l.level,
              title: l.title,
              minutes: l.minutes,
              done: progress.isComplete(l.key),
              onTap: () => push(context, GrammarLessonScreen(topicId: topicId, lessonId: l.id)),
            ),
          ),
        if (lessons.isEmpty)
          const EmptyState(icon: Icons.hourglass_empty_rounded, title: 'Lessons coming soon', message: 'New lessons for this topic are on the way.'),
      ]),
    );
  }
}

/// A grammar lesson: definition, rules, sections with examples, common mistakes and practice.
class GrammarLessonScreen extends StatefulWidget {
  const GrammarLessonScreen({super.key, required this.topicId, required this.lessonId, this.course, this.lessonIndex});
  final String topicId, lessonId;
  /// Set when opened from a course curriculum (shows "Lesson n of N" and next lesson).
  final Course? course;
  final int? lessonIndex;
  @override
  State<GrammarLessonScreen> createState() => _GrammarLessonScreenState();
}

class _GrammarLessonScreenState extends State<GrammarLessonScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ProgressStore>().openLesson('${widget.topicId}/${widget.lessonId}');
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final lesson = data.lesson(widget.topicId, widget.lessonId);
    if (lesson == null) return const _Missing();
    final topic = data.topic(widget.topicId);
    final siblings = data.lessonsFor(widget.topicId);
    final i = siblings.indexWhere((l) => l.id == lesson.id);
    final next = i >= 0 && i + 1 < siblings.length ? siblings[i + 1] : null;
    final done = progress.isComplete(lesson.key);

    return Scaffold(
      appBar: AppBar(title: Text(topic?.title ?? 'Lesson')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 120), children: [
        if (widget.course != null) CourseLessonBanner(course: widget.course!, index: widget.lessonIndex ?? 0),
        Row(children: [
          LevelChip(lesson.level),
          const SizedBox(width: 8),
          Pill('${lesson.minutes} min', icon: Icons.schedule_rounded, background: Colors.white, border: AppColors.borderSky),
          if (done) ...[
            const SizedBox(width: 8),
            const Pill('Done', icon: Icons.check_rounded, background: AppColors.successSoft, foreground: AppColors.success),
          ],
        ]),
        const SizedBox(height: 12),
        Text(lesson.title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, height: 1.2)),
        const SizedBox(height: 8),
        Text(lesson.description, style: const TextStyle(color: AppColors.onSurfaceVariant, height: 1.5)),
        const SizedBox(height: 18),
        _Block(
          icon: Icons.lightbulb_outline_rounded,
          title: 'What is it?',
          child: Text(lesson.definition, style: const TextStyle(fontSize: 15, height: 1.6)),
        ),
        if (lesson.rules.isNotEmpty)
          _Block(
            icon: Icons.rule_rounded,
            title: 'Rules to remember',
            child: Column(children: [
              for (var r = 0; r < lesson.rules.length; r++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(color: AppColors.yellow, shape: BoxShape.circle),
                      child: Text('${r + 1}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(lesson.rules[r], style: const TextStyle(height: 1.5))),
                  ]),
                ),
            ]),
          ),
        for (final s in lesson.sections) _SectionCard(section: s),
        if (lesson.mistakes.isNotEmpty)
          _Block(
            icon: Icons.report_gmailerrorred_rounded,
            title: 'Common mistakes',
            child: Column(children: [for (final m in lesson.mistakes) _MistakeRow(m)]),
          ),
        if (lesson.practice.isNotEmpty) ...[
          const SizedBox(height: 4),
          AppCard(
            color: AppColors.indigo,
            child: Row(children: [
              const Icon(Icons.quiz_outlined, color: AppColors.yellow, size: 30),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Practice', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17)),
                  Text('${lesson.practice.length} quick questions', style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
                ]),
              ),
              AppButton('Start', expand: false, small: true, onPressed: () {
                push(context, QuizRunnerScreen(quiz: Quiz('lesson-${lesson.id}', 'grammar', '${lesson.title}: practice', lesson.level, 3, lesson.practice)));
              }),
            ]),
          ),
        ],
      ]),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: const BoxDecoration(color: Colors.white, boxShadow: floatingShadow),
          child: Row(children: [
            Expanded(
              child: AppButton(done ? 'Completed' : 'Mark as done',
                  kind: done ? ButtonKind.ghost : ButtonKind.indigo,
                  leading: done ? Icons.check_circle_rounded : Icons.check_rounded,
                  onPressed: () => progress.toggleComplete(lesson.key)),
            ),
            if (next != null && widget.course == null) ...[
              const SizedBox(width: 10),
              Expanded(
                child: AppButton('Next lesson', icon: Icons.arrow_forward_rounded, onPressed: () {
                  if (!done) progress.toggleComplete(lesson.key);
                  Navigator.of(context).pushReplacement(MaterialPageRoute(
                      builder: (_) => GrammarLessonScreen(topicId: widget.topicId, lessonId: next.id)));
                }),
              ),
            ],
            if (widget.course != null) ...[
              const SizedBox(width: 10),
              Expanded(child: NextCourseLessonButton(course: widget.course!, index: widget.lessonIndex ?? 0, onLeave: () {
                if (!done) progress.toggleComplete(lesson.key);
              })),
            ],
          ]),
        ),
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.icon, required this.title, required this.child});
  final IconData icon;
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(icon, color: AppColors.indigo, size: 20),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            ]),
            const SizedBox(height: 12),
            child,
          ]),
        ),
      );
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.section});
  final LessonSection section;
  @override
  Widget build(BuildContext context) => _Block(
        icon: Icons.segment_rounded,
        title: section.heading,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (section.body != null && section.body!.isNotEmpty)
            Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(section.body!, style: const TextStyle(height: 1.55))),
          if (section.structure != null && section.structure!.isNotEmpty)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: AppColors.yellow, borderRadius: BorderRadius.circular(10)),
              child: Text(section.structure!, style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          for (final e in section.examples)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
              decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.borderSky.withValues(alpha: 0.6))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(e.sentence, style: const TextStyle(fontWeight: FontWeight.w600, height: 1.4)),
                    if (e.note != null && e.note!.isNotEmpty)
                      Text(e.note!, style: const TextStyle(fontSize: 12, color: AppColors.outline, height: 1.4)),
                  ]),
                ),
                ListenButton(e.sentence, size: 32),
              ]),
            ),
        ]),
      );
}

class _MistakeRow extends StatelessWidget {
  const _MistakeRow(this.m);
  final CommonMistake m;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.close_rounded, color: AppColors.error, size: 18),
            const SizedBox(width: 6),
            Expanded(child: Text(m.wrong, style: const TextStyle(color: AppColors.error, decoration: TextDecoration.lineThrough, decorationColor: AppColors.error))),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            const Icon(Icons.check_rounded, color: AppColors.success, size: 18),
            const SizedBox(width: 6),
            Expanded(child: Text(m.right, style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700))),
          ]),
          if (m.why.isNotEmpty)
            Padding(padding: const EdgeInsets.only(left: 24, top: 2), child: Text(m.why, style: const TextStyle(fontSize: 12.5, color: AppColors.outline, height: 1.4))),
        ]),
      );
}

class _Missing extends StatelessWidget {
  const _Missing();
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          icon: Icons.search_off_rounded,
          title: 'Not found',
          message: 'This lesson is no longer available.',
          action: 'Go back',
          onAction: () => Navigator.of(context).pop(),
        ),
      );
}
