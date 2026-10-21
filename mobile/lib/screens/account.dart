import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/api.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  static const _fields = [
    ('whatsapp', 'WhatsApp number', TextInputType.phone),
    ('city', 'City', TextInputType.text),
    ('state', 'State', TextInputType.text),
    ('country', 'Country', TextInputType.text),
    ('occupation', 'Occupation', TextInputType.text),
    ('goal', 'Why are you learning English?', TextInputType.text),
    ('about', 'About you', TextInputType.multiline),
  ];
  static const _levels = ['', 'Beginner', 'Intermediate', 'Advanced'];

  late final User _user = context.read<AuthStore>().user!;
  late final _name = TextEditingController(text: _user.name);
  late final _phone = TextEditingController(text: _user.phone ?? '');
  late final _controllers = {for (final f in _fields) f.$1: TextEditingController(text: '${_user.profile[f.$1] ?? ''}')};
  late String _level = _levels.contains(_user.profile['englishLevel']) ? '${_user.profile['englishLevel']}' : '';
  bool _busy = false;
  String? _error;
  final _fieldErrors = <String, String>{};

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
      _fieldErrors.clear();
    });
    final auth = context.read<AuthStore>();
    try {
      final user = await context.read<Api>().updateProfile({
        'name': _name.text,
        'phone': _phone.text,
        'profile': {for (final e in _controllers.entries) e.key: e.value.text, 'englishLevel': _level},
      });
      auth.setUser(user);
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, 'Profile saved.');
    } on ApiError catch (e) {
      setState(() {
        _busy = false;
        if (e.field != null) {
          _fieldErrors[e.field!] = e.message;
        } else {
          _error = e.message;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: 'Name', errorText: _fieldErrors['name'])),
        const SizedBox(height: 12),
        TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: 'Mobile number', errorText: _fieldErrors['phone'])),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _level,
          decoration: const InputDecoration(labelText: 'Your English level'),
          items: [for (final l in _levels) DropdownMenuItem(value: l, child: Text(l.isEmpty ? 'Not set' : l))],
          onChanged: (v) => setState(() => _level = v ?? ''),
        ),
        for (final f in _fields) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _controllers[f.$1],
            keyboardType: f.$3,
            maxLines: f.$3 == TextInputType.multiline ? 4 : 1,
            decoration: InputDecoration(labelText: f.$2),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
        ],
        const SizedBox(height: 20),
        AppButton('Save', busy: _busy, onPressed: _save),
      ]),
    );
  }
}

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<OrderSummary>> _orders = context.read<Api>().orders();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: RefreshIndicator(
        onRefresh: () async {
          setState(() => _orders = context.read<Api>().orders());
          await _orders;
        },
        child: FutureBuilder<List<OrderSummary>>(
          future: _orders,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
            if (snap.hasError) {
              return ListView(children: [EmptyState(icon: Icons.wifi_off_rounded, title: 'Could not load orders', message: '${snap.error}')]);
            }
            final orders = snap.data!;
            if (orders.isEmpty) {
              return ListView(children: const [
                EmptyState(icon: Icons.receipt_long_outlined, title: 'No orders yet', message: 'Courses and plans you buy will show up here.'),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final o = orders[i];
                final (bg, fg) = switch (o.status) {
                  'paid' => (AppColors.successSoft, AppColors.success),
                  'pending' => (AppColors.amberSoft, AppColors.amberText),
                  _ => (AppColors.errorSoft, AppColors.error),
                };
                return AppCard(
                  child: Row(children: [
                    IconTile(o.kind == 'plan' ? Icons.workspace_premium_outlined : Icons.school_outlined),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(o.kind == 'plan' ? '${o.courseTitle.isEmpty ? 'Plan' : o.courseTitle} · ${o.planMonths ?? 1} month(s)' : o.courseTitle,
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text('${o.orderId}${o.createdAt != null ? ' · ${o.createdAt!.substring(0, 10)}' : ''}',
                            style: const TextStyle(fontSize: 11.5, color: AppColors.outline)),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(formatPrice(o.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Pill(o.status, background: bg, foreground: fg),
                    ]),
                  ]),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
