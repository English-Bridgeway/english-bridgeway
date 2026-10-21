import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class BlogScreen extends StatelessWidget {
  const BlogScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final posts = context.watch<ContentStore>().data.blogPosts;
    return Scaffold(
      appBar: AppBar(title: const Text('Blog')),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        const IndigoHeader(title: 'English tips', subtitle: 'Short articles on common mistakes, idioms, grammar and better study habits.'),
        const SizedBox(height: 16),
        for (final p in posts)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: AppCard(
              onTap: () => push(context, BlogPostScreen(slug: p.slug)),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                IconTile(appIcon(p.icon), size: 52),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(p.category, style: const TextStyle(fontSize: 12, color: AppColors.indigo, fontWeight: FontWeight.w600)),
                    Text(p.title, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, height: 1.3)),
                    const SizedBox(height: 4),
                    Text(p.excerpt, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppColors.onSurfaceVariant, height: 1.4)),
                    const SizedBox(height: 6),
                    Text('${p.readingMinutes} min read · ${p.date}', style: const TextStyle(fontSize: 12, color: AppColors.outline)),
                  ]),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

class BlogPostScreen extends StatelessWidget {
  const BlogPostScreen({super.key, required this.slug});
  final String slug;
  @override
  Widget build(BuildContext context) {
    final post = context.watch<ContentStore>().data.post(slug);
    if (post == null) {
      return Scaffold(appBar: AppBar(), body: const EmptyState(icon: Icons.search_off_rounded, title: 'Not found', message: 'This article is no longer available.'));
    }
    return Scaffold(
      appBar: AppBar(title: Text(post.category)),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 40), children: [
        Text(post.title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, height: 1.2)),
        const SizedBox(height: 8),
        Text('${post.author} · ${post.date} · ${post.readingMinutes} min read', style: const TextStyle(color: AppColors.outline, fontSize: 13)),
        const SizedBox(height: 18),
        for (final b in post.content) _block(b),
      ]),
    );
  }

  Widget _block(BlogBlock b) {
    const body = TextStyle(fontSize: 15.5, height: 1.65);
    switch (b.type) {
      case 'h2':
        return Padding(padding: const EdgeInsets.only(top: 10, bottom: 8), child: Text(b.text, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)));
      case 'list':
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(children: [
            for (final i in b.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(padding: EdgeInsets.only(top: 9), child: Icon(Icons.circle, size: 6, color: AppColors.indigo)),
                  const SizedBox(width: 10),
                  Expanded(child: Text(i, style: body)),
                ]),
              ),
          ]),
        );
      case 'pairs':
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(children: [
            for (final p in b.pairs)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  padding: const EdgeInsets.all(14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(p.key, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.4)),
                    const SizedBox(height: 4),
                    Text(p.value, style: const TextStyle(color: AppColors.onSurfaceVariant, height: 1.5)),
                  ]),
                ),
              ),
          ]),
        );
      case 'tip':
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.yellow)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.lightbulb_outline_rounded, color: AppColors.amberText),
            const SizedBox(width: 10),
            Expanded(child: Text(b.text, style: body)),
          ]),
        );
      default:
        return Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(b.text, style: body));
    }
  }
}
