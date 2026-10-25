import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';
import 'services/api.dart';

/// Lessons, words, quizzes and courses. Starts from the bundled copy of server/seed/content.json
/// (or the last bundle saved on the phone), then refreshes from GET /api/content.
class ContentStore extends ChangeNotifier {
  ContentStore(this.api, this.prefs);
  final Api api;
  final SharedPreferences prefs;
  static const _cacheKey = 'content-cache';

  ContentBundle? _bundle;
  ContentBundle get data => _bundle!;
  bool get ready => _bundle != null;
  bool online = false;

  Future<void> load() async {
    final cached = prefs.getString(_cacheKey);
    final bundled = jsonDecode(await rootBundle.loadString('assets/content.json')) as Map<String, dynamic>;
    final fallbackSite = SiteSettings.fromJson(Map<String, dynamic>.from(bundled['site'] as Map));
    try {
      _bundle = ContentBundle.fromJson(cached != null ? jsonDecode(cached) as Map<String, dynamic> : bundled, fallbackSite: fallbackSite);
    } catch (_) {
      _bundle = ContentBundle.fromJson(bundled);
    }
    notifyListeners();
    await refresh(fallbackSite: fallbackSite);
  }

  Future<void> refresh({SiteSettings? fallbackSite}) async {
    try {
      final live = await api.content();
      final next = ContentBundle.fromJson(live, fallbackSite: fallbackSite ?? _bundle?.site);
      // An empty database would wipe the app; keep what we have instead.
      if (next.grammarTopics.isEmpty && next.courses.isEmpty) return;
      _bundle = next;
      online = true;
      await prefs.setString(_cacheKey, jsonEncode(live));
      notifyListeners();
    } catch (_) {
      // Offline: keep the bundled or cached content.
    }
  }
}

/// The signed-in learner (POST /api/auth/*, GET /api/me).
class AuthStore extends ChangeNotifier {
  AuthStore(this.api, this.prefs) {
    final token = prefs.getString(_tokenKey);
    final user = prefs.getString(_userKey);
    if (token != null && user != null) {
      api.token = token;
      try {
        this.user = User.fromJson(jsonDecode(user) as Map<String, dynamic>);
      } catch (_) {
        api.token = null;
      }
    }
  }
  final Api api;
  final SharedPreferences prefs;
  static const _tokenKey = 'auth-token';
  static const _userKey = 'auth-user';

  User? user;
  AccountState? account;
  bool get signedIn => user != null;

  Future<void> _save(String token, User u) async {
    api.token = token;
    user = u;
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(u.toJson()));
    notifyListeners();
    await refresh();
  }

  Future<void> login(String email, String password) async {
    final (token, u) = await api.login(email.trim(), password);
    await _save(token, u);
  }

  Future<void> register(String name, String email, String password) async {
    final (token, u) = await api.register(name.trim(), email.trim(), password);
    await _save(token, u);
  }

  Future<void> refresh() async {
    if (api.token == null) return;
    try {
      final (u, state) = await api.me();
      user = u;
      account = state;
      await prefs.setString(_userKey, jsonEncode(u.toJson()));
      notifyListeners();
    } on ApiError catch (e) {
      // Only a rejected session signs out; a network blip keeps the learner signed in.
      if (e.status == 401 || e.status == 403) await logout();
    }
  }

  void setUser(User u) {
    user = u;
    prefs.setString(_userKey, jsonEncode(u.toJson()));
    notifyListeners();
  }

  Future<void> logout() async {
    api.token = null;
    user = null;
    account = null;
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
    notifyListeners();
  }

  // Same rules as AuthContext in the website.
  bool canOpenCourse(Course c) {
    final a = account;
    if (a == null) return !c.isPaid;
    return a.purchasedCourseIds.contains(c.id) || a.full || (!c.isPaid && a.tier == 'paid');
  }

  int freeLessonsFor(Course c) {
    if (canOpenCourse(c)) return 1 << 30;
    final a = account;
    if (a == null) return 0;
    return a.tier == 'trial' ? (a.freeLessons ?? 0) : 0;
  }

  bool canOpenLesson(Course c, int index) => index < freeLessonsFor(c);

  /// What this learner pays after a special offer from the admin.
  double priceFor(Course c) {
    if (!c.isPaid) return 0;
    final o = account?.offer;
    final value = (o?['value'] as num?)?.toDouble() ?? 0;
    if (o == null || value <= 0) return c.price;
    final expires = DateTime.tryParse('${o['expiresAt'] ?? ''}');
    if (expires != null && expires.isBefore(DateTime.now())) return c.price;
    final courseId = o['courseId'];
    if (courseId != null && courseId != c.id) return c.price;
    final offered = o['kind'] == 'price' ? value : c.price * (1 - (value > 100 ? 100 : value) / 100);
    return offered.roundToDouble().clamp(1, c.price).toDouble();
  }
}

/// Learner progress kept on this phone, like LearningContext on the website.
class ProgressStore extends ChangeNotifier {
  ProgressStore(this.prefs) {
    final raw = prefs.getString(_key);
    if (raw != null) {
      try {
        final j = jsonDecode(raw) as Map<String, dynamic>;
        completedLessons = List<String>.from(j['completedLessons'] ?? []);
        favoriteWords = List<String>.from(j['favoriteWords'] ?? []);
        activeDays = List<String>.from(j['activeDays'] ?? []);
        startedCourses = List<String>.from(j['startedCourses'] ?? []);
        lastLesson = j['lastLesson'] as String?;
        quizScores = Map<String, dynamic>.from(j['quizScores'] ?? {})
            .map((k, v) => MapEntry(k, (score: (v['score'] as num).toInt(), total: (v['total'] as num).toInt())));
      } catch (_) {}
    }
  }
  final SharedPreferences prefs;
  static const _key = 'learning';

  List<String> completedLessons = [];
  List<String> favoriteWords = [];
  List<String> activeDays = [];
  List<String> startedCourses = [];
  Map<String, ({int score, int total})> quizScores = {};

  /// "topicId/lessonId" of the grammar lesson opened last, for Continue on Home.
  String? lastLesson;

  static String _today() => DateTime.now().toIso8601String().substring(0, 10);

  void _save() {
    prefs.setString(
        _key,
        jsonEncode({
          'completedLessons': completedLessons,
          'favoriteWords': favoriteWords,
          'activeDays': activeDays,
          'startedCourses': startedCourses,
          'lastLesson': lastLesson,
          'quizScores': quizScores.map((k, v) => MapEntry(k, {'score': v.score, 'total': v.total})),
        }));
    notifyListeners();
  }

  void _markActive() {
    final t = _today();
    if (!activeDays.contains(t)) activeDays = [...activeDays, t].reversed.take(366).toList().reversed.toList();
  }

  bool isComplete(String key) => completedLessons.contains(key);

  void toggleComplete(String key) {
    if (completedLessons.contains(key)) {
      completedLessons = completedLessons.where((k) => k != key).toList();
    } else {
      completedLessons = [...completedLessons, key];
      _markActive();
    }
    _save();
  }

  void openLesson(String key) {
    lastLesson = key;
    _markActive();
    _save();
  }

  bool isFavorite(String id) => favoriteWords.contains(id);

  void toggleFavorite(String id) {
    favoriteWords = isFavorite(id) ? favoriteWords.where((w) => w != id).toList() : [...favoriteWords, id];
    _save();
  }

  void saveQuizScore(String quizId, int score, int total) {
    final best = quizScores[quizId];
    if (best == null || score >= best.score) quizScores = {...quizScores, quizId: (score: score, total: total)};
    _markActive();
    _save();
  }

  /// Keeps the most recently opened course last, so Home can resume it.
  void startCourse(String id) {
    if (startedCourses.lastOrNull == id) return;
    startedCourses = [...startedCourses.where((c) => c != id), id];
    _save();
  }

  /// Days in a row with activity, counting back from today (or yesterday).
  int get streak {
    final set = activeDays.toSet();
    var d = DateTime.now();
    String fmt(DateTime x) => x.toIso8601String().substring(0, 10);
    if (!set.contains(fmt(d))) d = d.subtract(const Duration(days: 1));
    var n = 0;
    while (set.contains(fmt(d))) {
      n++;
      d = d.subtract(const Duration(days: 1));
    }
    return n;
  }

  Future<void> reset() async {
    completedLessons = [];
    favoriteWords = [];
    activeDays = [];
    startedCourses = [];
    quizScores = {};
    lastLesson = null;
    _save();
  }
}
