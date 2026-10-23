import 'dart:async';

import 'package:flutter_cashfree_pg_sdk/api/cferrorresponse/cferrorresponse.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpayment/cfwebcheckoutpayment.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpaymentgateway/cfpaymentgatewayservice.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfsession/cfsession.dart';
import 'package:flutter_cashfree_pg_sdk/utils/cfenums.dart';

import 'api.dart';

/// False in the Google Play build (`--dart-define=IN_APP_PURCHASES=false`): Play doesn't allow
/// selling courses through Cashfree, so that build has no prices or buy buttons. Courses bought
/// on the website still unlock through the learner's account.
const inAppPurchases = bool.fromEnvironment('IN_APP_PURCHASES', defaultValue: true);

class PaymentResult {
  final bool paid;
  final String message;
  PaymentResult(this.paid, this.message);
}

/// Cashfree checkout. The server creates the order (POST /api/orders, price from the database),
/// the Cashfree SDK takes the payment, then GET /api/orders/:id confirms it with Cashfree.
class Payments {
  static Future<PaymentResult> checkout(Api api,
      {String? courseId, String? planId, required String name, required String phone}) async {
    final order = await api.createOrder(courseId: courseId, planId: planId, name: name, phone: phone);
    final orderId = '${order['orderId']}';
    final sessionId = '${order['paymentSessionId'] ?? ''}';
    if (sessionId.isEmpty) throw ApiError(500, 'Payment could not be started. Please try again.');

    final done = Completer<String?>();
    final gateway = CFPaymentGatewayService();
    gateway.setCallback(
      (_) => done.isCompleted ? null : done.complete(null),
      (CFErrorResponse error, _) => done.isCompleted ? null : done.complete(error.getMessage() ?? 'The payment was not completed.'),
    );
    final session = CFSessionBuilder()
        .setEnvironment(order['mode'] == 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX)
        .setOrderId(orderId)
        .setPaymentSessionId(sessionId)
        .build();
    gateway.doPayment(CFWebCheckoutPaymentBuilder().setSession(session).build());
    final sdkError = await done.future;

    // The SDK result is only a hint; the server asks Cashfree for the real status.
    for (var i = 0; i < 6; i++) {
      final status = (await api.order(orderId)).status;
      if (status == 'paid') {
        return PaymentResult(true, planId != null ? 'Payment received. Every course is now open.' : 'Payment received. The course is now in your account.');
      }
      if (status != 'pending') break;
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    throw ApiError(402, sdkError ?? 'The payment was not completed. If money was taken, it will show up shortly.');
  }
}
