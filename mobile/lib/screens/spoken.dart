import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'ai_tutor.dart';
import 'courses.dart';
import 'home.dart';

class SpokenListScreen extends StatefulWidget {
  const SpokenListScreen({super.key});
  @override
  State<SpokenListScreen> createState() => _SpokenListScreenState();
}

class _SpokenListScreenState extends State<SpokenListScreen> {
  String _level = 'All levels';
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final lessons = data.spokenLessons.where((l) => _level == 'All levels' || l.level == _level).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Spoken English')),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        const IndigoHeader(
          title: 'Spoken English',
          subtitle: 'Real conversations for everyday situations. Listen to each line, learn the useful phrases, then practise out loud.',
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AppCard(
            onTap: () => push(context, const AiTutorScreen()),
            child: const Row(children: [
              IconTile(Icons.record_voice_over_rounded, color: AppColors.navy, background: AppColors.yellow),
              SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Speak with AI', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  Text('Practise talking with Bridget, your AI tutor', style: TextStyle(fontSize: 12.5, color: AppColors.outline)),
                ]),
              ),
              Icon(Icons.arrow_forward_rounded, color: AppColors.indigo),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        LevelFilter(value: _level, onChanged: (v) => setState(() => _level = v)),
        const SizedBox(height: 16),
        for (final l in lessons)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: LessonRow(
              icon: Icons.forum_outlined,
              kind: l.category,
              level: l.level,
              title: l.title,
              minutes: l.minutes,
              done: progress.isComplete('spoken/${l.id}'),
              onTap: () => push(context, SpokenLessonScreen(id: l.id)),
            ),
          ),
      ]),
    );
  }
}

class SpokenLessonScreen extends StatefulWidget {
  const SpokenLessonScreen({super.key, required this.id, this.course, this.lessonIndex});
  final String id;
  final Course? course;
  final int? lessonIndex;
  @override
  State<SpokenLessonScreen> createState() => _SpokenLessonScreenState();
}

class _SpokenLessonScreenState extends State<SpokenLessonScreen> {
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final lesson = data.spoken(widget.id);
    if (lesson == null) {
      return Scaffold(appBar: AppBar(), body: const EmptyState(icon: Icons.search_off_rounded, title: 'Not found', message: 'This lesson is no longer available.'));
    }
    final key = 'spoken/${lesson.id}';
    final done = progress.isComplete(key);
    final whole = lesson.dialogue.map((d) => d.text).join(' ');
    return Scaffold(
      appBar: AppBar(title: Text(lesson.category)),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 120), children: [
        if (widget.course != null) CourseLessonBanner(course: widget.course!, index: widget.lessonIndex ?? 0),
        Row(children: [
          LevelChip(lesson.level),
          const SizedBox(width: 8),
          Pill('${lesson.minutes} min', icon: Icons.schedule_rounded, background: Colors.white, border: AppColors.borderSky),
        ]),
        const SizedBox(height: 12),
        Text(lesson.title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
        const SizedBox(height: 6),
        Text(lesson.situation, style: const TextStyle(color: AppColors.onSurfaceVariant, height: 1.5)),
        const SizedBox(height: 18),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Expanded(child: Text('Conversation', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
              ListenButton(whole),
            ]),
            const SizedBox(height: 12),
            for (final line in lesson.dialogue) _Bubble(line: line),
          ]),
        ),
        const SizedBox(height: 14),
        if (lesson.phrases.isNotEmpty) _PhraseCard(title: 'Useful phrases', items: lesson.phrases, highlight: true),
        if (lesson.vocabulary.isNotEmpty) _PhraseCard(title: 'Vocabulary', items: lesson.vocabulary),
        if (lesson.activity.isNotEmpty)
          AppCard(
            color: AppColors.sky,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [
                Icon(Icons.task_alt_rounded, color: AppColors.indigo),
                SizedBox(width: 8),
                Text('Practise', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ]),
              const SizedBox(height: 10),
              for (final a in lesson.activity)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Padding(padding: EdgeInsets.only(top: 7), child: Icon(Icons.circle, size: 6, color: AppColors.indigo)),
                    const SizedBox(width: 10),
                    Expanded(child: Text(a, style: const TextStyle(height: 1.5))),
                  ]),
                ),
              const SizedBox(height: 6),
              AppButton('Practise with the AI tutor', kind: ButtonKind.indigo, leading: Icons.mic_rounded,
                  onPressed: () => push(context, const AiTutorScreen())),
            ]),
          ),
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
                  onPressed: () => progress.toggleComplete(key)),
            ),
            if (widget.course != null) ...[
              const SizedBox(width: 10),
              Expanded(child: NextCourseLessonButton(course: widget.course!, index: widget.lessonIndex ?? 0, onLeave: () {
                if (!done) progress.toggleComplete(key);
              })),
            ],
          ]),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.line});
  final DialogueLine line;
  @override
  Widget build(BuildContext context) {
    final mine = line.speaker == 'B';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!mine) _Avatar(line.name, AppColors.sky, AppColors.indigo),
          const SizedBox(width: 8),
          Flexible(
            child: Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
                decoration: BoxDecoration(
                  color: mine ? AppColors.indigo : AppColors.canvas,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16),
                    topRight: const Radius.circular(16),
                    bottomLeft: Radius.circular(mine ? 16 : 4),
                    bottomRight: Radius.circular(mine ? 4 : 16),
                  ),
                  border: mine ? null : Border.all(color: AppColors.borderSky.withValues(alpha: 0.6)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Flexible(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(line.name, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: mine ? AppColors.yellow : AppColors.indigo)),
                      const SizedBox(height: 2),
                      Text(line.text, style: TextStyle(color: mine ? Colors.white : AppColors.navy, height: 1.4)),
                    ]),
                  ),
                  const SizedBox(width: 4),
                  ListenButton(line.text, size: 28, onIndigo: mine),
                ]),
              ),
          ),
          const SizedBox(width: 8),
          if (mine) _Avatar(line.name, AppColors.yellow, AppColors.navy),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar(this.name, this.bg, this.fg);
  final String name;
  final Color bg, fg;
  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: 15,
        backgroundColor: bg,
        child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 13)),
      );
}

class _PhraseCard extends StatelessWidget {
  const _PhraseCard({required this.title, required this.items, this.highlight = false});
  final String title;
  final List<Phrase> items;
  final bool highlight;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 10),
            for (final p in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        padding: highlight ? const EdgeInsets.symmetric(horizontal: 6, vertical: 2) : EdgeInsets.zero,
                        decoration: highlight ? BoxDecoration(color: AppColors.yellow, borderRadius: BorderRadius.circular(4)) : null,
                        child: Text(p.phrase, style: const TextStyle(fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(height: 3),
                      Text(p.meaning, style: const TextStyle(fontSize: 13, color: AppColors.outline, height: 1.4)),
                    ]),
                  ),
                  ListenButton(p.phrase, size: 32),
                ]),
              ),
          ]),
        ),
      );
}
