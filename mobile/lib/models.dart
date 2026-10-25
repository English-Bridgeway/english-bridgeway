// Shapes returned by GET /api/content and the account endpoints. They mirror
// src/types/index.ts in the website, so admin edits show up here unchanged.

List<T> _list<T>(dynamic v, T Function(Map<String, dynamic>) f) =>
    v is List ? v.whereType<Map>().map((e) => f(Map<String, dynamic>.from(e))).toList() : <T>[];
List<String> _strings(dynamic v) => v is List ? v.map((e) => '$e').toList() : (v is String ? [v] : <String>[]);
String _s(dynamic v, [String fallback = '']) => v == null ? fallback : '$v';
int _i(dynamic v, [int fallback = 0]) => v is num ? v.toInt() : int.tryParse('$v') ?? fallback;
double _d(dynamic v, [double fallback = 0]) => v is num ? v.toDouble() : double.tryParse('$v') ?? fallback;

class GrammarTopic {
  final String id, title, summary, level, icon;
  GrammarTopic(this.id, this.title, this.summary, this.level, this.icon);
  factory GrammarTopic.fromJson(Map<String, dynamic> j) =>
      GrammarTopic(_s(j['id']), _s(j['title']), _s(j['summary']), _s(j['level'], 'Beginner'), _s(j['icon']));
}

class LessonExample {
  final String sentence;
  final String? note;
  LessonExample(this.sentence, this.note);
  factory LessonExample.fromJson(Map<String, dynamic> j) => LessonExample(_s(j['sentence']), j['note'] as String?);
}

class LessonSection {
  final String heading;
  final String? body, structure;
  final List<LessonExample> examples;
  LessonSection(this.heading, this.body, this.structure, this.examples);
  factory LessonSection.fromJson(Map<String, dynamic> j) => LessonSection(
      _s(j['heading']), j['body'] as String?, j['structure'] as String?, _list(j['examples'], LessonExample.fromJson));
}

class CommonMistake {
  final String wrong, right, why;
  CommonMistake(this.wrong, this.right, this.why);
  factory CommonMistake.fromJson(Map<String, dynamic> j) => CommonMistake(_s(j['wrong']), _s(j['right']), _s(j['why']));
}

class QuizQuestion {
  final String id, type, prompt, explanation;
  final List<String> options;
  final List<String> answers;
  QuizQuestion(this.id, this.type, this.prompt, this.options, this.answers, this.explanation);
  factory QuizQuestion.fromJson(Map<String, dynamic> j) => QuizQuestion(_s(j['id']), _s(j['type'], 'mcq'), _s(j['prompt']),
      _strings(j['options']), _strings(j['answer']), _s(j['explanation']));

  bool get isMcq => type == 'mcq' && options.isNotEmpty;

  /// Same rule as the website (utils/quiz.ts): case, punctuation and extra spaces do not matter.
  bool isCorrect(String given) {
    String norm(String s) =>
        s.toLowerCase().replaceAll(RegExp('[’‘]'), "'").replaceAll(RegExp(r'[.!?,]'), '').replaceAll(RegExp(r'\s+'), ' ').trim();
    return answers.any((a) => norm(a) == norm(given));
  }
}

class GrammarLesson {
  final String id, topicId, title, level, description, definition;
  final int minutes;
  final List<String> rules;
  final List<LessonSection> sections;
  final List<CommonMistake> mistakes;
  final List<QuizQuestion> practice;
  GrammarLesson(this.id, this.topicId, this.title, this.level, this.minutes, this.description, this.definition, this.rules,
      this.sections, this.mistakes, this.practice);
  factory GrammarLesson.fromJson(Map<String, dynamic> j) => GrammarLesson(
      _s(j['id']),
      _s(j['topicId']),
      _s(j['title']),
      _s(j['level'], 'Beginner'),
      _i(j['minutes'], 10),
      _s(j['description']),
      _s(j['definition']),
      _strings(j['rules']),
      _list(j['sections'], LessonSection.fromJson),
      _list(j['mistakes'], CommonMistake.fromJson),
      _list(j['practice'], QuizQuestion.fromJson));

  String get key => '$topicId/$id';
}

class VocabularyWord {
  final String id, word, pronunciation, partOfSpeech, meaning, level, category;
  final List<String> examples, synonyms, antonyms, related;
  VocabularyWord(this.id, this.word, this.pronunciation, this.partOfSpeech, this.meaning, this.examples, this.synonyms,
      this.antonyms, this.related, this.level, this.category);
  factory VocabularyWord.fromJson(Map<String, dynamic> j) => VocabularyWord(
      _s(j['id']),
      _s(j['word']),
      _s(j['pronunciation']),
      _s(j['partOfSpeech']),
      _s(j['meaning']),
      _strings(j['examples']),
      _strings(j['synonyms']),
      _strings(j['antonyms']),
      _strings(j['related']),
      _s(j['level'], 'Beginner'),
      _s(j['category']));
}

class DialogueLine {
  final String speaker, name, text;
  DialogueLine(this.speaker, this.name, this.text);
  factory DialogueLine.fromJson(Map<String, dynamic> j) => DialogueLine(_s(j['speaker'], 'A'), _s(j['name']), _s(j['text']));
}

class Phrase {
  final String phrase, meaning;
  Phrase(this.phrase, this.meaning);
  factory Phrase.fromJson(Map<String, dynamic> j) => Phrase(_s(j['phrase']), _s(j['meaning']));
}

class SpokenLesson {
  final String id, category, title, situation, level;
  final int minutes;
  final List<DialogueLine> dialogue;
  final List<Phrase> phrases, vocabulary;
  final List<String> activity;
  SpokenLesson(this.id, this.category, this.title, this.situation, this.level, this.minutes, this.dialogue, this.phrases,
      this.vocabulary, this.activity);
  factory SpokenLesson.fromJson(Map<String, dynamic> j) => SpokenLesson(
      _s(j['id']),
      _s(j['category']),
      _s(j['title']),
      _s(j['situation']),
      _s(j['level'], 'Beginner'),
      _i(j['minutes'], 8),
      _list(j['dialogue'], DialogueLine.fromJson),
      _list(j['phrases'], Phrase.fromJson),
      _list(j['vocabulary'], Phrase.fromJson),
      _strings(j['activity']));
}

class QuizCategory {
  final String id, title, description, icon;
  QuizCategory(this.id, this.title, this.description, this.icon);
  factory QuizCategory.fromJson(Map<String, dynamic> j) =>
      QuizCategory(_s(j['id']), _s(j['title']), _s(j['description']), _s(j['icon']));
}

class Quiz {
  final String id, categoryId, title, level;
  final int minutes;
  final List<QuizQuestion> questions;
  Quiz(this.id, this.categoryId, this.title, this.level, this.minutes, this.questions);
  factory Quiz.fromJson(Map<String, dynamic> j) => Quiz(_s(j['id']), _s(j['categoryId']), _s(j['title']),
      _s(j['level'], 'Beginner'), _i(j['minutes'], 5), _list(j['questions'], QuizQuestion.fromJson));
}

class CurriculumLesson {
  final String title;
  final int minutes;
  final String? href;
  CurriculumLesson(this.title, this.minutes, this.href);
  factory CurriculumLesson.fromJson(Map<String, dynamic> j) =>
      CurriculumLesson(_s(j['title']), _i(j['minutes']), (j['href'] as String?)?.trim().isEmpty == true ? null : j['href'] as String?);
}

class CurriculumModule {
  final String title;
  final List<CurriculumLesson> lessons;
  CurriculumModule(this.title, this.lessons);
  factory CurriculumModule.fromJson(Map<String, dynamic> j) =>
      CurriculumModule(_s(j['title']), _list(j['lessons'], CurriculumLesson.fromJson));
}

class Course {
  final String id, title, description, level, duration, icon, instructorName, instructorTitle;
  final int lessons, students;
  final double price, rating;
  final List<String> outcomes;
  final List<CurriculumModule> curriculum;
  Course(this.id, this.title, this.description, this.level, this.duration, this.lessons, this.price, this.icon, this.rating,
      this.students, this.instructorName, this.instructorTitle, this.outcomes, this.curriculum);
  factory Course.fromJson(Map<String, dynamic> j) {
    final instructor = j['instructor'] is Map ? Map<String, dynamic>.from(j['instructor']) : const <String, dynamic>{};
    return Course(
        _s(j['id']),
        _s(j['title']),
        _s(j['description']),
        _s(j['level'], 'Beginner'),
        _s(j['duration']),
        _i(j['lessons']),
        _d(j['price']),
        _s(j['icon']),
        _d(j['rating']),
        _i(j['students']),
        _s(instructor['name']),
        _s(instructor['title']),
        _strings(j['outcomes']),
        _list(j['curriculum'], CurriculumModule.fromJson));
  }

  bool get isPaid => price > 0;

  /// Curriculum lessons in order, numbered across modules (the trial opens the first few).
  List<CurriculumLesson> get allLessons => [for (final m in curriculum) ...m.lessons];
}

class BlogBlock {
  final String type;
  final String text;
  final List<String> items;
  final List<MapEntry<String, String>> pairs;
  BlogBlock(this.type, this.text, this.items, this.pairs);
  factory BlogBlock.fromJson(Map<String, dynamic> j) {
    final raw = j['items'];
    final pairs = <MapEntry<String, String>>[];
    final items = <String>[];
    if (raw is List) {
      for (final it in raw) {
        if (it is Map) {
          pairs.add(MapEntry(_s(it['term']), _s(it['detail'])));
        } else {
          items.add('$it');
        }
      }
    }
    return BlogBlock(_s(j['type'], 'p'), _s(j['text']), items, pairs);
  }
}

class BlogPost {
  final String slug, title, excerpt, category, author, date, icon;
  final int readingMinutes;
  final List<BlogBlock> content;
  BlogPost(this.slug, this.title, this.excerpt, this.category, this.author, this.date, this.readingMinutes, this.icon,
      this.content);
  factory BlogPost.fromJson(Map<String, dynamic> j) => BlogPost(
      _s(j['slug']),
      _s(j['title']),
      _s(j['excerpt']),
      _s(j['category']),
      _s(j['author']),
      _s(j['date']),
      _i(j['readingMinutes'], 5),
      j['cover'] is Map ? _s(j['cover']['icon']) : '',
      _list(j['content'], BlogBlock.fromJson));
}

class SubscriptionPlan {
  final String id, name, description;
  final double price;
  final int months;
  final bool highlight;
  SubscriptionPlan(this.id, this.name, this.description, this.price, this.months, this.highlight);
  factory SubscriptionPlan.fromJson(Map<String, dynamic> j) => SubscriptionPlan(_s(j['id']), _s(j['name']),
      _s(j['description']), _d(j['price']), _i(j['months'], 1), j['highlight'] == true);
}

class SiteStat {
  final String label, value, icon;
  SiteStat(this.label, this.value, this.icon);
  factory SiteStat.fromJson(Map<String, dynamic> j) => SiteStat(_s(j['label']), _s(j['value']), _s(j['icon']));
}

class SiteSettings {
  final String name, tagline, description, url, email, whatsapp, whatsappLink, whatsappMessage, location, hours;
  final List<SiteStat> stats;
  final double voicePitch, voiceRate;
  SiteSettings(this.name, this.tagline, this.description, this.url, this.email, this.whatsapp, this.whatsappLink,
      this.whatsappMessage, this.location, this.hours, this.stats, this.voicePitch, this.voiceRate);
  factory SiteSettings.fromJson(Map<String, dynamic> j) {
    final voice = j['voice'] is Map ? Map<String, dynamic>.from(j['voice']) : const <String, dynamic>{};
    return SiteSettings(
        _s(j['name'], 'English-Bridgeway'),
        _s(j['tagline']),
        _s(j['description']),
        _s(j['url'], 'https://englishbridgeway.com'),
        _s(j['email']),
        _s(j['whatsapp']),
        _s(j['whatsappLink']),
        _s(j['whatsappMessage']),
        _s(j['location']),
        _s(j['hours']),
        _list(j['stats'], SiteStat.fromJson),
        _d(voice['pitch'], 1.1),
        _d(voice['rate'], 0.9));
  }
}

/// Everything from GET /api/content.
class ContentBundle {
  final SiteSettings site;
  final List<SubscriptionPlan> plans;
  final List<GrammarTopic> grammarTopics;
  final List<GrammarLesson> grammarLessons;
  final List<VocabularyWord> vocabularyWords;
  final List<SpokenLesson> spokenLessons;
  final List<QuizCategory> quizCategories;
  final List<Quiz> quizzes;
  final List<Course> courses;
  final List<BlogPost> blogPosts;

  ContentBundle(this.site, this.plans, this.grammarTopics, this.grammarLessons, this.vocabularyWords, this.spokenLessons,
      this.quizCategories, this.quizzes, this.courses, this.blogPosts);

  factory ContentBundle.fromJson(Map<String, dynamic> j, {SiteSettings? fallbackSite}) {
    final c = j['collections'] is Map ? Map<String, dynamic>.from(j['collections']) : const <String, dynamic>{};
    return ContentBundle(
      j['site'] is Map ? SiteSettings.fromJson(Map<String, dynamic>.from(j['site'])) : fallbackSite ?? SiteSettings.fromJson({}),
      _list(j['plans'], SubscriptionPlan.fromJson),
      _list(c['grammarTopics'], GrammarTopic.fromJson),
      _list(c['grammarLessons'], GrammarLesson.fromJson),
      _list(c['vocabularyWords'], VocabularyWord.fromJson),
      _list(c['spokenLessons'], SpokenLesson.fromJson),
      _list(c['quizCategories'], QuizCategory.fromJson),
      _list(c['quizzes'], Quiz.fromJson),
      _list(c['courses'], Course.fromJson),
      _list(c['blogPosts'], BlogPost.fromJson),
    );
  }

  GrammarTopic? topic(String id) => grammarTopics.where((t) => t.id == id).firstOrNull;
  List<GrammarLesson> lessonsFor(String topicId) => grammarLessons.where((l) => l.topicId == topicId).toList();
  GrammarLesson? lesson(String topicId, String id) =>
      grammarLessons.where((l) => l.topicId == topicId && l.id == id).firstOrNull;
  VocabularyWord? word(String id) => vocabularyWords.where((w) => w.id == id).firstOrNull;
  SpokenLesson? spoken(String id) => spokenLessons.where((s) => s.id == id).firstOrNull;
  Quiz? quiz(String id) => quizzes.where((q) => q.id == id).firstOrNull;
  Course? course(String id) => courses.where((c) => c.id == id).firstOrNull;
  BlogPost? post(String slug) => blogPosts.where((p) => p.slug == slug).firstOrNull;
}

// ---- Accounts ----

class User {
  final String id, name, email, avatarInitials;
  final String? phone, avatarUrl, createdAt;
  final Map<String, dynamic> profile;
  User(this.id, this.name, this.email, this.phone, this.avatarInitials, this.avatarUrl, this.profile, this.createdAt);
  factory User.fromJson(Map<String, dynamic> j) => User(
      _s(j['id']),
      _s(j['name']),
      _s(j['email']),
      j['phone'] as String?,
      _s(j['avatarInitials'], 'ST'),
      j['avatarUrl'] as String?,
      j['profile'] is Map ? Map<String, dynamic>.from(j['profile']) : {},
      j['createdAt'] as String?);
  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'avatarInitials': avatarInitials,
        'avatarUrl': avatarUrl,
        'profile': profile,
        'createdAt': createdAt,
      };
}

class Allowance {
  final String period;
  final int used;
  final int? limit, remaining;
  Allowance(this.period, this.used, this.limit, this.remaining);
  factory Allowance.fromJson(dynamic v) {
    final j = v is Map ? Map<String, dynamic>.from(v) : const <String, dynamic>{};
    return Allowance(_s(j['period'], 'none'), _i(j['used']), j['limit'] == null ? null : _i(j['limit']),
        j['remaining'] == null ? null : _i(j['remaining']));
  }
}

class AccountState {
  final List<String> purchasedCourseIds;
  final String status; // unlimited | active | trial | expired | blocked
  final bool full, ai;
  final String? until, trialEndsAt;
  final String tier; // paid | trial | none
  final int? freeLessons;
  final Allowance aiAllowance, callAllowance;
  final Map<String, dynamic>? offer;
  AccountState(this.purchasedCourseIds, this.status, this.full, this.ai, this.until, this.trialEndsAt, this.tier,
      this.freeLessons, this.aiAllowance, this.callAllowance, this.offer);
  factory AccountState.fromJson(Map<String, dynamic> j) {
    final access = j['access'] is Map ? Map<String, dynamic>.from(j['access']) : const <String, dynamic>{};
    final usage = j['usage'] is Map ? Map<String, dynamic>.from(j['usage']) : const <String, dynamic>{};
    return AccountState(
      _strings(j['purchasedCourseIds']),
      _s(access['status'], 'trial'),
      access['full'] == true,
      access['ai'] == true,
      access['until'] as String?,
      access['trialEndsAt'] as String?,
      _s(usage['tier'], 'none'),
      usage['freeLessons'] == null ? null : _i(usage['freeLessons']),
      Allowance.fromJson(usage['ai']),
      Allowance.fromJson(usage['call']),
      j['offer'] is Map ? Map<String, dynamic>.from(j['offer']) : null,
    );
  }
}

class OrderSummary {
  final String orderId, kind, courseTitle, status;
  final String? courseId, createdAt;
  final double amount;
  final int? planMonths;
  OrderSummary(this.orderId, this.kind, this.courseId, this.courseTitle, this.planMonths, this.amount, this.status, this.createdAt);
  factory OrderSummary.fromJson(Map<String, dynamic> j) => OrderSummary(_s(j['orderId']), _s(j['kind'], 'course'),
      j['courseId'] as String?, _s(j['courseTitle']), j['planMonths'] == null ? null : _i(j['planMonths']), _d(j['amount']),
      _s(j['status']), j['createdAt'] as String?);
}

class ChatMessage {
  final String role; // user | assistant
  final String content;
  final String? speechSig;

  /// The tutor's reply in parts, spoken one after another: explain (in Marathi), say (the English
  /// to repeat), next (the conversation goes on). Older servers send one text; see [ChatMessage.tutor].
  final List<TutorPart> parts;

  /// The learner's wrong words and the right ones, to highlight.
  final ({String wrong, String right})? mistake;
  final String? correction;

  ChatMessage(this.role, this.content, [this.speechSig, this.parts = const [], this.mistake, this.correction]);

  /// A reply from POST /api/ai/chat (or an opener, with [opener]).
  factory ChatMessage.tutor(Map<String, dynamic> r, {bool opener = false}) {
    final content = '${r['reply'] ?? ''}';
    final sig = r['speechSig'] as String?;
    final raw = r['parts'];
    if (raw is List && raw.isNotEmpty) {
      final m = r['mistake'];
      return ChatMessage(
        'assistant',
        content,
        sig,
        [
          for (final p in raw.whereType<Map>())
            if ('${p['text'] ?? ''}'.trim().isNotEmpty) TutorPart('${p['kind'] ?? 'next'}', '${p['text']}'.trim(), p['sig'] as String?),
        ],
        m is Map && '${m['wrong'] ?? ''}'.isNotEmpty ? (wrong: '${m['wrong']}', right: '${m['right']}') : null,
        r['correction'] as String?,
      );
    }
    // One text with an optional "Correction:" line (openers, older servers).
    final (said, correction) = opener ? (content.trim(), null) : splitCorrection(content);
    return ChatMessage('assistant', content, sig, [TutorPart('next', said, sig)], null, correction);
  }

  Map<String, dynamic> toJson() => {'role': role, 'content': content};
}

class TutorPart {
  final String kind; // explain | say | next
  final String text;
  final String? sig;
  const TutorPart(this.kind, this.text, this.sig);
}

/// The tutor's reply without its "Correction:" line, and that line. Mirrors spokenPart() on the server.
(String, String?) splitCorrection(String reply) {
  final lines = reply.split(RegExp(r'\n+')).map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
  final i = lines.indexWhere((l) => RegExp(r'^correction\s*:', caseSensitive: false).hasMatch(l));
  if (i < 0) return (reply.trim(), null);
  final correction = lines[i].replaceFirst(RegExp(r'^correction\s*:\s*', caseSensitive: false), '');
  return ([for (var j = 0; j < lines.length; j++) if (j != i) lines[j]].join(' ').trim(), correction);
}

/// An e-book (PDF) from GET /api/ebooks. `unlocked` is the server's answer for this learner.
class Ebook {
  final String id, title, author, description;
  final String? courseTitle, coverUrl, lockedReason;
  final int? fileSize;
  final bool unlocked;
  Ebook(this.id, this.title, this.author, this.description, this.courseTitle, this.coverUrl, this.fileSize, this.unlocked, this.lockedReason);
  factory Ebook.fromJson(Map<String, dynamic> j) => Ebook(_s(j['id']), _s(j['title']), _s(j['author']), _s(j['description']),
      j['courseTitle'] as String?, j['coverUrl'] as String?, j['fileSize'] == null ? null : _i(j['fileSize']), j['unlocked'] == true,
      j['lockedReason'] as String?);

  String get sizeLabel {
    final b = fileSize ?? 0;
    if (b <= 0) return 'PDF';
    return b >= 1024 * 1024 ? 'PDF · ${(b / (1024 * 1024)).toStringAsFixed(1)} MB' : 'PDF · ${(b / 1024).ceil()} KB';
  }
}
