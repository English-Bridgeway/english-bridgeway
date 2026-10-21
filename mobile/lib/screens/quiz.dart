import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'shell.dart';

/// Quiz categories and quizzes. Used as the Quiz tab and as a pushed screen.
class QuizHomeScreen extends StatefulWidget {
  const QuizHomeScreen({super.key, this.standalone = false});
  final bool standalone;
  @override
  State<QuizHomeScreen> createState() => _QuizHomeScreenState();
}

class _QuizHomeScreenState extends State<QuizHomeScreen> {
  String _category = 'all';

  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final quizzes = data.quizzes.where((q) => _category == 'all' || q.categoryId == _category).toList();
    final taken = data.quizzes.where((q) => progress.quizScores.containsKey(q.id)).length;
    final scores = progress.quizScores.values.where((s) => s.total > 0).toList();
    final avg = scores.isEmpty ? 0 : (scores.map((s) => s.score / s.total).reduce((a, b) => a + b) * 100 / scores.length).round();
    final labels = {'all': 'All', for (final c in data.quizCategories) c.id: c.title};

    return Scaffold(
      appBar: widget.standalone ? AppBar(title: const Text('Quizzes')) : const BrandBar('Quiz'),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        IndigoHeader(
          title: 'Test your English',
          subtitle: 'Short quizzes with instant feedback and an explanation for every answer.',
          child: Row(children: [
            _HeaderStat(value: '$taken/${data.quizzes.length}', label: 'Quizzes taken'),
            const SizedBox(width: 10),
            _HeaderStat(value: '$avg%', label: 'Average score'),
          ]),
        ),
        const SizedBox(height: 16),
        LevelFilter(
          value: labels[_category] ?? 'All',
          options: labels.values.toList(),
          onChanged: (v) => setState(() => _category = labels.entries.firstWhere((e) => e.value == v).key),
        ),
        const SizedBox(height: 16),
        if (quizzes.isEmpty) const EmptyState(icon: Icons.quiz_outlined, title: 'No quizzes yet', message: 'New quizzes for this category are coming soon.'),
        for (final q in quizzes)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: _QuizCard(quiz: q, category: data.quizCategories.where((c) => c.id == q.categoryId).firstOrNull),
          ),
      ]),
    );
  }
}

class _HeaderStat extends StatelessWidget {
  const _HeaderStat({required this.value, required this.label});
  final String value, label;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.2))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: const TextStyle(color: AppColors.yellow, fontSize: 22, fontWeight: FontWeight.w800)),
            Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12)),
          ]),
        ),
      );
}

class _QuizCard extends StatelessWidget {
  const _QuizCard({required this.quiz, this.category});
  final Quiz quiz;
  final QuizCategory? category;
  @override
  Widget build(BuildContext context) {
    final best = context.watch<ProgressStore>().quizScores[quiz.id];
    return AppCard(
      onTap: () => push(context, QuizRunnerScreen(quiz: quiz)),
      child: Row(children: [
        IconTile(appIcon(category?.icon ?? 'ListChecks')),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(category?.title ?? 'Quiz', style: const TextStyle(fontSize: 12, color: AppColors.indigo, fontWeight: FontWeight.w600)),
            Text(quiz.title, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Row(children: [
              LevelChip(quiz.level),
              const SizedBox(width: 8),
              Text('${quiz.questions.length} questions · ${quiz.minutes} min', style: const TextStyle(fontSize: 12, color: AppColors.outline)),
            ]),
          ]),
        ),
        const SizedBox(width: 8),
        if (best != null)
          Column(children: [
            Text('${best.score}/${best.total}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.success)),
            const Text('best', style: TextStyle(fontSize: 11, color: AppColors.outline)),
          ])
        else
          const Icon(Icons.play_circle_fill_rounded, color: AppColors.indigo, size: 34),
      ]),
    );
  }
}

/// Runs a quiz one question at a time with instant feedback, like QuizRunner on the website.
class QuizRunnerScreen extends StatefulWidget {
  const QuizRunnerScreen({super.key, required this.quiz});
  final Quiz quiz;
  @override
  State<QuizRunnerScreen> createState() => _QuizRunnerScreenState();
}

class _QuizRunnerScreenState extends State<QuizRunnerScreen> {
  int _index = 0;
  String? _selected;
  bool _checked = false;
  final _answers = <String>[];
  final _fill = TextEditingController();

  QuizQuestion get _q => widget.quiz.questions[_index];
  bool get _finished => _index >= widget.quiz.questions.length;
  int get _score => [for (var i = 0; i < _answers.length; i++) widget.quiz.questions[i].isCorrect(_answers[i])].where((c) => c).length;

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

  void _check() {
    final answer = _q.isMcq ? _selected : _fill.text;
    if (answer == null || answer.trim().isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _checked = true;
      _answers.add(answer);
    });
  }

  void _next() {
    setState(() {
      _index++;
      _selected = null;
      _checked = false;
      _fill.clear();
    });
    if (_finished && !widget.quiz.id.startsWith('lesson-')) {
      context.read<ProgressStore>().saveQuizScore(widget.quiz.id, _score, widget.quiz.questions.length);
    }
  }

  void _restart() => setState(() {
        _index = 0;
        _selected = null;
        _checked = false;
        _answers.clear();
        _fill.clear();
      });

  @override
  Widget build(BuildContext context) {
    final total = widget.quiz.questions.length;
    if (total == 0) {
      return Scaffold(appBar: AppBar(), body: const EmptyState(icon: Icons.quiz_outlined, title: 'No questions', message: 'This quiz has no questions yet.'));
    }
    return Scaffold(
      appBar: AppBar(title: Text(widget.quiz.title, overflow: TextOverflow.ellipsis)),
      body: _finished ? _result(total) : _question(total),
    );
  }

  Widget _question(int total) {
    final q = _q;
    final correct = _checked && q.isCorrect(_answers.last);
    return Column(children: [
      Expanded(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Row(children: [
            Text('Question ${_index + 1} of $total', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.indigo)),
            const Spacer(),
            Text('Score $_score', style: const TextStyle(color: AppColors.outline, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 10),
          ProgressLine((_index + (_checked ? 1 : 0)) / total),
          const SizedBox(height: 20),
          AppCard(
            padding: const EdgeInsets.all(20),
            child: Text(q.prompt, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, height: 1.4)),
          ),
          const SizedBox(height: 16),
          if (q.isMcq)
            for (final o in q.options) _option(q, o)
          else
            TextField(
              controller: _fill,
              enabled: !_checked,
              autofocus: true,
              textCapitalization: TextCapitalization.none,
              autocorrect: false,
              onSubmitted: (_) => _check(),
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(hintText: 'Type your answer'),
            ),
          if (_checked) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: correct ? AppColors.successSoft : AppColors.errorSoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(correct ? Icons.check_circle_rounded : Icons.cancel_rounded, color: correct ? AppColors.success : AppColors.error),
                  const SizedBox(width: 8),
                  Text(correct ? 'Correct!' : 'Not quite', style: TextStyle(fontWeight: FontWeight.w800, color: correct ? AppColors.success : AppColors.error)),
                ]),
                if (!correct) ...[
                  const SizedBox(height: 6),
                  Text('Answer: ${q.answers.join(' / ')}', style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
                if (q.explanation.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(q.explanation, style: const TextStyle(height: 1.45)),
                ],
              ]),
            ),
          ],
        ]),
      ),
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: _checked
              ? AppButton(_index + 1 == total ? 'See my score' : 'Next question', icon: Icons.arrow_forward_rounded, onPressed: _next)
              : AppButton('Check answer', kind: ButtonKind.indigo,
                  onPressed: (q.isMcq ? _selected != null : _fill.text.trim().isNotEmpty) ? _check : null),
        ),
      ),
    ]);
  }

  Widget _option(QuizQuestion q, String o) {
    final chosen = _selected == o;
    final isAnswer = q.isCorrect(o);
    Color border = chosen ? AppColors.indigo : AppColors.borderSky;
    Color bg = Colors.white;
    if (_checked && isAnswer) {
      border = AppColors.success;
      bg = AppColors.successSoft;
    } else if (_checked && chosen) {
      border = AppColors.error;
      bg = AppColors.errorSoft;
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: border, width: chosen || (_checked && isAnswer) ? 2 : 1.5)),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: _checked ? null : () => setState(() => _selected = o),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Icon(chosen ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, color: chosen ? AppColors.indigo : AppColors.borderSky),
              const SizedBox(width: 12),
              Expanded(child: Text(o, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600))),
              if (_checked && isAnswer) const Icon(Icons.check_rounded, color: AppColors.success),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _result(int total) {
    final pct = (_score * 100 / total).round();
    final message = pct >= 80 ? 'Excellent work!' : pct >= 50 ? 'Good effort!' : 'Keep practising!';
    return ListView(padding: const EdgeInsets.all(16), children: [
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.circular(AppRadius.card)),
        child: Column(children: [
          Icon(pct >= 50 ? Icons.emoji_events_rounded : Icons.auto_awesome_rounded, color: AppColors.yellow, size: 56),
          const SizedBox(height: 10),
          Text(message, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('You scored $_score out of $total ($pct%)', style: TextStyle(color: Colors.white.withValues(alpha: 0.9))),
        ]),
      ),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: AppButton('Try again', kind: ButtonKind.ghost, leading: Icons.refresh_rounded, onPressed: _restart)),
        const SizedBox(width: 10),
        Expanded(child: AppButton('Done', onPressed: () => Navigator.of(context).pop())),
      ]),
      const SizedBox(height: 20),
      const Text('Review', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
      const SizedBox(height: 10),
      for (var i = 0; i < _answers.length; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            padding: const EdgeInsets.all(14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(widget.quiz.questions[i].isCorrect(_answers[i]) ? Icons.check_circle_rounded : Icons.cancel_rounded,
                  color: widget.quiz.questions[i].isCorrect(_answers[i]) ? AppColors.success : AppColors.error, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.quiz.questions[i].prompt, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text('Your answer: ${_answers[i]}', style: const TextStyle(fontSize: 13, color: AppColors.outline)),
                  if (!widget.quiz.questions[i].isCorrect(_answers[i]))
                    Text('Correct: ${widget.quiz.questions[i].answers.join(' / ')}', style: const TextStyle(fontSize: 13, color: AppColors.success, fontWeight: FontWeight.w600)),
                ]),
              ),
            ]),
          ),
        ),
    ]);
  }
}
