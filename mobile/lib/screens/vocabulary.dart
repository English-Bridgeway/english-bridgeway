import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class VocabularyScreen extends StatefulWidget {
  const VocabularyScreen({super.key, this.favoritesOnly = false});
  final bool favoritesOnly;
  @override
  State<VocabularyScreen> createState() => _VocabularyScreenState();
}

class _VocabularyScreenState extends State<VocabularyScreen> {
  String _category = 'All';
  String _query = '';
  late bool _favorites = widget.favoritesOnly;

  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final categories = ['All', ...{for (final w in data.vocabularyWords) w.category}];
    final q = _query.toLowerCase().trim();
    final words = data.vocabularyWords.where((w) {
      if (_favorites && !progress.isFavorite(w.id)) return false;
      if (_category != 'All' && w.category != _category) return false;
      return q.isEmpty || '${w.word} ${w.meaning} ${w.synonyms.join(' ')}'.toLowerCase().contains(q);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Vocabulary'), actions: [
        IconButton(
          tooltip: _favorites ? 'Show all words' : 'Show saved words',
          icon: Icon(_favorites ? Icons.bookmark_rounded : Icons.bookmark_border_rounded, color: AppColors.indigo),
          onPressed: () => setState(() => _favorites = !_favorites),
        ),
      ]),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        IndigoHeader(
          title: _favorites ? 'Saved words' : 'Vocabulary',
          subtitle: 'Everyday words with meaning, pronunciation and examples. Tap the speaker to hear each word.',
          child: SearchField(hint: 'Search words or meanings…', onChanged: (v) => setState(() => _query = v)),
        ),
        const SizedBox(height: 16),
        LevelFilter(value: _category, options: categories, onChanged: (v) => setState(() => _category = v)),
        const SizedBox(height: 16),
        if (words.isEmpty)
          EmptyState(
            icon: _favorites ? Icons.bookmark_border_rounded : Icons.manage_search_rounded,
            title: _favorites ? 'No saved words yet' : 'No words found',
            message: _favorites ? 'Tap the bookmark on any word to keep it here for revision.' : 'Try another word or clear the filters.',
          ),
        for (final w in words)
          Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), child: WordCard(word: w)),
      ]),
    );
  }
}

class WordCard extends StatelessWidget {
  const WordCard({super.key, required this.word});
  final VocabularyWord word;
  @override
  Widget build(BuildContext context) {
    final progress = context.watch<ProgressStore>();
    return AppCard(
      onTap: () => push(context, WordScreen(id: word.id)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(word.word, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              Text(word.partOfSpeech, style: const TextStyle(fontSize: 12.5, color: AppColors.indigo, fontWeight: FontWeight.w600)),
            ]),
            Text(word.pronunciation, style: const TextStyle(fontSize: 12.5, color: AppColors.outline)),
            const SizedBox(height: 6),
            Text(word.meaning, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, height: 1.4, color: AppColors.onSurfaceVariant)),
            const SizedBox(height: 8),
            Row(children: [LevelChip(word.level), const SizedBox(width: 6), Pill(word.category, background: Colors.white, border: AppColors.borderSky)]),
          ]),
        ),
        Column(children: [
          ListenButton(word.word),
          IconButton(
            tooltip: 'Save word',
            icon: Icon(progress.isFavorite(word.id) ? Icons.bookmark_rounded : Icons.bookmark_border_rounded, color: AppColors.indigo),
            onPressed: () => progress.toggleFavorite(word.id),
          ),
        ]),
      ]),
    );
  }
}

class WordScreen extends StatelessWidget {
  const WordScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final progress = context.watch<ProgressStore>();
    final word = data.word(id);
    if (word == null) return Scaffold(appBar: AppBar(), body: const EmptyState(icon: Icons.search_off_rounded, title: 'Not found', message: 'This word is no longer available.'));
    final fav = progress.isFavorite(word.id);
    final related = data.vocabularyWords.where((w) => w.id != word.id && w.category == word.category).take(4).toList();
    Widget chips(String title, List<String> items) => items.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [for (final s in items) Pill(s, background: Colors.white, border: AppColors.borderSky)]),
            ]),
          );
    return Scaffold(
      appBar: AppBar(title: const Text('Word'), actions: [
        IconButton(
          tooltip: fav ? 'Remove from saved' : 'Save word',
          icon: Icon(fav ? Icons.bookmark_rounded : Icons.bookmark_border_rounded, color: AppColors.indigo),
          onPressed: () => progress.toggleFavorite(word.id),
        ),
      ]),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.circular(AppRadius.card)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Pill(word.category, background: Colors.white),
              const SizedBox(width: 6),
              Pill(word.level, background: AppColors.yellow),
              const Spacer(),
              ListenButton(word.word, onIndigo: true, size: 44),
            ]),
            const SizedBox(height: 14),
            Text(word.word, style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
            Text('${word.pronunciation}  ·  ${word.partOfSpeech}', style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
            const SizedBox(height: 14),
            Text(word.meaning, style: const TextStyle(color: Colors.white, fontSize: 16, height: 1.5)),
          ]),
        ),
        const SizedBox(height: 16),
        if (word.examples.isNotEmpty)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Examples', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 10),
              for (final e in word.examples)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    Expanded(child: Text(e, style: const TextStyle(height: 1.5))),
                    ListenButton(e, size: 32),
                  ]),
                ),
            ]),
          ),
        const SizedBox(height: 16),
        chips('Synonyms', word.synonyms),
        chips('Antonyms', word.antonyms),
        chips('Related', word.related),
        if (related.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('More ${word.category} words', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 10),
          for (final w in related) Padding(padding: const EdgeInsets.only(bottom: 10), child: WordCard(word: w)),
        ],
      ]),
    );
  }
}
