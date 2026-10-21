import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'ai_tutor.dart';
import 'blog.dart';
import 'grammar.dart';
import 'shell.dart';
import 'spoken.dart';
import 'vocabulary.dart';

class LearnScreen extends StatelessWidget {
  const LearnScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final grammarDone = data.grammarLessons.where((l) => progress.isComplete(l.key)).length;
    final spokenDone = data.spokenLessons.where((l) => progress.isComplete('spoken/${l.id}')).length;
    final total = data.grammarLessons.length + data.spokenLessons.length;
    final done = grammarDone + spokenDone;
    final tip = tipOfTheDay();

    final sections = [
      (Icons.spellcheck_rounded, 'Grammar', '$grammarDone of ${data.grammarLessons.length} lessons done', AppColors.indigo, AppColors.sky,
          () => push(context, const GrammarScreen())),
      (Icons.translate_rounded, 'Vocabulary', '${data.vocabularyWords.length} words · ${progress.favoriteWords.length} saved', AppColors.amberText,
          AppColors.amberSoft, () => push(context, const VocabularyScreen())),
      (Icons.forum_outlined, 'Spoken English', '$spokenDone of ${data.spokenLessons.length} conversations done', AppColors.indigo, AppColors.sky,
          () => push(context, const SpokenListScreen())),
      (Icons.record_voice_over_rounded, 'Speak with AI', 'Talk with Bridget, your AI tutor', AppColors.navy, AppColors.yellow,
          () => push(context, const AiTutorScreen())),
      (Icons.quiz_outlined, 'Quizzes', '${progress.quizScores.length} of ${data.quizzes.length} taken', AppColors.indigo, AppColors.sky,
          () => MainShell.of(context).select(2)),
      (Icons.article_outlined, 'Blog', '${data.blogPosts.length} articles with tips', AppColors.navy, const Color(0xFFE5E7F5),
          () => push(context, const BlogScreen())),
    ];

    return Scaffold(
      appBar: const BrandBar('Learn'),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        IndigoHeader(
          title: 'Your learning path',
          subtitle: 'Pick a skill to practise today. Everything you finish is saved on this phone.',
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withValues(alpha: 0.2))),
            child: Column(children: [
              Row(children: [
                const Icon(Icons.local_fire_department_rounded, color: AppColors.yellow),
                const SizedBox(width: 6),
                Text('${progress.streak}-day streak', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                const Spacer(),
                Text('$done/$total lessons', style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontWeight: FontWeight.w600)),
              ]),
              const SizedBox(height: 10),
              ProgressLine(total == 0 ? 0 : done / total, color: AppColors.yellow, track: Colors.white.withValues(alpha: 0.25)),
            ]),
          ),
        ),
        const SizedBox(height: 20),
        for (final (icon, title, sub, fg, bg, onTap) in sections)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: AppCard(
              onTap: onTap,
              child: Row(children: [
                IconTile(icon, color: fg, background: bg, size: 50),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(sub, style: const TextStyle(fontSize: 12.5, color: AppColors.outline)),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.indigo),
              ]),
            ),
          ),
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: TipCard(title: tip.$1, text: tip.$2)),
      ]),
    );
  }
}
