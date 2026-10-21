import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Colours from the "Luminous Clarity" design system (Stitch export, DESIGN.md).
class AppColors {
  static const canvas = Color(0xFFF7F9FF);
  static const card = Color(0xFFFFFFFF);
  static const sky = Color(0xFFE6F4FF);
  static const borderSky = Color(0xFFBFE3F7);
  static const navy = Color(0xFF1A2B7B);
  static const yellow = Color(0xFFFFD93D);
  static const indigo = Color(0xFF4F5DF5);
  static const primary = Color(0xFF3341DC);
  static const outline = Color(0xFF757687);
  static const outlineVariant = Color(0xFFC6C5D8);
  static const onSurfaceVariant = Color(0xFF454655);
  static const amberSoft = Color(0xFFFFF4CC);
  static const amberText = Color(0xFF8A6D00);
  static const success = Color(0xFF1E9E61);
  static const successSoft = Color(0xFFE3F7EC);
  static const error = Color(0xFFBA1A1A);
  static const errorSoft = Color(0xFFFFDAD6);
}

class AppRadius {
  static const card = 20.0;
  static const input = 12.0;
}

/// Level 1 ambient shadow (cards, lesson rows).
const cardShadow = [
  BoxShadow(color: Color(0x0D1A2B7B), blurRadius: 20, offset: Offset(0, 4), spreadRadius: -2),
  BoxShadow(color: Color(0x0A4F5DF5), blurRadius: 6, offset: Offset(0, 2), spreadRadius: -1),
];

/// Level 3 shadow (floating cards, bottom navigation).
const floatingShadow = [
  BoxShadow(color: Color(0x1F1A2B7B), blurRadius: 48, offset: Offset(0, 24), spreadRadius: -8),
  BoxShadow(color: Color(0x144F5DF5), blurRadius: 16, offset: Offset(0, 8), spreadRadius: -4),
];

/// [googleFonts] off uses the default font (widget tests have no network).
ThemeData buildTheme({bool googleFonts = true}) {
  final base = ThemeData(
    useMaterial3: true,
    // Also covers buttons and chips, whose text styles don't inherit from the text theme.
    fontFamily: googleFonts ? GoogleFonts.plusJakartaSans().fontFamily : null,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.indigo,
      primary: AppColors.indigo,
      secondary: AppColors.yellow,
      surface: AppColors.canvas,
      onSurface: AppColors.navy,
      error: AppColors.error,
    ),
    scaffoldBackgroundColor: AppColors.canvas,
  );
  final text = (googleFonts ? GoogleFonts.plusJakartaSansTextTheme(base.textTheme) : base.textTheme).apply(
    bodyColor: AppColors.navy,
    displayColor: AppColors.navy,
  );
  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      foregroundColor: AppColors.navy,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: true,
      titleTextStyle: text.titleLarge?.copyWith(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.navy),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      hintStyle: TextStyle(color: AppColors.navy.withValues(alpha: 0.45)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.input),
        borderSide: const BorderSide(color: AppColors.borderSky, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.input),
        borderSide: const BorderSide(color: AppColors.borderSky, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.input),
        borderSide: const BorderSide(color: AppColors.indigo, width: 2),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: AppColors.navy),
    dividerColor: AppColors.borderSky,
  );
}
