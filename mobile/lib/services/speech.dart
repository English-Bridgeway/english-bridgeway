import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// "Listen" buttons: the phone's own text-to-speech, with a female English voice when it has one
/// (the website does the same with the browser voice, Admin → Site settings → Listen voice).
class Speech {
  Speech._();
  static final instance = Speech._();

  final FlutterTts _tts = FlutterTts();
  bool _ready = false;
  double rate = 0.9;
  double pitch = 1.1;

  /// The text being spoken now, so its button can show a stop icon.
  final ValueNotifier<String?> speaking = ValueNotifier(null);

  Future<void> _init() async {
    if (_ready) return;
    _ready = true;
    _tts.setCompletionHandler(_finished);
    _tts.setCancelHandler(_finished);
    _tts.setErrorHandler((_) => _finished());
    try {
      await _tts.setLanguage('en-IN');
      _voiceLanguage = 'en-IN';
      final voices = await _tts.getVoices;
      if (voices is List) {
        final english = voices.whereType<Map>().where((v) => '${v['locale']}'.toLowerCase().startsWith('en')).toList();
        final female = english.where((v) => RegExp('female|woman|samantha|karen|veena|tessa|zira', caseSensitive: false)
            .hasMatch('${v['name']} ${v['gender'] ?? ''}'));
        final pick = female.isNotEmpty ? female.first : (english.isNotEmpty ? english.first : null);
        if (pick != null) await _tts.setVoice({'name': '${pick['name']}', 'locale': '${pick['locale']}'});
      }
    } catch (_) {}
  }

  Completer<void>? _done;
  String? _voiceLanguage;

  void _finished() {
    speaking.value = null;
    if (_done?.isCompleted == false) _done!.complete();
  }

  Future<void> say(String text) async {
    await _init();
    if (_voiceLanguage == 'mr-IN') {
      _voiceLanguage = 'en-IN';
      await _tts.setLanguage('en-IN');
      _voiceLanguage = 'en-IN';
    }
    if (speaking.value == text) return stop();
    await _tts.stop();
    // flutter_tts rates are 0..1 on Android/iOS where 0.5 is normal speed.
    await _tts.setSpeechRate(kIsWeb ? rate : (rate * 0.5).clamp(0.2, 0.9));
    await _tts.setPitch(pitch.clamp(0.5, 2.0));
    speaking.value = text;
    await _tts.speak(text.replaceAll(RegExp(r'\[[^\]]*\]'), ''));
  }

  /// Speaks [text] and returns when it has been said (or stopped). Marathi or Hindi text
  /// (Devanagari) is read with a Marathi voice. Used by the AI tutor when its own voice is unavailable.
  Future<void> sayAndWait(String text) async {
    final spoken = text.replaceAll(RegExp(r'\[[^\]]*\]'), '').trim();
    if (spoken.isEmpty) return;
    await _init();
    await _tts.stop();
    final devanagari = RegExp(r'[\u0900-\u097F]').hasMatch(text);
    final language = devanagari ? 'mr-IN' : 'en-IN';
    if (language != _voiceLanguage) {
      _voiceLanguage = language;
      try {
        await _tts.setLanguage(language);
      } catch (_) {}
    }
    await _tts.setSpeechRate(kIsWeb ? rate : (rate * 0.5).clamp(0.2, 0.9));
    await _tts.setPitch(pitch.clamp(0.5, 2.0));
    final done = _done = Completer<void>();
    speaking.value = text;
    await _tts.speak(spoken);
    // Some engines never report the end; don't wait forever.
    await done.future.timeout(Duration(seconds: 8 + spoken.length ~/ 8), onTimeout: () {});
  }

  Future<void> stop() async {
    _finished();
    await _tts.stop();
  }
}
