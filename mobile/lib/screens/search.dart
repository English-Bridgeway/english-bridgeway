import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'blog.dart';
import 'courses.dart';
import 'grammar.dart';
import 'spoken.dart';
import 'vocabulary.dart';

/// Searches lessons, words, conversations, courses and articles on the phone.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final d = context.watch<ContentStore>().data;
    final q = _q.toLowerCase().trim();
    bool hit(String s) => s.toLowerCase().contains(q);
    final results = q.length < 2
        ? <(IconData, String, String, String, Widget)>[]
        : [
            for (final l in d.grammarLessons)
              if (hit('${l.title} ${l.description}')) (Icons.spellcheck_rounded, 'Grammar', l.title, l.description, GrammarLessonScreen(topicId: l.topicId, lessonId: l.id)),
            for (final w in d.vocabularyWords)
              if (hit('${w.word} ${w.meaning}')) (Icons.translate_rounded, 'Vocabulary', w.word, w.meaning, WordScreen(id: w.id)),
            for (final s in d.spokenLessons)
              if (hit('${s.title} ${s.situation} ${s.category}')) (Icons.forum_outlined, 'Spoken English', s.title, s.situation, SpokenLessonScreen(id: s.id)),
            for (final c in d.courses)
              if (hit('${c.title} ${c.description}')) (Icons.school_outlined, 'Course', c.title, c.description, CourseScreen(id: c.id)),
            for (final p in d.blogPosts)
              if (hit('${p.title} ${p.excerpt}')) (Icons.article_outlined, 'Blog', p.title, p.excerpt, BlogPostScreen(slug: p.slug)),
          ];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: 16),
          child: TextField(
            autofocus: true,
            onChanged: (v) => setState(() => _q = v),
            decoration: const InputDecoration(
              hintText: 'Search lessons, words, courses…',
              prefixIcon: Icon(Icons.search_rounded, color: AppColors.indigo),
              contentPadding: EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
      ),
      body: q.length < 2
          ? const EmptyState(icon: Icons.search_rounded, title: 'Search English-Bridgeway', message: 'Try "present perfect", "errand" or "interview".')
          : results.isEmpty
              ? EmptyState(icon: Icons.search_off_rounded, title: 'No results', message: 'Nothing matches "$_q". Try a shorter word.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: results.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final (icon, kind, title, desc, screen) = results[i];
                    return AppCard(
                      padding: const EdgeInsets.all(14),
                      onTap: () => push(context, screen),
                      child: Row(children: [
                        IconTile(icon, size: 40),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(kind, style: const TextStyle(fontSize: 11.5, color: AppColors.indigo, fontWeight: FontWeight.w600)),
                            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(desc, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: AppColors.outline)),
                          ]),
                        ),
                      ]),
                    );
                  },
                ),
    );
  }
}
