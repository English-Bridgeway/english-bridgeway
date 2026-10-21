import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import 'screens/ai_tutor.dart';
import 'screens/auth.dart';
import 'screens/blog.dart';
import 'screens/courses.dart';
import 'screens/grammar.dart';
import 'screens/quiz.dart';
import 'screens/spoken.dart';
import 'screens/vocabulary.dart';
import 'models.dart';
import 'state.dart';

/// Opens a screen. Browsing screens open inside the current tab (the bottom bar stays);
/// lessons, quizzes, the AI tutor and login cover the whole screen.
Future<T?> push<T>(BuildContext context, Widget screen) {
  final fullScreen = screen is GrammarLessonScreen ||
      screen is SpokenLessonScreen ||
      screen is QuizRunnerScreen ||
      screen is AiTutorScreen ||
      screen is AuthScreen;
  return Navigator.of(context, rootNavigator: fullScreen).push<T>(MaterialPageRoute(builder: (_) => screen));
}

/// Opens a website path (as used in course curricula, e.g. "/grammar/tenses/present-simple")
/// on the matching app screen, or in the browser when the app has no such screen.
Future<void> openHref(BuildContext context, String href, {Course? course, int? lessonIndex}) async {
  final content = context.read<ContentStore>().data;
  final screen = screenFor(content, href, course: course, lessonIndex: lessonIndex);
  if (screen != null) {
    await push(context, screen);
    return;
  }
  await openExternal(href.startsWith('http') ? href : '${content.site.url}$href');
}

/// The app screen for a website path, or null when there is none.
Widget? screenFor(ContentBundle content, String href, {Course? course, int? lessonIndex}) {
  final parts = Uri.parse(href).pathSegments.where((p) => p.isNotEmpty).toList();
  Widget? screen;
  if (parts.isNotEmpty) {
    switch (parts[0]) {
      case 'grammar':
        if (parts.length >= 3 && content.lesson(parts[1], parts[2]) != null) {
          screen = GrammarLessonScreen(topicId: parts[1], lessonId: parts[2], course: course, lessonIndex: lessonIndex);
        } else if (parts.length == 2 && content.topic(parts[1]) != null) {
          screen = GrammarTopicScreen(topicId: parts[1]);
        } else {
          screen = const GrammarScreen();
        }
      case 'spoken-english':
        screen = parts.length >= 2 && content.spoken(parts[1]) != null
            ? SpokenLessonScreen(id: parts[1], course: course, lessonIndex: lessonIndex)
            : const SpokenListScreen();
      case 'vocabulary':
        screen = parts.length >= 2 && content.word(parts[1]) != null ? WordScreen(id: parts[1]) : const VocabularyScreen();
      case 'quiz':
        final quiz = parts.length >= 3 ? content.quiz(parts[2]) : null;
        screen = quiz != null ? QuizRunnerScreen(quiz: quiz) : const QuizHomeScreen(standalone: true);
      case 'courses':
        screen = parts.length >= 2 && content.course(parts[1]) != null ? CourseScreen(id: parts[1]) : const CoursesScreen(standalone: true);
      case 'blog':
        screen = parts.length >= 2 && content.post(parts[1]) != null ? BlogPostScreen(slug: parts[1]) : const BlogScreen();
    }
  }
  return screen;
}

Future<void> openExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
}
