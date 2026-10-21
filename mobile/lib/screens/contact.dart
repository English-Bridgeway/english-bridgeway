import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav.dart';
import '../services/api.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Sends a message to Admin → Messages (POST /api/messages).
class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});
  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  late final _name = TextEditingController(text: context.read<AuthStore>().user?.name ?? '');
  late final _email = TextEditingController(text: context.read<AuthStore>().user?.email ?? '');
  late final _phone = TextEditingController(text: context.read<AuthStore>().user?.phone ?? '');
  final _subject = TextEditingController();
  final _message = TextEditingController();
  bool _busy = false, _sent = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _subject, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (_name.text.trim().isEmpty ||
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(_email.text.trim()) ||
        _subject.text.trim().isEmpty ||
        _message.text.trim().length < 10) {
      setState(() => _error = 'Please fill in your name, a valid email, a subject and a message (at least 10 characters).');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Api>().sendMessage(
          name: _name.text.trim(),
          email: _email.text.trim(),
          subject: _subject.text.trim(),
          message: _message.text.trim(),
          phone: _phone.text.trim().isEmpty ? null : _phone.text.trim());
      setState(() => _sent = true);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final site = context.watch<ContentStore>().data.site;
    return Scaffold(
      appBar: AppBar(title: const Text('Contact us')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Get in touch', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 10),
            if (site.email.isNotEmpty) _Line(Icons.mail_outline_rounded, site.email, () => openExternal('mailto:${site.email}')),
            if (site.whatsapp.isNotEmpty) _Line(Icons.chat_outlined, site.whatsapp, site.whatsappLink.isEmpty ? null : () => openExternal(site.whatsappLink)),
            if (site.location.isNotEmpty) _Line(Icons.place_outlined, site.location, null),
            if (site.hours.isNotEmpty) _Line(Icons.schedule_rounded, site.hours, null),
          ]),
        ),
        const SizedBox(height: 16),
        if (_sent)
          const EmptyState(icon: Icons.mark_email_read_outlined, title: 'Message sent', message: 'Thank you! We usually reply within one working day.')
        else ...[
          TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Name')),
          const SizedBox(height: 12),
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
          const SizedBox(height: 12),
          TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone (optional)')),
          const SizedBox(height: 12),
          TextField(controller: _subject, decoration: const InputDecoration(labelText: 'Subject')),
          const SizedBox(height: 12),
          TextField(controller: _message, maxLines: 5, decoration: const InputDecoration(labelText: 'Message', alignLabelWithHint: true)),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 18),
          AppButton('Send message', icon: Icons.send_rounded, busy: _busy, onPressed: _send),
        ],
      ]),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.icon, this.text, this.onTap);
  final IconData icon;
  final String text;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Icon(icon, size: 18, color: AppColors.indigo),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: TextStyle(fontWeight: onTap != null ? FontWeight.w600 : FontWeight.w400))),
          ]),
        ),
      );
}
