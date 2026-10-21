import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../nav.dart';
import '../services/api.dart';
import '../state.dart';
import '../theme.dart';
import 'courses.dart';
import 'home.dart';
import 'learn.dart';
import 'profile.dart';
import 'quiz.dart';
import 'search.dart';

/// Bottom navigation: Home, Learn, Quiz, Courses, Profile (as in the Stitch designs).
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  static MainShellState of(BuildContext context) => context.findAncestorStateOfType<MainShellState>()!;

  @override
  State<MainShell> createState() => MainShellState();
}

class MainShellState extends State<MainShell> {
  int index = 0;

  // Each tab keeps its own stack, so the bottom bar stays visible while browsing (as in the designs).
  final _navigators = List.generate(5, (_) => GlobalKey<NavigatorState>());
  static const _tabs = [HomeScreen(), LearnScreen(), QuizHomeScreen(), CoursesScreen(), ProfileScreen()];

  void select(int i) {
    if (i == index) {
      _navigators[i].currentState?.popUntil((r) => r.isFirst);
    }
    setState(() => index = i);
  }

  static const _items = [
    (Icons.home_rounded, Icons.home_outlined, 'Home'),
    (Icons.school_rounded, Icons.school_outlined, 'Learn'),
    (Icons.quiz_rounded, Icons.quiz_outlined, 'Quiz'),
    (Icons.menu_book_rounded, Icons.menu_book_outlined, 'Courses'),
    (Icons.account_circle_rounded, Icons.account_circle_outlined, 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final tab = _navigators[index].currentState;
        if (tab != null && await tab.maybePop()) return;
        if (index != 0) {
          setState(() => index = 0);
        } else {
          await SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: IndexedStack(index: index, children: [
          for (var i = 0; i < _tabs.length; i++)
            Navigator(
              key: _navigators[i],
              onGenerateRoute: (settings) => MaterialPageRoute(settings: settings, builder: (_) => _tabs[i]),
            ),
        ]),
        bottomNavigationBar: Container(
          decoration: const BoxDecoration(color: Colors.white, boxShadow: floatingShadow),
          child: SafeArea(
            top: false,
            child: SizedBox(
              height: 64,
              child: Row(children: [
                for (var i = 0; i < _items.length; i++)
                  Expanded(
                    child: InkWell(
                      onTap: () => select(i),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(i == index ? _items[i].$1 : _items[i].$2,
                            color: i == index ? AppColors.indigo : AppColors.outline, size: 24),
                        const SizedBox(height: 2),
                        Text(_items[i].$3,
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: i == index ? FontWeight.w700 : FontWeight.w500,
                                color: i == index ? AppColors.indigo : AppColors.outline)),
                        const SizedBox(height: 3),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 5,
                          height: 5,
                          decoration: BoxDecoration(
                              color: i == index ? AppColors.yellow : Colors.transparent, shape: BoxShape.circle),
                        ),
                      ]),
                    ),
                  ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Top bar of each tab: logo, "ENGLISH-BRIDGEWAY" over the page name, search and profile.
class BrandBar extends StatelessWidget implements PreferredSizeWidget {
  const BrandBar(this.title, {super.key});
  final String title;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthStore>().user;
    return AppBar(
      toolbarHeight: 64,
      centerTitle: false,
      titleSpacing: 16,
      shape: Border(bottom: BorderSide(color: AppColors.outlineVariant.withValues(alpha: 0.3))),
      title: Row(children: [
        ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.asset('assets/logo.png', width: 38, height: 38)),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          const Text('ENGLISH-BRIDGEWAY',
              style: TextStyle(fontSize: 11, letterSpacing: 0.8, fontWeight: FontWeight.w800, color: AppColors.primary)),
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.navy, height: 1.2)),
        ]),
      ]),
      actions: [
        IconButton(
          tooltip: 'Search',
          icon: const Icon(Icons.search_rounded, color: AppColors.navy),
          onPressed: () => push(context, const SearchScreen()),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 12, left: 4),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () => MainShell.of(context).select(4),
            child: CircleAvatar(
              radius: 20,
              backgroundColor: AppColors.primary,
              foregroundImage: user?.avatarUrl != null ? NetworkImage(Api.absolute(user!.avatarUrl!)) : null,
              child: user == null
                  ? const Icon(Icons.person_rounded, color: Colors.white, size: 20)
                  : Text(user.avatarInitials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ),
        ),
      ],
    );
  }
}
