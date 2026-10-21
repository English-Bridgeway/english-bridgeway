import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Log in or sign up with the website's learner account (same email and password).
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, this.startWithRegister = false});
  final bool startWithRegister;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late bool _register = widget.startWithRegister;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false, _hide = true;
  String? _error;
  final _fieldErrors = <String, String>{};

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    _fieldErrors.clear();
    if (_register && _name.text.trim().length < 2) _fieldErrors['name'] = 'Please enter your name.';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(_email.text.trim())) _fieldErrors['email'] = 'Enter a valid email address.';
    if (_password.text.length < (_register ? 8 : 1)) {
      _fieldErrors['password'] = _register ? 'Use a password of at least 8 characters.' : 'Enter your password.';
    }
    setState(() => _error = null);
    if (_fieldErrors.isNotEmpty) return;
    setState(() => _busy = true);
    final auth = context.read<AuthStore>();
    try {
      if (_register) {
        await auth.register(_name.text, _email.text, _password.text);
      } else {
        await auth.login(_email.text, _password.text);
      }
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, _register ? 'Welcome to English-Bridgeway! Your free trial has started.' : 'Welcome back, ${auth.user?.name.split(' ').first}!');
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
      appBar: AppBar(title: Text(_register ? 'Sign up' : 'Log in')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Center(child: ClipRRect(borderRadius: BorderRadius.circular(20), child: Image.asset('assets/logo.png', width: 72, height: 72))),
        const SizedBox(height: 16),
        Text(_register ? 'Create your free account' : 'Welcome back',
            textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(
          _register
              ? 'Start a free trial with lessons, quizzes and the AI tutor. Use the same account on the website.'
              : 'Log in with the email and password you use on englishbridgeway.com.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.outline, height: 1.5),
        ),
        const SizedBox(height: 24),
        if (_register) ...[
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            autofillHints: const [AutofillHints.name],
            decoration: InputDecoration(labelText: 'Your name', prefixIcon: const Icon(Icons.person_outline_rounded), errorText: _fieldErrors['name']),
          ),
          const SizedBox(height: 14),
        ],
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          autofillHints: const [AutofillHints.email],
          decoration: InputDecoration(labelText: 'Email', prefixIcon: const Icon(Icons.mail_outline_rounded), errorText: _fieldErrors['email']),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _password,
          obscureText: _hide,
          autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
          onSubmitted: (_) => _submit(),
          decoration: InputDecoration(
            labelText: 'Password',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            errorText: _fieldErrors['password'],
            suffixIcon: IconButton(
              icon: Icon(_hide ? Icons.visibility_outlined : Icons.visibility_off_outlined),
              onPressed: () => setState(() => _hide = !_hide),
            ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.errorSoft, borderRadius: BorderRadius.circular(12)),
            child: Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
          ),
        ],
        const SizedBox(height: 22),
        AppButton(_register ? 'Create account' : 'Log in', busy: _busy, onPressed: _submit),
        const SizedBox(height: 14),
        TextButton(
          onPressed: () => setState(() {
            _register = !_register;
            _error = null;
            _fieldErrors.clear();
          }),
          child: Text(_register ? 'Already have an account? Log in' : 'New here? Create a free account',
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.indigo)),
        ),
      ]),
    );
  }
}
