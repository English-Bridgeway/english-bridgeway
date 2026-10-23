import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../models.dart';
import '../nav.dart';
import '../services/api.dart';
import '../services/payments.dart';
import '../services/speech.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'courses.dart';

// Same situations and openers as src/utils/aiTutor.ts (the live server sends its own openers).
const _scenarios = [
  ('free', 'Free talk', Icons.emoji_people_rounded),
  ('interview', 'Job interview', Icons.work_outline_rounded),
  ('restaurant', 'Restaurant', Icons.restaurant_rounded),
  ('shopping', 'Shopping', Icons.shopping_bag_outlined),
  ('travel', 'Travel', Icons.flight_takeoff_rounded),
  ('doctor', 'Doctor', Icons.local_hospital_outlined),
  ('office', 'Office', Icons.apartment_rounded),
];

/// The tutor's reply without its "Correction:" line, and that line. Mirrors spokenPart() on the server.
(String, String?) splitCorrection(String reply) {
  final lines = reply.split(RegExp(r'\n+')).map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
  final i = lines.indexWhere((l) => RegExp(r'^correction\s*:', caseSensitive: false).hasMatch(l));
  if (i < 0) return (reply.trim(), null);
  final correction = lines[i].replaceFirst(RegExp(r'^correction\s*:\s*', caseSensitive: false), '');
  return ([for (var j = 0; j < lines.length; j++) if (j != i) lines[j]].join(' ').trim(), correction);
}

String _withoutTags(String s) => s.replaceAll(RegExp(r'\[[^\]]*\]\s*'), '').trim();

/// Speak with AI: chat (typed or spoken) with Bridget, the AI tutor (POST /api/ai/chat).
class AiTutorScreen extends StatefulWidget {
  const AiTutorScreen({super.key});
  @override
  State<AiTutorScreen> createState() => _AiTutorScreenState();
}

class _AiTutorScreenState extends State<AiTutorScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _stt = SpeechToText();
  final _player = AudioPlayer();
  Map<String, dynamic>? _status;
  String? _statusError;
  String _scenario = 'free';
  final _messages = <ChatMessage>[];
  bool _sending = false, _listening = false, _autoSpeak = true, _sttReady = false;
  int? _remaining;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    _player.dispose();
    _stt.cancel();
    Speech.instance.stop();
    super.dispose();
  }

  Future<void> _load() async {
    if (!context.read<AuthStore>().signedIn) return;
    try {
      final s = await context.read<Api>().aiStatus();
      setState(() {
        _status = s;
        _statusError = null;
        _remaining = s['remaining'] as int?;
      });
      _start(_scenario);
    } on ApiError catch (e) {
      setState(() => _statusError = e.message);
    }
  }

  void _start(String scenario) {
    final openers = _status?['openers'] is Map ? Map<String, dynamic>.from(_status!['openers']) : const <String, dynamic>{};
    final sigs = _status?['openerSigs'] is Map ? Map<String, dynamic>.from(_status!['openerSigs']) : const <String, dynamic>{};
    final opener = '${openers[scenario] ?? 'Hello! I am Bridget, your English speaking friend. How are you today?'}';
    setState(() {
      _scenario = scenario;
      _messages
        ..clear()
        ..add(ChatMessage('assistant', opener, sigs[scenario] as String?));
      _error = null;
    });
    if (_autoSpeak) _speak(_messages.first, opener: true);
  }

  Future<void> _speak(ChatMessage m, {bool opener = false}) async {
    final api = context.read<Api>();
    await _player.stop();
    final spoken = opener ? m.content : splitCorrection(m.content).$1;
    if (_status?['voice'] == 'elevenlabs' && m.speechSig != null) {
      try {
        final bytes = await api.aiSpeak(spoken, m.speechSig!);
        await _player.play(BytesSource(bytes, mimeType: 'audio/mpeg'));
        return;
      } catch (_) {
        // Fall back to the phone's voice.
      }
    }
    await Speech.instance.say(_withoutTags(spoken));
  }

  Future<void> _send([String? text]) async {
    final content = (text ?? _input.text).trim();
    if (content.isEmpty || _sending) return;
    final api = context.read<Api>();
    _input.clear();
    await Speech.instance.stop();
    await _player.stop();
    setState(() {
      _messages.add(ChatMessage('user', content));
      _sending = true;
      _error = null;
    });
    _toBottom();
    try {
      final r = await api.aiChat(_messages, _scenario);
      final reply = ChatMessage('assistant', '${r['reply']}', r['speechSig'] as String?);
      setState(() {
        _messages.add(reply);
        _remaining = r['remaining'] as int?;
      });
      _toBottom();
      if (_autoSpeak) _speak(reply);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent + 200, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      });

  Future<void> _toggleMic() async {
    if (_listening) {
      await _stt.stop();
      setState(() => _listening = false);
      return;
    }
    await Speech.instance.stop();
    await _player.stop();
    _sttReady = _sttReady || await _stt.initialize(onStatus: (s) {
      if ((s == 'done' || s == 'notListening') && mounted) setState(() => _listening = false);
    }, onError: (_) {
      if (mounted) setState(() => _listening = false);
    });
    if (!_sttReady) {
      if (mounted) showSnack(context, 'Speech recognition is not available. Allow the microphone, or type your answer.');
      return;
    }
    setState(() => _listening = true);
    await _stt.listen(
      listenOptions: SpeechListenOptions(localeId: 'en_IN', partialResults: true, listenMode: ListenMode.dictation),
      onResult: (r) {
        setState(() => _input.text = r.recognizedWords);
        if (r.finalResult && r.recognizedWords.trim().isNotEmpty) {
          setState(() => _listening = false);
          _send(r.recognizedWords);
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Speak with AI'),
        actions: [
          IconButton(
            tooltip: _autoSpeak ? 'Mute Bridget' : 'Let Bridget speak',
            icon: Icon(_autoSpeak ? Icons.volume_up_rounded : Icons.volume_off_rounded, color: AppColors.indigo),
            onPressed: () {
              setState(() => _autoSpeak = !_autoSpeak);
              if (!_autoSpeak) {
                Speech.instance.stop();
                _player.stop();
              }
            },
          ),
        ],
      ),
      body: !auth.signedIn
          ? _gate(
              icon: Icons.record_voice_over_rounded,
              title: 'Talk with Bridget, your AI tutor',
              message: 'Practise real conversations out loud. Bridget answers, corrects your mistakes gently and explains them. Log in or sign up for a free trial to start.',
              action: 'Log in or sign up',
              onAction: () async {
                await push(context, const AuthScreen());
                if (mounted) _load();
              },
            )
          : _statusError != null
              ? _gate(icon: Icons.wifi_off_rounded, title: 'Could not connect', message: _statusError!, action: 'Try again', onAction: _load)
              : _status == null
                  ? const Center(child: CircularProgressIndicator())
                  : _status!['enabled'] != true
                      ? _gate(icon: Icons.power_settings_new_rounded, title: 'Speak with AI is off', message: 'The AI tutor is switched off right now. Please try again later.')
                      : _status!['allowed'] != true && _messages.length <= 1
                          ? _gate(
                              icon: Icons.lock_outline_rounded,
                              title: 'Your AI messages are used up',
                              message: inAppPurchases
                                  ? '${_status!['message'] ?? 'Get a plan to keep practising with Bridget.'}'
                                  : 'You have used the AI messages in your account for now.',
                              action: inAppPurchases ? 'See plans' : null,
                              onAction: inAppPurchases ? () => push(context, const PlansScreen()) : null,
                            )
                          : _chat(),
    );
  }

  Widget _gate({required IconData icon, required String title, required String message, String? action, VoidCallback? onAction}) =>
      ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.circular(AppRadius.card)),
          child: Column(children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(color: AppColors.yellow, shape: BoxShape.circle),
              child: Icon(icon, size: 36, color: AppColors.navy),
            ),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), height: 1.5)),
            if (action != null) ...[
              const SizedBox(height: 18),
              AppButton(action, onPressed: onAction),
            ],
          ]),
        ),
      ]);

  Widget _chat() {
    return Column(children: [
      SizedBox(
        height: 52,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
          itemCount: _scenarios.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final (id, label, icon) = _scenarios[i];
            final selected = id == _scenario;
            return ChoiceChip(
              avatar: Icon(icon, size: 16, color: selected ? Colors.white : AppColors.indigo),
              label: Text(label),
              selected: selected,
              showCheckmark: false,
              onSelected: (_) => _start(id),
              selectedColor: AppColors.indigo,
              backgroundColor: Colors.white,
              labelStyle: TextStyle(color: selected ? Colors.white : AppColors.navy, fontWeight: FontWeight.w600, fontSize: 13),
              side: BorderSide(color: selected ? AppColors.indigo : AppColors.borderSky),
              shape: const StadiumBorder(),
            );
          },
        ),
      ),
      if (_remaining != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text('$_remaining message${_remaining == 1 ? '' : 's'} left${_status?['period'] == 'day' ? ' today' : ''}',
              style: const TextStyle(fontSize: 12, color: AppColors.outline)),
        ),
      Expanded(
        child: ListView.builder(
          controller: _scroll,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          itemCount: _messages.length + (_sending ? 1 : 0),
          itemBuilder: (_, i) {
            if (i == _messages.length) return const _Typing();
            final m = _messages[i];
            return m.role == 'user' ? _UserBubble(m.content) : _TutorBubble(message: m, opener: i == 0, onSpeak: () => _speak(m, opener: i == 0));
          },
        ),
      ),
      if (_error != null)
        Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.errorSoft, borderRadius: BorderRadius.circular(12)),
          child: Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
        ),
      SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          decoration: const BoxDecoration(color: Colors.white, boxShadow: floatingShadow),
          child: Row(children: [
            Material(
              color: _listening ? AppColors.error : AppColors.yellow,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: _sending ? null : _toggleMic,
                child: SizedBox(
                  width: 48,
                  height: 48,
                  child: Icon(_listening ? Icons.stop_rounded : Icons.mic_rounded, color: _listening ? Colors.white : AppColors.navy),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _input,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: _listening ? 'Listening… speak now' : 'Type or tap the mic and speak',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _sending ? null : () => _send(),
              style: IconButton.styleFrom(backgroundColor: AppColors.indigo, minimumSize: const Size(48, 48)),
              icon: const Icon(Icons.send_rounded, color: Colors.white),
            ),
          ]),
        ),
      ),
    ]);
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10, left: 48),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: const BoxDecoration(
            color: AppColors.indigo,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(18), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(4)),
          ),
          child: Text(text, style: const TextStyle(color: Colors.white, height: 1.4)),
        ),
      );
}

class _TutorBubble extends StatelessWidget {
  const _TutorBubble({required this.message, required this.opener, required this.onSpeak});
  final ChatMessage message;
  final bool opener;
  final VoidCallback onSpeak;
  @override
  Widget build(BuildContext context) {
    final (said, correction) = opener ? (message.content, null) : splitCorrection(message.content);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, right: 32),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const CircleAvatar(radius: 16, backgroundColor: AppColors.yellow, child: Text('B', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy))),
        const SizedBox(width: 8),
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: AppColors.borderSky.withValues(alpha: 0.7)),
                borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(4), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(18)),
                boxShadow: cardShadow,
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Flexible(child: Text(_withoutTags(said), style: const TextStyle(height: 1.45))),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Listen',
                  icon: const Icon(Icons.volume_up_rounded, size: 18, color: AppColors.indigo),
                  onPressed: onSpeak,
                ),
              ]),
            ),
            if (correction != null && correction.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.yellow)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.spellcheck_rounded, size: 18, color: AppColors.amberText),
                  const SizedBox(width: 8),
                  Expanded(child: Text(correction, style: const TextStyle(fontWeight: FontWeight.w600, height: 1.4))),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }
}

class _Typing extends StatelessWidget {
  const _Typing();
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.only(bottom: 10),
        child: Row(children: [
          CircleAvatar(radius: 16, backgroundColor: AppColors.yellow, child: Text('B', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy))),
          SizedBox(width: 8),
          Text('Bridget is typing…', style: TextStyle(color: AppColors.outline, fontStyle: FontStyle.italic)),
        ]),
      );
}
