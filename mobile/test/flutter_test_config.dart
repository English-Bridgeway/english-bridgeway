import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';

/// Loads Roboto and the Material icons from the Flutter SDK, so layouts are measured with a real
/// font instead of the square test font (which overflows rows that fit on a phone).
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root != null) {
    final dir = '$root/bin/cache/artifacts/material_fonts';
    Future<void> load(String family, List<String> files) async {
      final loader = FontLoader(family);
      for (final f in files) {
        final file = File('$dir/$f');
        if (file.existsSync()) loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
      }
      await loader.load();
    }
    await load('Roboto', ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf', 'Roboto-Black.ttf']);
    await load('MaterialIcons', ['MaterialIcons-Regular.otf']);
  }
  await testMain();
}
