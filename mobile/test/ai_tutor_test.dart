import 'dart:convert';

import 'package:english_bridgeway/models.dart';
import 'package:english_bridgeway/screens/ai_tutor.dart';
import 'package:english_bridgeway/services/api.dart';
import 'package:english_bridgeway/state.dart';
import 'package:english_bridgeway/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _reply = {
  'reply': 'Correction: I go to school every day.\nअगं, छोटीशी चूक! Say it with me: "I go to school every day." Which school do you go to?',
  'remaining': 9,
  'mistake': {'wrong': 'I goes', 'right': 'I go'},
  'correction': 'I go to school every day.',
  'parts': [
    {'kind': 'explain', 'text': '[laughs softly] अगं, छोटीशी चूक झाली! "I" बरोबर आपण "go" वापरतो.'},
    {'kind': 'say', 'text': 'Say it with me: "I go to school every day."'},
    {'kind': 'next', 'text': 'Ooh, which school do you go to?'},
  ],
};

void main() {
  test('a reply with parts keeps its mistake, correction and parts in order', () {
    final m = ChatMessage.tutor(Map<String, dynamic>.from(_reply));
    expect(m.mistake?.wrong, 'I goes');
    expect(m.mistake?.right, 'I go');
    expect(m.parts.map((p) => p.kind), ['explain', 'say', 'next']);
    // History sent back to the server stays one text.
    expect(m.toJson()['content'], startsWith('Correction:'));
  });

  test('an older server reply becomes one spoken part and a correction', () {
    final m = ChatMessage.tutor({'reply': 'Correction: I go.\nNice try! Say "I go".', 'speechSig': 'abc'});
    expect(m.correction, 'I go.');
    expect(m.parts.single.text, 'Nice try! Say "I go".');
    expect(m.parts.single.sig, 'abc');
  });

  testWidgets('the call shows the marked mistake, the right words and each part', (tester) async {
    // The phone's speech, audio and microphone plugins do nothing in tests.
    for (final channel in ['flutter_tts', 'xyz.luan/audioplayers', 'xyz.luan/audioplayers.global', 'plugin.csdcorp.com/speech_to_text']) {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(MethodChannel(channel), (_) async => 1);
    }
    for (final channel in ['xyz.luan/audioplayers.global/events', 'xyz.luan/audioplayers/events/tutor-voice']) {
      tester.binding.defaultBinaryMessenger.setMockStreamHandler(EventChannel(channel), MockStreamHandler.inline(onListen: (_, _) {}));
    }
    SharedPreferences.setMockInitialValues({
      'auth-token': 't',
      'auth-user': jsonEncode({'id': 'u1', 'name': 'Asha Patil', 'email': 'a@example.com'}),
    });
    final prefs = await SharedPreferences.getInstance();
    final api = Api(client: MockClient((req) async {
      final json = {'content-type': 'application/json; charset=utf-8'};
      if (req.url.path.endsWith('/ai/status')) {
        return http.Response(jsonEncode({'enabled': true, 'allowed': true, 'remaining': 10, 'voice': 'browser', 'openers': {'free': 'Hiii! How are you today?'}}), 200, headers: json);
      }
      if (req.url.path.endsWith('/ai/chat')) return http.Response.bytes(utf8.encode(jsonEncode(_reply)), 200, headers: json);
      return http.Response('{"message":"offline"}', 503);
    }));
    await tester.binding.setSurfaceSize(const Size(412, 915));
    await tester.pumpWidget(MultiProvider(
      providers: [Provider.value(value: api), ChangeNotifierProvider(create: (_) => AuthStore(api, prefs))],
      child: MaterialApp(theme: buildTheme(googleFonts: false), home: const AiTutorScreen()),
    ));
    await tester.pump();
    await tester.pump();
    expect(find.text('Bridget'), findsOneWidget);
    expect(find.text('Hiii! How are you today?'), findsOneWidget);
    expect(find.textContaining('switched off on the server'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'I goes to school every day');
    await tester.tap(find.byIcon(Icons.send_rounded));
    await tester.pump();
    await tester.pump();
    expect(find.text('I goes'), findsOneWidget); // the wrong words, struck out
    expect(find.text('I go'), findsOneWidget); // the right words
    expect(find.text('WHY WE SAY IT'), findsOneWidget);
    expect(find.text('SAY IT IN ENGLISH'), findsOneWidget);
    expect(find.text('Ooh, which school do you go to?'), findsOneWidget);
    expect(find.text('9 messages left'), findsOneWidget);

    // Leave the screen so the speech waits end.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(minutes: 1));
  });
}
