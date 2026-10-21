import 'package:flutter/material.dart';

import '../services/speech.dart';
import '../theme.dart';

/// Content items name lucide icons (as on the website); these are their Material look-alikes.
const _icons = <String, IconData>{
  'AlertTriangle': Icons.warning_amber_rounded,
  'AlignLeft': Icons.segment_rounded,
  'BookOpen': Icons.auto_stories_outlined,
  'BookOpenCheck': Icons.menu_book_rounded,
  'Box': Icons.category_outlined,
  'Brain': Icons.psychology_outlined,
  'Clock': Icons.history_edu_rounded,
  'Gauge': Icons.speed_rounded,
  'GraduationCap': Icons.school_outlined,
  'Languages': Icons.translate_rounded,
  'Library': Icons.local_library_outlined,
  'Link': Icons.linear_scale_rounded,
  'ListChecks': Icons.checklist_rtl_rounded,
  'MapPin': Icons.explore_outlined,
  'MessageSquareQuote': Icons.format_quote_rounded,
  'MessagesSquare': Icons.forum_outlined,
  'Mic': Icons.mic_none_rounded,
  'Palette': Icons.palette_outlined,
  'Repeat': Icons.swap_horiz_rounded,
  'Sparkles': Icons.auto_awesome_outlined,
  'Sprout': Icons.eco_outlined,
  'Type': Icons.article_outlined,
  'User': Icons.groups_outlined,
  'Video': Icons.videocam_outlined,
  'Zap': Icons.bolt_rounded,
};

IconData appIcon(String name) => _icons[name] ?? Icons.auto_stories_outlined;

/// Rounded square icon tile used on lesson rows and topic cards.
class IconTile extends StatelessWidget {
  const IconTile(this.icon, {super.key, this.size = 44, this.color = AppColors.indigo, this.background = AppColors.sky});
  final IconData icon;
  final double size;
  final Color color, background;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(size * 0.28)),
        child: Icon(icon, color: color, size: size * 0.5),
      );
}

/// White card with the Level 1 shadow and the sky border.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(16), this.color = Colors.white, this.radius = AppRadius.card});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color color;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: AppColors.borderSky.withValues(alpha: 0.5)),
          boxShadow: cardShadow,
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(radius),
          clipBehavior: Clip.antiAlias,
          child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
        ),
      );
}

/// Beginner / Intermediate / Advanced pill.
class LevelChip extends StatelessWidget {
  const LevelChip(this.level, {super.key});
  final String level;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (level) {
      'Intermediate' => (AppColors.amberSoft, AppColors.amberText),
      'Advanced' => (AppColors.navy, Colors.white),
      _ => (AppColors.sky, AppColors.navy),
    };
    return Pill(level, background: bg, foreground: fg, border: level == 'Beginner' ? AppColors.borderSky : null);
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.background = AppColors.sky, this.foreground = AppColors.navy, this.border, this.icon});
  final String text;
  final Color background, foreground;
  final Color? border;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(99),
          border: border != null ? Border.all(color: border!) : null,
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 13, color: foreground), const SizedBox(width: 4)],
          Text(text, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: foreground, letterSpacing: 0.2)),
        ]),
      );
}

enum ButtonKind { yellow, indigo, ghost, glass }

/// Pill-shaped buttons from the design system.
class AppButton extends StatelessWidget {
  const AppButton(this.label,
      {super.key, this.onPressed, this.kind = ButtonKind.yellow, this.icon, this.expand = true, this.busy = false, this.small = false, this.leading});
  final String label;
  final VoidCallback? onPressed;
  final ButtonKind kind;
  final IconData? icon, leading;
  final bool expand, busy, small;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (kind) {
      ButtonKind.yellow => (AppColors.yellow, AppColors.navy, null),
      ButtonKind.indigo => (AppColors.indigo, Colors.white, null),
      ButtonKind.ghost => (Colors.transparent, AppColors.navy, AppColors.borderSky),
      ButtonKind.glass => (Colors.white.withValues(alpha: 0.15), Colors.white, Colors.white.withValues(alpha: 0.2)),
    };
    final child = Row(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
      if (busy)
        SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
      else ...[
        if (leading != null) ...[Icon(leading, size: small ? 16 : 18), const SizedBox(width: 8)],
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
        if (icon != null) ...[const SizedBox(width: 8), Icon(icon, size: small ? 16 : 18)],
      ],
    ]);
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: bg,
        foregroundColor: fg,
        disabledBackgroundColor: bg.withValues(alpha: kind == ButtonKind.ghost ? 0 : 0.6),
        disabledForegroundColor: fg.withValues(alpha: 0.7),
        elevation: kind == ButtonKind.yellow ? 2 : 0,
        shadowColor: AppColors.navy.withValues(alpha: 0.3),
        padding: EdgeInsets.symmetric(horizontal: small ? 16 : 24, vertical: small ? 8 : 15),
        minimumSize: Size(0, small ? 34 : 50),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(small ? 99 : 14),
          side: border != null ? BorderSide(color: border, width: 1.5) : BorderSide.none,
        ),
        textStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: small ? 13 : 15.5),
      ),
      child: child,
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.subtitle, this.action, this.onAction});
  final String title;
  final String? subtitle, action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: AppColors.navy)),
              if (subtitle != null)
                Text(subtitle!, style: const TextStyle(fontSize: 12.5, color: AppColors.outline, fontWeight: FontWeight.w500)),
            ]),
          ),
          if (action != null)
            InkWell(
              onTap: onAction,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Row(children: [
                  Text(action!, style: const TextStyle(fontSize: 13, color: AppColors.indigo, fontWeight: FontWeight.w600)),
                  if (onAction != null) const Icon(Icons.arrow_forward_rounded, size: 15, color: AppColors.indigo),
                ]),
              ),
            ),
        ]),
      );
}

/// Speaker button that reads text aloud; shows a stop icon while speaking.
class ListenButton extends StatelessWidget {
  const ListenButton(this.text, {super.key, this.size = 36, this.onIndigo = false});
  final String text;
  final double size;
  final bool onIndigo;
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<String?>(
        valueListenable: Speech.instance.speaking,
        builder: (context, now, _) {
          final active = now == text;
          return Material(
            color: onIndigo ? AppColors.yellow : AppColors.sky,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => Speech.instance.say(text),
              child: SizedBox(
                width: size,
                height: size,
                child: Icon(active ? Icons.stop_rounded : Icons.volume_up_rounded,
                    size: size * 0.5, color: onIndigo ? AppColors.navy : AppColors.indigo),
              ),
            ),
          );
        },
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.message, this.action, this.onAction});
  final IconData icon;
  final String title, message;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(children: [
          IconTile(icon, size: 64),
          const SizedBox(height: 14),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.outline, height: 1.5)),
          if (action != null) ...[
            const SizedBox(height: 16),
            AppButton(action!, onPressed: onAction, kind: ButtonKind.ghost, expand: false, small: true),
          ],
        ]),
      );
}

/// Indigo header block with rounded bottom corners, as on the Grammar design.
class IndigoHeader extends StatelessWidget {
  const IndigoHeader({super.key, required this.title, this.subtitle, this.child, this.bottomPadding = 28});
  final String title;
  final String? subtitle;
  final Widget? child;
  final double bottomPadding;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(16, 18, 16, bottomPadding),
        decoration: const BoxDecoration(
          color: AppColors.indigo,
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(subtitle!, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 14, height: 1.45)),
          ],
          if (child != null) ...[const SizedBox(height: 16), child!],
        ]),
      );
}

/// Search field styled like the design (white, rounded, indigo icon).
class SearchField extends StatelessWidget {
  const SearchField({super.key, required this.hint, required this.onChanged, this.controller});
  final String hint;
  final ValueChanged<String> onChanged;
  final TextEditingController? controller;
  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.indigo),
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        ),
      );
}

/// Horizontal level filter chips (All levels / Beginner / Intermediate / Advanced).
class LevelFilter extends StatelessWidget {
  const LevelFilter({super.key, required this.value, required this.onChanged, this.options = const ['All levels', 'Beginner', 'Intermediate', 'Advanced']});
  final String value;
  final ValueChanged<String> onChanged;
  final List<String> options;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 38,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: options.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final o = options[i];
            final selected = o == value;
            return ChoiceChip(
              label: Text(o),
              selected: selected,
              showCheckmark: false,
              onSelected: (_) => onChanged(o),
              selectedColor: AppColors.indigo,
              backgroundColor: Colors.white,
              labelStyle: TextStyle(color: selected ? Colors.white : AppColors.navy, fontWeight: FontWeight.w600, fontSize: 13),
              side: BorderSide(color: selected ? AppColors.indigo : AppColors.borderSky),
              shape: const StadiumBorder(),
            );
          },
        ),
      );
}

/// Linear progress bar in indigo on a light track.
class ProgressLine extends StatelessWidget {
  const ProgressLine(this.value, {super.key, this.height = 8, this.color = AppColors.indigo, this.track = const Color(0xFFE2E8F0)});
  final double value;
  final double height;
  final Color color, track;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: height, color: color, backgroundColor: track),
      );
}

String formatPrice(double rupees) {
  final whole = rupees.round().toString();
  final buf = StringBuffer();
  // Indian grouping: 1,23,456
  if (whole.length <= 3) {
    buf.write(whole);
  } else {
    final last3 = whole.substring(whole.length - 3);
    var rest = whole.substring(0, whole.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    buf.write('${parts.join(',')},$last3');
  }
  return '₹$buf';
}

void showSnack(BuildContext context, String message) =>
    ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(content: Text(message)));
