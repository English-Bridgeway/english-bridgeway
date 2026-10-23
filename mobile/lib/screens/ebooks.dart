import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pdfrx/pdfrx.dart';

import '../models.dart';
import '../nav.dart';
import '../services/api.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'auth.dart';

/// E-books: PDFs for learners with a paid course (bought on the website or in the app).
/// The server decides who can open each one; locked e-books show why.
class EbooksScreen extends StatefulWidget {
  const EbooksScreen({super.key});
  @override
  State<EbooksScreen> createState() => _EbooksScreenState();
}

class _EbooksScreenState extends State<EbooksScreen> {
  List<Ebook>? _books;
  String? _error;
  String? _opening;
  String? _lastToken;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reload after logging in or out, since that changes which e-books are open.
    final token = context.watch<AuthStore>().api.token;
    if (_books == null || token != _lastToken) {
      _lastToken = token;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final books = await context.read<Api>().ebooks();
      if (mounted) {
        setState(() {
          _books = books;
          _error = null;
        });
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _open(Ebook book, {required bool download}) async {
    setState(() => _opening = '${book.id}$download');
    try {
      final url = await context.read<Api>().ebookLink(book.id, download: download);
      if (!mounted) return;
      if (download) {
        // The phone's browser saves the PDF to Downloads.
        await openExternal(url);
      } else {
        await push(context, EbookReaderScreen(book: book, url: url));
      }
    } on ApiError catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      if (e.status == 403) _load();
    } finally {
      if (mounted) setState(() => _opening = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<AuthStore>().signedIn;
    final books = _books;
    final anyLocked = books?.any((b) => !b.unlocked) ?? false;
    return Scaffold(
      appBar: AppBar(title: const Text('E-books')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
          const IndigoHeader(title: 'E-book library', subtitle: 'Read our English e-books in the app or download the PDF. They come with every paid course and plan.'),
          const SizedBox(height: 16),
          if (!signedIn && anyLocked)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Log in to read', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text('E-books open for learners with a paid course. Courses bought on the website count too.',
                      style: TextStyle(color: AppColors.onSurfaceVariant, height: 1.4)),
                  const SizedBox(height: 12),
                  AppButton('Log in', kind: ButtonKind.indigo, small: true, expand: false, onPressed: () => push(context, const AuthScreen())),
                ]),
              ),
            ),
          if (_error != null && books == null)
            EmptyState(icon: Icons.wifi_off_rounded, title: 'Could not load e-books', message: _error!, action: 'Try again', onAction: _load)
          else if (books == null)
            const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))
          else if (books.isEmpty)
            const EmptyState(icon: Icons.local_library_outlined, title: 'No e-books yet', message: 'New e-books will show here.')
          else
            for (final b in books)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: _EbookCard(
                  book: b,
                  opening: _opening,
                  onRead: () => _open(b, download: false),
                  onDownload: () => _open(b, download: true),
                ),
              ),
        ]),
      ),
    );
  }
}

class _EbookCard extends StatelessWidget {
  const _EbookCard({required this.book, required this.opening, required this.onRead, required this.onDownload});
  final Ebook book;
  final String? opening;
  final VoidCallback onRead, onDownload;

  @override
  Widget build(BuildContext context) {
    final cover = book.coverUrl == null
        ? const _CoverPlaceholder()
        : ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(Api.absolute(book.coverUrl!), width: 76, height: 108, fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const _CoverPlaceholder()),
          );
    return AppCard(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        cover,
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(book.title, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, height: 1.3)),
            if (book.author.isNotEmpty) Text('by ${book.author}', style: const TextStyle(fontSize: 12.5, color: AppColors.outline)),
            if (book.description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(book.description, maxLines: 3, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.onSurfaceVariant, height: 1.4)),
            ],
            const SizedBox(height: 4),
            Text('${book.sizeLabel}${book.courseTitle != null ? ' · with ${book.courseTitle}' : ''}',
                style: const TextStyle(fontSize: 12, color: AppColors.outline)),
            const SizedBox(height: 10),
            if (book.unlocked)
              Wrap(spacing: 8, runSpacing: 8, children: [
                AppButton('Read', kind: ButtonKind.indigo, small: true, expand: false, leading: Icons.menu_book_rounded,
                    busy: opening == '${book.id}false', onPressed: opening == null ? onRead : null),
                AppButton('Download', kind: ButtonKind.ghost, small: true, expand: false, leading: Icons.download_rounded,
                    busy: opening == '${book.id}true', onPressed: opening == null ? onDownload : null),
              ])
            else
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.lock_outline_rounded, size: 16, color: AppColors.outline),
                const SizedBox(width: 6),
                Expanded(child: Text(book.lockedReason ?? 'Locked', style: const TextStyle(fontSize: 12.5, color: AppColors.onSurfaceVariant, height: 1.4))),
              ]),
          ]),
        ),
      ]),
    );
  }
}

class _CoverPlaceholder extends StatelessWidget {
  const _CoverPlaceholder();
  @override
  Widget build(BuildContext context) => Container(
        width: 76,
        height: 108,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          gradient: const LinearGradient(colors: [AppColors.indigo, AppColors.navy], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        child: const Icon(Icons.auto_stories_rounded, color: Colors.white, size: 32),
      );
}

/// Reads a PDF inside the app from its signed link.
class EbookReaderScreen extends StatelessWidget {
  const EbookReaderScreen({super.key, required this.book, required this.url});
  final Ebook book;
  final String url;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(book.title, overflow: TextOverflow.ellipsis)),
        body: PdfViewer.uri(
          Uri.parse(url),
          params: PdfViewerParams(
            backgroundColor: const Color(0xFFE5E7F5),
            loadingBannerBuilder: (context, received, total) => Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                CircularProgressIndicator(value: total != null && total > 0 ? received / total : null),
                const SizedBox(height: 12),
                const Text('Opening the e-book…'),
              ]),
            ),
            errorBannerBuilder: (context, error, stackTrace, documentRef) => const EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Could not open this e-book',
              message: 'Check your internet connection, then go back and tap Read again.',
            ),
          ),
        ),
      );
}
