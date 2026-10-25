import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../nav.dart';
import '../services/api.dart';
import '../services/payments.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'account.dart';
import 'auth.dart';
import 'blog.dart';
import 'contact.dart';
import 'courses.dart';
import 'shell.dart';
import 'vocabulary.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final progress = context.watch<ProgressStore>();
    final site = context.watch<ContentStore>().data.site;
    final user = auth.user;

    return Scaffold(
      appBar: const BrandBar('Profile'),
      body: RefreshIndicator(
        onRefresh: auth.refresh,
        child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
            decoration: const BoxDecoration(color: AppColors.indigo, borderRadius: BorderRadius.vertical(bottom: Radius.circular(28))),
            child: user == null
                ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Learn with your account', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(inAppPurchases ? 'Log in to buy courses, talk with the AI tutor and use your website account on this phone.' : 'Log in to open your courses, talk with the AI tutor and use your website account on this phone.',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.9), height: 1.5)),
                    const SizedBox(height: 16),
                    AppButton('Create free account', onPressed: () => push(context, const AuthScreen(startWithRegister: true))),
                    const SizedBox(height: 10),
                    AppButton('Log in', kind: ButtonKind.glass, onPressed: () => push(context, const AuthScreen())),
                  ])
                : Row(children: [
                    GestureDetector(
                      onTap: () => _changePhoto(context),
                      child: Stack(children: [
                        CircleAvatar(
                          radius: 36,
                          backgroundColor: AppColors.yellow,
                          foregroundImage: user.avatarUrl != null ? NetworkImage(Api.absolute(user.avatarUrl!)) : null,
                          child: Text(user.avatarInitials, style: const TextStyle(color: AppColors.navy, fontSize: 24, fontWeight: FontWeight.w800)),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                            child: const Icon(Icons.photo_camera_rounded, size: 14, color: AppColors.indigo),
                          ),
                        ),
                      ]),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(user.name, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                        Text(user.email, style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
                        const SizedBox(height: 8),
                        _AccessPill(auth: auth),
                      ]),
                    ),
                  ]),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              _Stat(Icons.local_fire_department_rounded, '${progress.streak}', 'Day streak'),
              const SizedBox(width: 10),
              _Stat(Icons.task_alt_rounded, '${progress.completedLessons.length}', 'Lessons done'),
              const SizedBox(width: 10),
              _Stat(Icons.quiz_outlined, '${progress.quizScores.length}', 'Quizzes'),
            ]),
          ),
          if (auth.account != null) ...[
            const SizedBox(height: 16),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: _UsageCard(auth: auth)),
          ],
          const SizedBox(height: 20),
          _Group([
            if (user != null) ...[
              _Item(Icons.person_outline_rounded, 'Edit profile', () => push(context, const EditProfileScreen())),
              _Item(Icons.receipt_long_outlined, 'My orders', () => push(context, const OrdersScreen())),
            ],
            _Item(Icons.bookmark_border_rounded, 'Saved words (${progress.favoriteWords.length})', () => push(context, const VocabularyScreen(favoritesOnly: true))),
            if (inAppPurchases) _Item(Icons.workspace_premium_outlined, 'Plans and pricing', () => push(context, const PlansScreen())),
            _Item(Icons.menu_book_outlined, 'My courses', () => MainShell.of(context).select(3)),
          ]),
          const SizedBox(height: 14),
          _Group([
            _Item(Icons.article_outlined, 'Blog', () => push(context, const BlogScreen())),
            _Item(Icons.support_agent_rounded, 'Contact us', () => push(context, const ContactScreen())),
            if (site.whatsappLink.isNotEmpty)
              _Item(Icons.chat_outlined, 'Chat on WhatsApp',
                  () => openExternal('${site.whatsappLink}${site.whatsappMessage.isNotEmpty ? '?text=${Uri.encodeComponent(site.whatsappMessage)}' : ''}')),
            _Item(Icons.public_rounded, 'Open the website', () => openExternal(site.url)),
          ]),
          const SizedBox(height: 14),
          _Group([
            _Item(Icons.description_outlined, 'Terms and conditions', () => openExternal('${site.url}/terms')),
            _Item(Icons.currency_rupee_rounded, 'Refunds and cancellations', () => openExternal('${site.url}/refunds')),
            _Item(Icons.privacy_tip_outlined, 'Privacy policy', () => openExternal('${site.url}/privacy')),
            _Item(Icons.restart_alt_rounded, 'Reset progress on this phone', () => _confirmReset(context)),
          ]),
          if (user != null) ...[
            const SizedBox(height: 14),
            _Group([
              _Item(Icons.logout_rounded, 'Log out', () => auth.logout(), danger: true),
              _Item(Icons.devices_other_rounded, 'Log out of all devices', () => _logoutAll(context), danger: true),
            ]),
          ],
          const SizedBox(height: 20),
          // The build number is what Admin → Mobile app compares against.
          FutureBuilder<PackageInfo>(
            future: PackageInfo.fromPlatform(),
            builder: (_, snap) => Center(
              child: Text(snap.hasData ? '${site.name} · App ${snap.data!.version} (${snap.data!.buildNumber})' : site.name,
                  style: const TextStyle(fontSize: 12, color: AppColors.outline)),
            ),
          ),
        ]),
      ),
    );
  }

  Future<void> _changePhoto(BuildContext context) async {
    final auth = context.read<AuthStore>();
    final api = context.read<Api>();
    final remove = auth.user?.avatarUrl != null;
    final choice = await showModalBottomSheet<String>(
      useRootNavigator: true,
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from gallery'), onTap: () => Navigator.pop(ctx, 'gallery')),
          ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Take a photo'), onTap: () => Navigator.pop(ctx, 'camera')),
          if (remove)
            ListTile(leading: const Icon(Icons.delete_outline_rounded, color: AppColors.error), title: const Text('Remove photo'), onTap: () => Navigator.pop(ctx, 'remove')),
        ]),
      ),
    );
    if (choice == null || !context.mounted) return;
    try {
      if (choice == 'remove') {
        auth.setUser(await api.removeAvatar());
        return;
      }
      final file = await ImagePicker().pickImage(
          source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery, maxWidth: 512, maxHeight: 512, imageQuality: 80);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final mime = file.name.toLowerCase().endsWith('.png') ? 'image/png' : file.name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      auth.setUser(await api.uploadAvatar(bytes, mime));
      if (context.mounted) showSnack(context, 'Profile photo updated.');
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _confirmReset(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset progress?'),
        content: const Text('This clears finished lessons, quiz scores, saved words and your streak on this phone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Reset', style: TextStyle(color: AppColors.error))),
        ],
      ),
    );
    if (ok == true && context.mounted) await context.read<ProgressStore>().reset();
  }

  Future<void> _logoutAll(BuildContext context) async {
    final auth = context.read<AuthStore>();
    try {
      await context.read<Api>().logoutAll();
      await auth.logout();
      if (context.mounted) showSnack(context, 'Logged out on every device.');
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }
}

class _AccessPill extends StatelessWidget {
  const _AccessPill({required this.auth});
  final AuthStore auth;
  @override
  Widget build(BuildContext context) {
    final a = auth.account;
    final label = switch (a?.status) {
      'unlimited' => 'Unlimited access',
      'active' => a!.until != null ? 'Plan until ${_date(a.until!)}' : 'Plan active',
      'trial' => a!.trialEndsAt != null ? 'Free trial until ${_date(a.trialEndsAt!)}' : 'Free trial',
      'expired' => 'Trial ended',
      'blocked' => 'Blocked',
      _ => 'Learner',
    };
    if (a != null && a.purchasedCourseIds.isNotEmpty && (a.status == 'expired' || a.status == 'trial')) {
      return Pill('${a.purchasedCourseIds.length} course${a.purchasedCourseIds.length == 1 ? '' : 's'} owned', background: AppColors.yellow);
    }
    return Pill(label, background: AppColors.yellow);
  }
}

String _date(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${d.day} ${months[d.month - 1]} ${d.year}';
}

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.auth});
  final AuthStore auth;
  @override
  Widget build(BuildContext context) {
    final a = auth.account!;
    String allowance(int? remaining, int? limit, String period, String unit) {
      if (period == 'none') return 'Not included';
      if (limit == null) return 'Unlimited';
      return '${remaining ?? 0} of $limit $unit left${period == 'day' ? ' today' : ''}';
    }
    final ai = a.aiAllowance;
    final call = a.callAllowance;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Your plan', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 10),
        _UsageRow(Icons.record_voice_over_outlined, 'AI tutor', allowance(ai.remaining, ai.limit, ai.period, 'messages')),
        _UsageRow(Icons.call_outlined, 'Live calls',
            allowance(call.remaining == null ? null : call.remaining! ~/ 60, call.limit == null ? null : call.limit! ~/ 60, call.period, 'minutes')),
        _UsageRow(Icons.lock_open_rounded, 'Courses',
            a.full ? 'Every course' : a.tier == 'trial' ? 'First ${a.freeLessons ?? 0} lesson(s) of each course' : '${a.purchasedCourseIds.length} bought'),
      ]),
    );
  }
}

class _UsageRow extends StatelessWidget {
  const _UsageRow(this.icon, this.label, this.value);
  final IconData icon;
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Icon(icon, size: 18, color: AppColors.indigo),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(width: 12),
          Expanded(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(color: AppColors.outline, fontSize: 13))),
        ]),
      );
}

class _Stat extends StatelessWidget {
  const _Stat(this.icon, this.value, this.label);
  final IconData icon;
  final String value, label;
  @override
  Widget build(BuildContext context) => Expanded(
        child: AppCard(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          child: Column(children: [
            Icon(icon, color: AppColors.indigo),
            const SizedBox(height: 6),
            Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.outline)),
          ]),
        ),
      );
}

class _Item {
  const _Item(this.icon, this.label, this.onTap, {this.danger = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;
}

class _Group extends StatelessWidget {
  const _Group(this.items);
  final List<_Item> items;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) Divider(height: 1, indent: 56, color: AppColors.borderSky.withValues(alpha: 0.6)),
              ListTile(
                leading: Icon(items[i].icon, color: items[i].danger ? AppColors.error : AppColors.indigo),
                title: Text(items[i].label,
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5, color: items[i].danger ? AppColors.error : AppColors.navy)),
                trailing: items[i].danger ? null : const Icon(Icons.chevron_right_rounded, color: AppColors.outline),
                onTap: items[i].onTap,
              ),
            ],
          ]),
        ),
      );
}
