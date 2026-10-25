import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../nav.dart';
import '../services/api.dart';
import '../services/payments.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'contact.dart';
import 'shell.dart';

/// Progress key of a curriculum lesson: the same key its lesson screen marks done.
String courseLessonKey(Course course, int index, String? href) {
  final parts = href == null ? <String>[] : Uri.parse(href).pathSegments.where((p) => p.isNotEmpty).toList();
  if (parts.length >= 3 && parts[0] == 'grammar') return '${parts[1]}/${parts[2]}';
  if (parts.length >= 2 && parts[0] == 'spoken-english') return 'spoken/${parts[1]}';
  return 'course/${course.id}/$index';
}

({int done, int total}) courseProgress(Course course, ProgressStore progress) {
  final lessons = course.allLessons;
  var done = 0;
  for (var i = 0; i < lessons.length; i++) {
    if (progress.isComplete(courseLessonKey(course, i, lessons[i].href))) done++;
  }
  return (done: done, total: lessons.length);
}

/// The lesson to continue: the first one not done yet (else the first one that opens).
int nextCourseLesson(Course course, ProgressStore progress) {
  final lessons = course.allLessons;
  for (var i = 0; i < lessons.length; i++) {
    if (lessons[i].href != null && !progress.isComplete(courseLessonKey(course, i, lessons[i].href))) return i;
  }
  return lessons.indexWhere((l) => l.href != null);
}

/// Opens a course lesson, or explains why it can't open (locked, or not written yet).
void openCourseLesson(BuildContext context, Course course, int index) {
  final auth = context.read<AuthStore>();
  final l = course.allLessons[index];
  if (!auth.canOpenLesson(course, index)) {
    if (inAppPurchases) {
      showBuySheet(context, course);
    } else {
      showSnack(context, 'This lesson is part of the full course.');
    }
    return;
  }
  if (l.href == null) {
    showSnack(context, 'This lesson is coming soon.');
    return;
  }
  context.read<ProgressStore>().startCourse(course.id);
  openHref(context, l.href!, course: course, lessonIndex: index);
}

class CoursesScreen extends StatefulWidget {
  const CoursesScreen({super.key, this.standalone = false});
  final bool standalone;
  @override
  State<CoursesScreen> createState() => _CoursesScreenState();
}

class _CoursesScreenState extends State<CoursesScreen> {
  String _level = 'All levels';
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final courses = data.courses.where((c) => _level == 'All levels' || c.level == _level).toList();
    return Scaffold(
      appBar: widget.standalone ? AppBar(title: const Text('Courses')) : const BrandBar('Courses'),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        const IndigoHeader(
          title: 'Courses',
          subtitle: 'Step-by-step paths from your first sentence to confident conversations. Your progress is saved as you go.',
        ),
        const SizedBox(height: 16),
        LevelFilter(value: _level, onChanged: (v) => setState(() => _level = v)),
        const SizedBox(height: 16),
        for (final c in courses) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 14), child: CourseCard(course: c)),
        if (courses.isEmpty) const EmptyState(icon: Icons.school_outlined, title: 'No courses here yet', message: 'Try another level.'),
        if (inAppPurchases && data.plans.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: AppCard(
              color: AppColors.sky,
              onTap: () => push(context, const PlansScreen()),
              child: const Row(children: [
                IconTile(Icons.workspace_premium_outlined, color: AppColors.navy, background: AppColors.yellow),
                SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Get every course', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    Text('Plans with all courses and the AI tutor', style: TextStyle(fontSize: 12.5, color: AppColors.outline)),
                  ]),
                ),
                Icon(Icons.arrow_forward_rounded, color: AppColors.indigo),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// Course card from the Home design: indigo header, details and "View course".
class CourseCard extends StatelessWidget {
  const CourseCard({super.key, required this.course, this.compact = false});
  final Course course;
  final bool compact;
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final progress = courseProgress(course, context.watch<ProgressStore>());
    final owned = course.isPaid && auth.canOpenCourse(course);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderSky),
        boxShadow: cardShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => push(context, CourseScreen(id: course.id)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Container(
              color: AppColors.indigo,
              padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(appIcon(course.icon), color: Colors.white, size: 26),
                  const Spacer(),
                  Pill(owned ? 'Unlocked' : course.isPaid ? (inAppPurchases ? formatPrice(auth.priceFor(course)) : 'Premium') : 'Free',
                      background: AppColors.yellow, foreground: AppColors.navy),
                ]),
                const SizedBox(height: 10),
                Text(course.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (!compact) ...[
                  Text(course.description, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: AppColors.onSurfaceVariant, height: 1.4)),
                  const SizedBox(height: 10),
                ],
                Wrap(spacing: 6, runSpacing: 6, children: [
                  LevelChip(course.level),
                  Pill('${course.rating}', icon: Icons.star_rounded, background: Colors.white, border: AppColors.borderSky),
                  Pill(course.duration, background: Colors.white, border: AppColors.borderSky),
                ]),
                const SizedBox(height: 8),
                Text(progress.done > 0 ? '${progress.done} of ${progress.total} lessons done' : '${course.lessons} lessons',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.outline)),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: AppColors.sky, borderRadius: BorderRadius.circular(10)),
                  child: Text(progress.done > 0 ? 'Continue course' : 'View course',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.navy)),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class CourseScreen extends StatefulWidget {
  const CourseScreen({super.key, required this.id});
  final String id;
  @override
  State<CourseScreen> createState() => _CourseScreenState();
}

class _CourseScreenState extends State<CourseScreen> {
  bool? _paymentsOn;

  @override
  void initState() {
    super.initState();
    if (!inAppPurchases) return;
    context.read<Api>().paymentsEnabled().then((v) {
      if (mounted) setState(() => _paymentsOn = v);
    }).catchError((_) {
      if (mounted) setState(() => _paymentsOn = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final auth = context.watch<AuthStore>();
    final progress = context.watch<ProgressStore>();
    final course = data.course(widget.id);
    if (course == null) {
      return Scaffold(appBar: AppBar(), body: const EmptyState(icon: Icons.search_off_rounded, title: 'Not found', message: 'This course is no longer available.'));
    }
    final p = courseProgress(course, progress);
    final locked = course.isPaid && !auth.canOpenCourse(course);
    final nextIndex = nextCourseLesson(course, progress);
    void openLesson(int index) => openCourseLesson(context, course, index);

    Widget cta;
    if (!locked) {
      cta = AppButton(p.done > 0 ? 'Continue course' : 'Start course',
          leading: Icons.play_circle_rounded, onPressed: nextIndex < 0 ? null : () => openLesson(nextIndex));
    } else if (!inAppPurchases) {
      cta = auth.signedIn
          ? AppButton('Refresh my courses', leading: Icons.refresh_rounded, onPressed: auth.refresh)
          : AppButton('Log in to open your courses', leading: Icons.lock_rounded, onPressed: () => push(context, const AuthScreen()));
    } else if (_paymentsOn == false) {
      cta = AppButton('Contact us to enrol', onPressed: () => push(context, const ContactScreen()));
    } else if (!auth.signedIn) {
      cta = AppButton('Log in to buy · ${formatPrice(course.price)}', leading: Icons.lock_rounded,
          onPressed: () => push(context, const AuthScreen()));
    } else {
      cta = AppButton('Buy course · ${formatPrice(auth.priceFor(course))}', leading: Icons.lock_open_rounded,
          onPressed: () => showBuySheet(context, course));
    }

    var index = 0;
    return Scaffold(
      appBar: AppBar(title: const Text('Course')),
      body: RefreshIndicator(
        onRefresh: auth.refresh,
        child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
          IndigoHeader(
            title: course.title,
            subtitle: course.description,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 6, runSpacing: 6, children: [
                LevelChip(course.level),
                Pill(course.isPaid ? (inAppPurchases ? formatPrice(course.price) : 'Premium') : 'Free', background: AppColors.yellow),
              ]),
              const SizedBox(height: 12),
              Wrap(spacing: 14, runSpacing: 6, children: [
                _Meta(Icons.star_rounded, '${course.rating} rating'),
                _Meta(Icons.groups_rounded, '${course.students} students'),
                _Meta(Icons.schedule_rounded, course.duration),
                _Meta(Icons.auto_stories_rounded, '${course.lessons} lessons'),
              ]),
            ]),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text('${p.done} of ${p.total} lessons done', style: const TextStyle(fontWeight: FontWeight.w700))),
                  Text('${p.total == 0 ? 0 : (p.done * 100 / p.total).round()}%', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.indigo)),
                ]),
                const SizedBox(height: 10),
                ProgressLine(p.total == 0 ? 0 : p.done / p.total),
                const SizedBox(height: 16),
                cta,
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    _accessNote(course, auth, locked),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: AppColors.outline),
                  ),
                ),
                if (inAppPurchases && locked && auth.signedIn && data.plans.isNotEmpty && _paymentsOn != false) ...[
                  const SizedBox(height: 10),
                  AppButton('Or get every course with a plan', kind: ButtonKind.ghost, onPressed: () => push(context, const PlansScreen())),
                ],
              ]),
            ),
          ),
          const SizedBox(height: 24),
          if (course.outcomes.isNotEmpty) ...[
            const SectionHeading("What you'll learn"),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: AppCard(
                child: Column(children: [
                  for (final o in course.outcomes)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
                        const SizedBox(width: 10),
                        Expanded(child: Text(o, style: const TextStyle(height: 1.4))),
                      ]),
                    ),
                ]),
              ),
            ),
            const SizedBox(height: 24),
          ],
          const SectionHeading('Curriculum'),
          for (final m in course.curriculum)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: AppCard(
                padding: EdgeInsets.zero,
                child: Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    initiallyExpanded: m == course.curriculum.first,
                    title: Text(m.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    subtitle: Text('${m.lessons.length} lessons · ${m.lessons.fold<int>(0, (a, l) => a + l.minutes)} min',
                        style: const TextStyle(fontSize: 12, color: AppColors.outline)),
                    childrenPadding: const EdgeInsets.only(bottom: 8),
                    children: [
                      for (final l in m.lessons)
                        Builder(builder: (_) {
                          final i = index++;
                          final open = auth.canOpenLesson(course, i);
                          final done = progress.isComplete(courseLessonKey(course, i, l.href));
                          return ListTile(
                            dense: true,
                            onTap: () => openLesson(i),
                            leading: Icon(
                              done ? Icons.check_circle_rounded : open ? Icons.play_circle_outline_rounded : Icons.lock_outline_rounded,
                              color: done ? AppColors.success : open ? AppColors.indigo : AppColors.outline,
                            ),
                            title: Text(l.title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: open ? AppColors.navy : AppColors.outline)),
                            trailing: Text('${l.minutes} min', style: const TextStyle(fontSize: 12, color: AppColors.outline)),
                          );
                        }),
                    ],
                  ),
                ),
              ),
            ),
          if (course.instructorName.isNotEmpty) ...[
            const SizedBox(height: 12),
            const SectionHeading('Your instructor'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: AppCard(
                child: Row(children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.yellow,
                    child: Text(course.instructorName[0], style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy, fontSize: 18)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(course.instructorName, style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(course.instructorTitle, style: const TextStyle(fontSize: 12.5, color: AppColors.outline)),
                    ]),
                  ),
                ]),
              ),
            ),
          ],
        ]),
      ),
    );
  }

  String _accessNote(Course course, AuthStore auth, bool locked) {
    final a = auth.account;
    if (locked) {
      if (!inAppPurchases) {
        final free = auth.signedIn ? auth.freeLessonsFor(course) : 0;
        return '${free > 0 ? 'The first $free lesson${free == 1 ? ' is' : 's are'} free on your trial. ' : ''}Courses in your account open here.';
      }
      if (_paymentsOn == false) return 'Online payment is not available right now.';
      if (!auth.signedIn) return 'New here? Sign up for a free trial and try the first lessons.';
      final free = auth.freeLessonsFor(course);
      return '${free > 0 ? 'The first $free lesson${free == 1 ? ' is' : 's are'} free on your trial. ' : ''}One-time payment · UPI, cards and net banking';
    }
    if (!course.isPaid) return 'Free · Progress saved on this phone';
    if (a?.purchasedCourseIds.contains(course.id) == true) return 'Enrolled · In your account';
    if (a?.status == 'unlimited') return 'Open with unlimited access';
    return 'Open with your plan';
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 15, color: AppColors.yellow),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(color: Colors.white.withValues(alpha: 0.92), fontSize: 12.5)),
      ]);
}

/// "Lesson 3 of 40 · Beginner English" strip on lessons opened from a course.
class CourseLessonBanner extends StatelessWidget {
  const CourseLessonBanner({super.key, required this.course, required this.index});
  final Course course;
  final int index;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: AppColors.sky, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.borderSky)),
        child: Row(children: [
          const Icon(Icons.school_outlined, color: AppColors.indigo, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text('Lesson ${index + 1} of ${course.allLessons.length} · ${course.title}',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ),
        ]),
      );
}

/// Goes to the next curriculum lesson (or back to the course after the last one).
class NextCourseLessonButton extends StatelessWidget {
  const NextCourseLessonButton({super.key, required this.course, required this.index, this.onLeave});
  final Course course;
  final int index;
  final VoidCallback? onLeave;
  @override
  Widget build(BuildContext context) {
    final lessons = course.allLessons;
    var next = index + 1;
    while (next < lessons.length && lessons[next].href == null) {
      next++;
    }
    if (next >= lessons.length) {
      return AppButton('Finish', icon: Icons.flag_rounded, onPressed: () {
        onLeave?.call();
        Navigator.of(context).pop();
      });
    }
    return AppButton('Next lesson', icon: Icons.arrow_forward_rounded, onPressed: () {
      onLeave?.call();
      final auth = context.read<AuthStore>();
      if (!auth.canOpenLesson(course, next)) {
        Navigator.of(context).pop();
        showSnack(context, inAppPurchases ? 'Buy the course to open the next lesson.' : 'The next lesson is part of the full course.');
        return;
      }
      final screen = screenFor(context.read<ContentStore>().data, lessons[next].href!, course: course, lessonIndex: next);
      if (screen != null) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => screen));
      } else {
        openHref(context, lessons[next].href!);
      }
    });
  }
}

/// Subscription plans (every course and the AI tutor for some months).
class PlansScreen extends StatelessWidget {
  const PlansScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final data = context.watch<ContentStore>().data;
    final auth = context.watch<AuthStore>();
    return Scaffold(
      appBar: AppBar(title: const Text('Plans')),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        const IndigoHeader(
          title: 'Get every course',
          subtitle: 'One payment unlocks all courses and Speak with AI for the whole period. No auto-renewal.',
        ),
        const SizedBox(height: 16),
        if (data.plans.isEmpty) const EmptyState(icon: Icons.workspace_premium_outlined, title: 'No plans right now', message: 'Courses can still be bought one by one.'),
        for (final plan in data.plans)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: plan.highlight ? AppColors.yellow : Colors.transparent, width: 2),
              ),
              child: AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(plan.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                    if (plan.highlight) const Pill('Best value', background: AppColors.yellow),
                  ]),
                  const SizedBox(height: 6),
                  if (plan.description.isNotEmpty) Text(plan.description, style: const TextStyle(color: AppColors.onSurfaceVariant, height: 1.4)),
                  const SizedBox(height: 10),
                  Text.rich(TextSpan(children: [
                    TextSpan(text: formatPrice(plan.price), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                    TextSpan(text: '  for ${plan.months} month${plan.months == 1 ? '' : 's'}', style: const TextStyle(color: AppColors.outline)),
                  ])),
                  const SizedBox(height: 12),
                  AppButton(auth.signedIn ? 'Choose plan' : 'Log in to subscribe',
                      kind: plan.highlight ? ButtonKind.yellow : ButtonKind.indigo,
                      onPressed: () => auth.signedIn ? showBuySheet(context, null, plan: plan) : push(context, const AuthScreen())),
                ]),
              ),
            ),
          ),
      ]),
    );
  }
}

/// Collects the buyer's name and mobile number, then opens Cashfree checkout.
Future<void> showBuySheet(BuildContext context, Course? course, {SubscriptionPlan? plan}) async {
  if (!inAppPurchases) return;
  final auth = context.read<AuthStore>();
  if (!auth.signedIn) {
    push(context, const AuthScreen());
    return;
  }
  await showModalBottomSheet(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => _BuySheet(course: course, plan: plan),
  );
}

class _BuySheet extends StatefulWidget {
  const _BuySheet({this.course, this.plan});
  final Course? course;
  final SubscriptionPlan? plan;
  @override
  State<_BuySheet> createState() => _BuySheetState();
}

class _BuySheetState extends State<_BuySheet> {
  late final _name = TextEditingController(text: context.read<AuthStore>().user?.name ?? '');
  late final _phone = TextEditingController(text: context.read<AuthStore>().user?.phone ?? '');
  bool _busy = false;
  String? _error, _nameError, _phoneError;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    final phone = _phone.text.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^91(?=\d{10}$)'), '');
    setState(() {
      _nameError = _name.text.trim().length < 2 ? 'Please enter your full name.' : null;
      _phoneError = RegExp(r'^[6-9]\d{9}$').hasMatch(phone) ? null : 'Enter a 10-digit Indian mobile number.';
      _error = null;
    });
    if (_nameError != null || _phoneError != null) return;
    setState(() => _busy = true);
    final api = context.read<Api>();
    final auth = context.read<AuthStore>();
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final result = await Payments.checkout(api,
          courseId: widget.course?.id, planId: widget.plan?.id, name: _name.text.trim(), phone: phone);
      await auth.refresh();
      navigator.pop();
      messenger.showSnackBar(SnackBar(content: Text(result.message)));
    } catch (e) {
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final course = widget.course;
    final plan = widget.plan;
    final price = plan?.price ?? auth.priceFor(course!);
    final title = plan != null ? '${plan.name} plan' : course!.title;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderSky, borderRadius: BorderRadius.circular(4)))),
        const SizedBox(height: 16),
        Text(plan != null ? 'Subscribe' : 'Buy course', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.borderSky)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
              if (course != null && price < course.price)
                Text(formatPrice(course.price), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppColors.outline)),
              const SizedBox(width: 6),
              Text(formatPrice(price), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ]),
            const SizedBox(height: 4),
            Text(
              plan != null
                  ? 'Every course and Speak with AI for ${plan.months} month${plan.months == 1 ? '' : 's'}. One-time payment, no auto-renewal.'
                  : 'One-time payment. The course stays in your account for good.',
              style: const TextStyle(fontSize: 12.5, color: AppColors.outline),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        TextField(controller: _name, decoration: InputDecoration(labelText: 'Full name', errorText: _nameError), textCapitalization: TextCapitalization.words),
        const SizedBox(height: 12),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(labelText: 'Mobile number', prefixText: '+91 ', errorText: _phoneError),
        ),
        const SizedBox(height: 6),
        Text('Receipt goes to ${auth.user?.email ?? 'your email'}.', style: const TextStyle(fontSize: 12, color: AppColors.outline)),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
        ],
        const SizedBox(height: 16),
        AppButton('Pay ${formatPrice(price)}', leading: Icons.lock_rounded, busy: _busy, onPressed: _pay),
        const SizedBox(height: 8),
        const Center(child: Text('Secure payment by Cashfree · UPI, cards, net banking', style: TextStyle(fontSize: 11.5, color: AppColors.outline))),
      ]),
    );
  }
}
