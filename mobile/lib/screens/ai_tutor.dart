import 'dart:async';
import 'dart:typed_data';

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

String _withoutTags(String s) => s.replaceAll(RegExp(r'\[[^\]]*\]\s*'), '').trim();

/// Bridget's picture (the office photo). Until it is bundled, a gradient is shown instead.
const tutorPhoto = 'assets/bridget.jpg';

/// Speak with AI: a voice call (or a typed chat) with Bridget, the AI tutor (POST /api/ai/chat).
///
/// Every reply is spoken in one voice, the ElevenLabs tutor voice set in Admin → AI tutor →
/// Tutor voice, part by part: the Marathi explanation of a mistake, the English to say, then the
/// next question. With "Mic auto-on" the microphone opens again when she has finished.
class AiTutorScreen extends StatefulWidget {
  const AiTutorScreen({super.key});
  @override
  State<AiTutorScreen> createState() => _AiTutorScreenState();
}

class _AiTutorScreenState extends State<AiTutorScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _stt = SpeechToText();
  final _player = AudioPlayer(playerId: 'tutor-voice');
  Map<String, dynamic>? _status;
  String? _statusError;
  String _scenario = 'free';
  final _messages = <ChatMessage>[];
  bool _sending = false, _listening = false, _autoSpeak = true, _handsFree = true, _callView = true, _sttReady = false;
  int? _remaining;
  String? _error;

  /// Bumped to cancel what is being spoken.
  int _playId = 0;
  Completer<void>? _partDone;
  ChatMessage? _speakingMessage;
  int? _speakingPart;

  /// Why her own voice is not playing, shown once so it can be fixed.
  String? _voiceNote;

  @override
  void initState() {
    super.initState();
    // While the microphone is in use iOS routes sound to the earpiece; keep her on the speaker.
    _player.setAudioContext(AudioContext(
      iOS: AudioContextIOS(category: AVAudioSessionCategory.playAndRecord, options: const {
        AVAudioSessionOptions.defaultToSpeaker,
        AVAudioSessionOptions.allowBluetooth,
        AVAudioSessionOptions.allowBluetoothA2DP,
      }),
      android: const AudioContextAndroid(contentType: AndroidContentType.speech, usageType: AndroidUsageType.media, audioFocus: AndroidAudioFocus.gain),
    )).catchError((_) {});
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _playId++;
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
        _voiceNote = s['voice'] == 'elevenlabs' ? null : "Bridget's own voice is switched off on the server, so the phone's voice is used. Turn it on in Admin → AI tutor → Tutor voice.";
      });
      _start(_scenario);
    } on ApiError catch (e) {
      setState(() => _statusError = e.message);
    }
  }

  void _start(String scenario) {
    _stopVoice();
    _stt.cancel();
    final openers = _status?['openers'] is Map ? Map<String, dynamic>.from(_status!['openers']) : const <String, dynamic>{};
    final sigs = _status?['openerSigs'] is Map ? Map<String, dynamic>.from(_status!['openerSigs']) : const <String, dynamic>{};
    final opener = '${openers[scenario] ?? 'Hello! I am Bridget, your English speaking friend. How are you today?'}';
    final first = ChatMessage.tutor({'reply': opener, 'speechSig': sigs[scenario]}, opener: true);
    setState(() {
      _scenario = scenario;
      _listening = false;
      _messages
        ..clear()
        ..add(first);
      _error = null;
    });
    if (_autoSpeak) _speak(first, thenListen: true);
  }

  // ---- Her voice ----

  Future<(Uint8List?, String?)> _audio(Api api, TutorPart p) async {
    if (_status?['voice'] != 'elevenlabs' || p.sig == null) return (null, null);
    try {
      return (await api.aiSpeak(p.text, p.sig!), null);
    } on ApiError catch (e) {
      return (null, e.message);
    } catch (e) {
      return (null, '$e');
    }
  }

  /// Plays MP3 audio and returns when it ends or is stopped. False when it could not play.
  Future<bool> _play(Uint8List bytes) async {
    final done = _partDone = Completer<void>();
    final sub = _player.onPlayerComplete.listen((_) {
      if (!done.isCompleted) done.complete();
    });
    try {
      await _player.play(BytesSource(bytes, mimeType: 'audio/mpeg'));
      await done.future.timeout(const Duration(minutes: 2), onTimeout: () {});
      return true;
    } catch (e) {
      if (mounted) setState(() => _voiceNote = "Bridget's voice could not play on this phone ($e). The phone's voice is used for now.");
      return false;
    } finally {
      await sub.cancel();
    }
  }

  void _stopAudio() {
    if (_partDone?.isCompleted == false) _partDone!.complete();
    _player.stop();
    Speech.instance.stop();
  }

  void _stopVoice() {
    _playId++;
    _stopAudio();
    if (_speakingMessage != null && mounted) {
      setState(() {
        _speakingMessage = null;
        _speakingPart = null;
      });
    }
  }

  /// Says the reply part by part in her voice; then opens the mic when [thenListen] and Mic auto-on.
  Future<void> _speak(ChatMessage m, {bool thenListen = false, int? onlyPart}) async {
    final api = context.read<Api>();
    _stopVoice();
    final id = _playId;
    final parts = [for (var i = 0; i < m.parts.length; i++) if (onlyPart == null || onlyPart == i) i];
    // Ask for every part's audio at once so there is no gap between them.
    final audio = {for (final i in parts) i: _audio(api, m.parts[i])};
    for (final i in parts) {
      if (id != _playId || !mounted) return;
      setState(() {
        _speakingMessage = m;
        _speakingPart = i;
      });
      final (bytes, problem) = await audio[i]!;
      if (id != _playId || !mounted) return;
      if (problem != null) setState(() => _voiceNote = "Bridget's voice did not load: $problem The phone's voice is used for now.");
      if (bytes == null || !await _play(bytes)) {
        if (id != _playId) return;
        await Speech.instance.sayAndWait(_withoutTags(m.parts[i].text));
      }
    }
    if (id != _playId || !mounted) return;
    setState(() {
      _speakingMessage = null;
      _speakingPart = null;
    });
    if (thenListen && _handsFree && !_sending) _startListening();
  }

  // ---- Talking ----

  Future<void> _send([String? text, bool fromVoice = false]) async {
    final content = (text ?? _input.text).trim();
    if (content.isEmpty || _sending) return;
    final api = context.read<Api>();
    _input.clear();
    _stopVoice();
    setState(() {
      _messages.add(ChatMessage('user', content));
      _sending = true;
      _error = null;
    });
    _toBottom();
    try {
      final r = await api.aiChat(_messages, _scenario);
      final reply = ChatMessage.tutor(r);
      setState(() {
        _messages.add(reply);
        _remaining = r['remaining'] as int?;
        _sending = false;
      });
      _toBottom();
      if (_autoSpeak) {
        _speak(reply, thenListen: fromVoice);
      } else if (fromVoice && _handsFree) {
        _startListening();
      }
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted && _sending) setState(() => _sending = false);
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
    await _startListening();
  }

  Future<void> _startListening() async {
    if (_listening || !mounted) return;
    _stopVoice();
    _sttReady = _sttReady || await _stt.initialize(onStatus: (s) {
      if ((s == 'done' || s == 'notListening') && mounted) setState(() => _listening = false);
    }, onError: (_) {
      if (mounted) setState(() => _listening = false);
    });
    if (!mounted) return;
    if (!_sttReady) {
      showSnack(context, 'Speech recognition is not available. Allow the microphone, or type your answer.');
      return;
    }
    setState(() => _listening = true);
    await _stt.listen(
      listenOptions: SpeechListenOptions(
          localeId: 'en_IN', partialResults: true, listenMode: ListenMode.dictation, listenFor: const Duration(seconds: 60), pauseFor: const Duration(seconds: 3)),
      onResult: (r) {
        if (!mounted) return;
        setState(() => _input.text = r.recognizedWords);
        if (r.finalResult && r.recognizedWords.trim().isNotEmpty) {
          setState(() => _listening = false);
          _send(r.recognizedWords, true);
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final ready = auth.signedIn && _statusError == null && _status != null && _status!['enabled'] == true &&
        !(_status!['allowed'] != true && _messages.length <= 1);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Speak with AI'),
        actions: [
          if (ready) ...[
            IconButton(
              tooltip: _handsFree ? 'Mic auto-on: on' : 'Mic auto-on: off',
              icon: Icon(_handsFree ? Icons.hearing_rounded : Icons.hearing_disabled_rounded, color: AppColors.indigo),
              onPressed: () {
                setState(() => _handsFree = !_handsFree);
                showSnack(context, _handsFree ? 'Mic auto-on: the mic opens when Bridget finishes.' : 'Mic auto-on is off. Tap the mic to talk.');
              },
            ),
            IconButton(
              tooltip: _callView ? 'Show the chat' : 'Back to the call',
              icon: Icon(_callView ? Icons.forum_outlined : Icons.call_rounded, color: AppColors.indigo),
              onPressed: () {
                setState(() => _callView = !_callView);
                _toBottom();
              },
            ),
          ],
          IconButton(
            tooltip: _autoSpeak ? 'Mute Bridget' : 'Let Bridget speak',
            icon: Icon(_autoSpeak ? Icons.volume_up_rounded : Icons.volume_off_rounded, color: AppColors.indigo),
            onPressed: () {
              setState(() => _autoSpeak = !_autoSpeak);
              if (!_autoSpeak) _stopVoice();
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
                      : !ready
                          ? _gate(
                              icon: Icons.lock_outline_rounded,
                              title: 'Your AI messages are used up',
                              message: inAppPurchases
                                  ? '${_status!['message'] ?? 'Get a plan to keep practising with Bridget.'}'
                                  : 'You have used the AI messages in your account for now.',
                              action: inAppPurchases ? 'See plans' : null,
                              onAction: inAppPurchases ? () => push(context, const PlansScreen()) : null,
                            )
                          : Column(children: [
                              _scenarioChips(),
                              if (_remaining != null)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: Text('$_remaining message${_remaining == 1 ? '' : 's'} left${_status?['period'] == 'day' ? ' today' : ''}',
                                      style: const TextStyle(fontSize: 12, color: AppColors.outline)),
                                ),
                              Expanded(child: _callView ? _call() : _chat()),
                              if (_voiceNote != null) _note(),
                              if (_error != null)
                                Container(
                                  width: double.infinity,
                                  margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(color: AppColors.errorSoft, borderRadius: BorderRadius.circular(12)),
                                  child: Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
                                ),
                              _composer(),
                            ]),
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

  Widget _scenarioChips() => SizedBox(
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
      );

  Widget _note() => Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
        padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
        decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          const Icon(Icons.info_outline_rounded, size: 18, color: AppColors.amberText),
          const SizedBox(width: 8),
          Expanded(child: Text(_voiceNote!, style: const TextStyle(fontSize: 12, color: AppColors.amberText, height: 1.35))),
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Hide',
            icon: const Icon(Icons.close_rounded, size: 16, color: AppColors.amberText),
            onPressed: () => setState(() => _voiceNote = null),
          ),
        ]),
      );

  /// What the learner said that a tutor reply corrects, so its wrong words can be marked.
  ({String wrong, String right})? _mistakeFor(int userIndex) =>
      userIndex + 1 < _messages.length ? _messages[userIndex + 1].mistake : null;

  /// The call: her photo, what she is doing, and the latest exchange as live captions.
  Widget _call() {
    final lastTutor = _messages.lastIndexWhere((m) => m.role == 'assistant');
    final lastUser = _messages.lastIndexWhere((m) => m.role == 'user');
    final speaking = _speakingMessage != null;
    final state = _listening
        ? 'Listening…'
        : _sending
            ? 'Thinking…'
            : speaking
                ? 'Speaking…'
                : _handsFree
                    ? 'Tap the mic and say something'
                    : 'Tap the mic to talk';
    return ListView(controller: _scroll, padding: const EdgeInsets.fromLTRB(16, 4, 16, 16), children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: Stack(fit: StackFit.expand, children: [
            Image.asset(
              tutorPhoto,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                decoration: const BoxDecoration(gradient: LinearGradient(colors: [AppColors.indigo, AppColors.navy], begin: Alignment.topLeft, end: Alignment.bottomRight)),
                alignment: Alignment.center,
                child: const CircleAvatar(radius: 52, backgroundColor: AppColors.yellow, child: Text('B', style: TextStyle(fontSize: 44, fontWeight: FontWeight.w800, color: AppColors.navy))),
              ),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.center, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xCC0D1640)])),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 14,
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    const Text('Bridget', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(state, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontWeight: FontWeight.w600)),
                  ]),
                ),
                _Bars(active: speaking || _listening, color: _listening ? AppColors.yellow : Colors.white),
              ]),
            ),
          ]),
        ),
      ),
      const SizedBox(height: 14),
      if (lastUser > 0 && lastUser < lastTutor) ...[
        _UserBubble(_messages[lastUser].content, mistake: _mistakeFor(lastUser)),
      ],
      if (_listening && _input.text.isNotEmpty) _UserBubble(_input.text, live: true),
      if (_sending) const _Typing(),
      if (lastTutor >= 0 && !_sending)
        _TutorTurn(
          message: _messages[lastTutor],
          speakingPart: identical(_speakingMessage, _messages[lastTutor]) ? _speakingPart : null,
          onSpeak: (i) => _speak(_messages[lastTutor], onlyPart: i),
        ),
    ]);
  }

  Widget _chat() => ListView.builder(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        itemCount: _messages.length + (_sending ? 1 : 0),
        itemBuilder: (_, i) {
          if (i == _messages.length) return const _Typing();
          final m = _messages[i];
          return m.role == 'user'
              ? _UserBubble(m.content, mistake: _mistakeFor(i))
              : _TutorTurn(message: m, speakingPart: identical(_speakingMessage, m) ? _speakingPart : null, onSpeak: (p) => _speak(m, onlyPart: p));
        },
      );

  Widget _composer() => SafeArea(
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
                  width: 52,
                  height: 52,
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
      );
}

/// Sound bars that move while she speaks or the mic listens.
class _Bars extends StatefulWidget {
  const _Bars({required this.active, required this.color});
  final bool active;
  final Color color;
  @override
  State<_Bars> createState() => _BarsState();
}

class _BarsState extends State<_Bars> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  @override
  void initState() {
    super.initState();
    if (widget.active) _c.repeat();
  }

  @override
  void didUpdateWidget(_Bars old) {
    super.didUpdateWidget(old);
    if (widget.active && !_c.isAnimating) _c.repeat();
    if (!widget.active && _c.isAnimating) _c.stop();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, _) => Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (var i = 0; i < 4; i++)
            Container(
              width: 5,
              height: widget.active ? 8 + 18 * (0.5 + 0.5 * _wave(_c.value * 6.283 + i * 1.3)) : 6,
              margin: const EdgeInsets.only(left: 3),
              decoration: BoxDecoration(color: widget.color, borderRadius: BorderRadius.circular(3)),
            ),
        ]),
      );

  static double _wave(double x) {
    // A cheap sine without dart:math.
    x = x % 6.283 - 3.1416;
    return 1.27323954 * x - 0.405284735 * x * x.abs();
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble(this.text, {this.mistake, this.live = false});
  final String text;
  final ({String wrong, String right})? mistake;
  final bool live;
  @override
  Widget build(BuildContext context) {
    const base = TextStyle(color: Colors.white, height: 1.4);
    final at = mistake == null ? -1 : text.toLowerCase().indexOf(mistake!.wrong.toLowerCase());
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10, left: 48),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: live ? AppColors.indigo.withValues(alpha: 0.6) : AppColors.indigo,
          borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(18), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(4)),
        ),
        child: at < 0
            ? Text(text, style: base)
            : Text.rich(TextSpan(style: base, children: [
                TextSpan(text: text.substring(0, at)),
                // The words she corrected: marked, as on paper.
                TextSpan(
                  text: text.substring(at, at + mistake!.wrong.length),
                  style: const TextStyle(
                    color: AppColors.error,
                    backgroundColor: AppColors.errorSoft,
                    fontWeight: FontWeight.w700,
                    decoration: TextDecoration.lineThrough,
                    decorationColor: AppColors.error,
                    decorationThickness: 2,
                  ),
                ),
                TextSpan(text: text.substring(at + mistake!.wrong.length)),
              ])),
      ),
    );
  }
}

/// One tutor reply: the mistake and the right words, then each spoken part, the one being spoken highlighted.
class _TutorTurn extends StatelessWidget {
  const _TutorTurn({required this.message, required this.speakingPart, required this.onSpeak});
  final ChatMessage message;
  final int? speakingPart;
  final void Function(int part) onSpeak;

  static const _labels = {
    'explain': ('Why we say it', Icons.translate_rounded),
    'say': ('Say it in English', Icons.record_voice_over_rounded),
  };

  @override
  Widget build(BuildContext context) {
    final mistake = message.mistake;
    final correction = message.correction;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, right: 24),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const CircleAvatar(radius: 16, backgroundColor: AppColors.yellow, child: Text('B', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy))),
        const SizedBox(width: 8),
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (mistake != null || (correction != null && correction.isNotEmpty))
              Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.yellow)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (mistake != null)
                    Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 6, children: [
                      _Chip(mistake.wrong, wrong: true),
                      const Icon(Icons.arrow_forward_rounded, size: 18, color: AppColors.amberText),
                      _Chip(mistake.right, wrong: false),
                    ]),
                  if (mistake != null && correction != null && correction.isNotEmpty) const SizedBox(height: 8),
                  if (correction != null && correction.isNotEmpty)
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Icon(Icons.spellcheck_rounded, size: 18, color: AppColors.amberText),
                      const SizedBox(width: 8),
                      Expanded(child: Text(correction, style: const TextStyle(fontWeight: FontWeight.w600, height: 1.4))),
                    ]),
                ]),
              ),
            for (var i = 0; i < message.parts.length; i++) _part(i),
          ]),
        ),
      ]),
    );
  }

  Widget _part(int i) {
    final p = message.parts[i];
    final label = _labels[p.kind];
    final active = speakingPart == i;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
      decoration: BoxDecoration(
        color: p.kind == 'say' ? AppColors.successSoft : Colors.white,
        border: Border.all(color: active ? AppColors.indigo : AppColors.borderSky.withValues(alpha: 0.7), width: active ? 2 : 1),
        borderRadius: const BorderRadius.only(topLeft: Radius.circular(4), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(18)),
        boxShadow: cardShadow,
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (label != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(label.$2, size: 14, color: p.kind == 'say' ? AppColors.success : AppColors.indigo),
                  const SizedBox(width: 4),
                  Text(label.$1.toUpperCase(),
                      style: TextStyle(fontSize: 11, letterSpacing: 0.6, fontWeight: FontWeight.w800, color: p.kind == 'say' ? AppColors.success : AppColors.indigo)),
                ]),
              ),
            Text(_withoutTags(p.text), style: TextStyle(height: 1.45, fontWeight: p.kind == 'say' ? FontWeight.w700 : FontWeight.w400)),
          ]),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          tooltip: 'Listen',
          icon: Icon(active ? Icons.graphic_eq_rounded : Icons.volume_up_rounded, size: 18, color: AppColors.indigo),
          onPressed: () => onSpeak(i),
        ),
      ]),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.text, {required this.wrong});
  final String text;
  final bool wrong;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: wrong ? AppColors.errorSoft : AppColors.successSoft, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(wrong ? Icons.close_rounded : Icons.check_rounded, size: 15, color: wrong ? AppColors.error : AppColors.success),
          const SizedBox(width: 4),
          Flexible(
            child: Text(text,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: wrong ? AppColors.error : AppColors.success,
                  decoration: wrong ? TextDecoration.lineThrough : null,
                  decorationColor: AppColors.error,
                )),
          ),
        ]),
      );
}

class _Typing extends StatelessWidget {
  const _Typing();
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.only(bottom: 10),
        child: Row(children: [
          CircleAvatar(radius: 16, backgroundColor: AppColors.yellow, child: Text('B', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy))),
          SizedBox(width: 8),
          Text('Bridget is thinking…', style: TextStyle(color: AppColors.outline, fontStyle: FontStyle.italic)),
        ]),
      );
}
