import 'package:english_bridgeway/main.dart';
import 'package:english_bridgeway/services/api.dart';
import 'package:english_bridgeway/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _homeList = find.descendant(of: find.byType(RefreshIndicator), matching: find.byType(Scrollable)).first;

Future<void> pumpApp(WidgetTester tester, {Future<http.Response> Function(http.Request)? handler}) async {
  // The asset cache holds a future from the previous test's zone; start fresh.
  rootBundle.clear();
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  // Offline: the app falls back to the bundled content.
  final api = Api(client: MockClient(handler ?? (_) async => http.Response('{"message":"offline"}', 503)));
  await tester.binding.setSurfaceSize(const Size(412, 915));
  await tester.pumpWidget(BridgewayApp(api: api, prefs: prefs, theme: buildTheme(googleFonts: false).copyWith(textTheme: buildTheme(googleFonts: false).textTheme.apply(fontFamily: 'Roboto'))));
  // Loading the bundled content uses real async work (asset decoding), so let it run.
  for (var i = 0; i < 100 && find.text('Start Learning').evaluate().isEmpty; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  testWidgets('e-books list shows open and locked e-books from the server', (tester) async {
    const books = '[{"id":"b1","title":"Grammar Handbook","author":"EB","description":"","fileSize":2097152,"unlocked":true},'
        '{"id":"b2","title":"Phrase Book","author":"","description":"","courseTitle":"Spoken English in 30 Days","unlocked":false,'
        '"lockedReason":"This e-book comes with the course."}]';
    await pumpApp(tester, handler: (req) async => req.url.path.endsWith('/ebooks')
        ? http.Response(books, 200, headers: {'content-type': 'application/json'})
        : http.Response('{"message":"offline"}', 503));
    await tester.tap(find.text('Learn').last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('E-books'), 300, scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('E-books'));
    await tester.pumpAndSettle();
    expect(find.text('Grammar Handbook'), findsOneWidget);
    expect(find.text('Read'), findsOneWidget);
    expect(find.text('PDF · 2.0 MB'), findsOneWidget);
    expect(find.text('This e-book comes with the course.'), findsOneWidget);
    expect(find.text('Log in to read'), findsOneWidget);
  });

  testWidgets('home shows the hero, streak card and sections from the bundled content', (tester) async {
    await pumpApp(tester);
    expect(find.text('Start Learning'), findsOneWidget);
    expect(find.text('Explore Courses'), findsOneWidget);
    expect(find.text('Start your streak'), findsOneWidget);
    expect(find.text('CURRENT LESSON'), findsOneWidget);
    await tester.scrollUntilVisible(find.text("What you'll learn"), 300, scrollable: _homeList);
    expect(find.text("What you'll learn"), findsOneWidget);
    await tester.scrollUntilVisible(find.text('WORD OF THE DAY'), 300, scrollable: _homeList);
    expect(find.text('Popular courses'), findsOneWidget);
  });

  testWidgets('bottom navigation switches tabs and grammar topics open', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.text('Learn').last);
    await tester.pumpAndSettle();
    expect(find.text('Your learning path'), findsOneWidget);
    await tester.tap(find.text('Grammar').first);
    await tester.pumpAndSettle();
    expect(find.text('Tenses'), findsOneWidget);
    expect(find.textContaining('lessons done'), findsOneWidget);
  });

  testWidgets('a quiz can be answered to the end', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.text('Quiz').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Grammar Essentials'));
    await tester.pumpAndSettle();
    expect(find.text('Question 1 of 10'), findsOneWidget);
    await tester.tap(find.text('goes'));
    await tester.pump();
    await tester.tap(find.text('Check answer'));
    await tester.pumpAndSettle();
    expect(find.text('Correct!'), findsOneWidget);
  });

  testWidgets('courses and the profile tab render signed out', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.text('Courses').last);
    await tester.pumpAndSettle();
    expect(find.text('Beginner English'), findsWidgets);
    await tester.tap(find.text('Profile').last);
    await tester.pumpAndSettle();
    expect(find.text('Create free account'), findsOneWidget);
  });
}
