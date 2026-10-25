import 'dart:convert';
import 'dart:io';

import 'package:english_bridgeway/models.dart';
import 'package:english_bridgeway/widgets/common.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses the seed content the server ships', () {
    final json = jsonDecode(File('assets/content.json').readAsStringSync()) as Map<String, dynamic>;
    final bundle = ContentBundle.fromJson(json);
    expect(bundle.grammarTopics, isNotEmpty);
    expect(bundle.grammarLessons.first.sections, isNotEmpty);
    expect(bundle.vocabularyWords.first.examples, isNotEmpty);
    expect(bundle.spokenLessons.first.dialogue, isNotEmpty);
    expect(bundle.quizzes.first.questions, isNotEmpty);
    expect(bundle.courses.first.allLessons, isNotEmpty);
    expect(bundle.blogPosts.first.content, isNotEmpty);
    expect(bundle.site.stats, hasLength(4));
    for (final l in bundle.grammarLessons) {
      expect(bundle.topic(l.topicId), isNotNull, reason: 'lesson ${l.id} has a topic');
    }
  });

  test('quiz answers ignore case, punctuation and spacing like the website', () {
    final q = QuizQuestion('q', 'fill', 'I ___ a student.', const [], const ['am', "I'm"], '');
    expect(q.isCorrect(' AM. '), isTrue);
    expect(q.isCorrect('I’m'), isTrue);
    expect(q.isCorrect('is'), isFalse);
  });

  test('splits the tutor correction from what is spoken', () {
    final (said, correction) = splitCorrection('Great answer!\nCorrection: I go to school.\nWhat do you study?');
    expect(said, 'Great answer! What do you study?');
    expect(correction, 'I go to school.');
    expect(splitCorrection('Hello there').$2, isNull);
  });

  test('formats rupees with Indian grouping', () {
    expect(formatPrice(499), '₹499');
    expect(formatPrice(12499), '₹12,499');
    expect(formatPrice(1234567), '₹12,34,567');
  });
}
