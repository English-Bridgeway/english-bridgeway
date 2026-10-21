import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../models.dart';

/// The site's API (server/src). Point the app at another server with
/// `flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api`.
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://englishbridgeway.com/api');

class ApiError implements Exception {
  final int status;
  final String message;
  final String? field;
  final String? code;
  ApiError(this.status, this.message, {this.field, this.code});
  @override
  String toString() => message;
}

class Api {
  Api({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  /// Bearer token of the signed-in learner, if any.
  String? token;

  Uri _uri(String path) => Uri.parse('$apiBase$path');

  /// Avatar and other server paths ("/avatars/…") as absolute URLs.
  static String absolute(String path) => path.startsWith('http') ? path : '$apiBase$path';

  Map<String, String> _headers({bool json = false}) => {
        'Accept': 'application/json',
        if (json) 'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> _send(String method, String path, {Object? body}) async {
    final req = http.Request(method, _uri(path))..headers.addAll(_headers(json: body != null));
    if (body != null) req.body = jsonEncode(body);
    final http.Response res;
    try {
      res = await http.Response.fromStream(await _client.send(req).timeout(const Duration(seconds: 30)));
    } catch (_) {
      throw ApiError(0, 'Could not reach English-Bridgeway. Check your internet connection and try again.');
    }
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    dynamic data;
    if (res.body.isNotEmpty) {
      try {
        data = jsonDecode(utf8.decode(res.bodyBytes));
      } catch (_) {
        data = null;
      }
    }
    if (res.statusCode >= 400) {
      final map = data is Map ? data : const {};
      throw ApiError(res.statusCode, '${map['message'] ?? 'Something went wrong. Please try again.'}',
          field: map['field'] as String?, code: map['code'] as String?);
    }
    return data;
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body ?? const {});
  Future<dynamic> patch(String path, Object body) => _send('PATCH', path, body: body);
  Future<dynamic> put(String path, Object body) => _send('PUT', path, body: body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  // ---- Public ----

  Future<Map<String, dynamic>> content() async => Map<String, dynamic>.from(await get('/content') as Map);

  Future<bool> paymentsEnabled() async {
    final r = await get('/payments/config');
    return r is Map && r['enabled'] == true;
  }

  Future<String> paymentsMode() async {
    final r = await get('/payments/config');
    return r is Map ? '${r['mode'] ?? 'production'}' : 'production';
  }

  Future<void> sendMessage({required String name, required String email, required String subject, required String message, String? phone}) =>
      post('/messages', {'name': name, 'email': email, 'subject': subject, 'message': message, 'phone': ?phone});

  // ---- Accounts ----

  Future<(String, User)> login(String email, String password) async =>
      _session(await post('/auth/login', {'email': email, 'password': password}));

  Future<(String, User)> register(String name, String email, String password) async =>
      _session(await post('/auth/register', {'name': name, 'email': email, 'password': password}));

  (String, User) _session(dynamic r) {
    final m = Map<String, dynamic>.from(r as Map);
    return ('${m['token']}', User.fromJson(Map<String, dynamic>.from(m['user'] as Map)));
  }

  Future<(User, AccountState)> me() async {
    final m = Map<String, dynamic>.from(await get('/me') as Map);
    return (User.fromJson(Map<String, dynamic>.from(m['user'] as Map)), AccountState.fromJson(m));
  }

  Future<User> updateProfile(Map<String, dynamic> changes) async =>
      User.fromJson(Map<String, dynamic>.from((await patch('/me', changes) as Map)['user'] as Map));

  Future<User> uploadAvatar(Uint8List bytes, String mime) async => User.fromJson(Map<String, dynamic>.from(
      (await put('/me/avatar', {'dataUrl': 'data:$mime;base64,${base64Encode(bytes)}'}) as Map)['user'] as Map));

  Future<User> removeAvatar() async => User.fromJson(Map<String, dynamic>.from((await delete('/me/avatar') as Map)['user'] as Map));

  Future<void> logoutAll() => post('/me/logout-all');

  Future<List<OrderSummary>> orders() async =>
      (await get('/me/orders') as List).map((o) => OrderSummary.fromJson(Map<String, dynamic>.from(o as Map))).toList();

  // ---- Payments (Cashfree) ----

  /// Starts a checkout for a course ({courseId}) or a plan ({planId}). Returns orderId, paymentSessionId and mode.
  Future<Map<String, dynamic>> createOrder({String? courseId, String? planId, required String name, required String phone}) async =>
      Map<String, dynamic>.from(await post('/orders', {'courseId': ?courseId, 'planId': ?planId, 'name': name, 'phone': phone}) as Map);

  Future<OrderSummary> order(String orderId) async =>
      OrderSummary.fromJson(Map<String, dynamic>.from(await get('/orders/${Uri.encodeComponent(orderId)}') as Map));

  // ---- Speak with AI ----

  Future<Map<String, dynamic>> aiStatus() async => Map<String, dynamic>.from(await get('/ai/status') as Map);

  Future<Map<String, dynamic>> aiChat(List<ChatMessage> messages, String scenario) async => Map<String, dynamic>.from(
      await post('/ai/chat', {'messages': messages.map((m) => m.toJson()).toList(), 'scenario': scenario}) as Map);

  /// The tutor's line as MP3 in the ElevenLabs voice (only text the server signed).
  Future<Uint8List> aiSpeak(String text, String sig) async {
    final res = await _client.post(_uri('/ai/speak'),
        headers: _headers(json: true), body: jsonEncode({'text': text, 'sig': sig}));
    if (res.statusCode >= 400) _decode(res);
    return res.bodyBytes;
  }
}
