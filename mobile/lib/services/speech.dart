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
    _tts.setCompletionHandler(() => speaking.value = null);
    _tts.setCancelHandler(() => speaking.value = null);
    _tts.setErrorHandler((_) => speaking.value = null);
    try {
      await _tts.setLanguage('en-IN');
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

  Future<void> say(String text) async {
    await _init();
    if (speaking.value == text) return stop();
    await _tts.stop();
    // flutter_tts rates are 0..1 on Android/iOS where 0.5 is normal speed.
    await _tts.setSpeechRate(kIsWeb ? rate : (rate * 0.5).clamp(0.2, 0.9));
    await _tts.setPitch(pitch.clamp(0.5, 2.0));
    speaking.value = text;
    await _tts.speak(text.replaceAll(RegExp(r'\[[^\]]*\]'), ''));
  }

  Future<void> stop() async {
    speaking.value = null;
    await _tts.stop();
  }
}
