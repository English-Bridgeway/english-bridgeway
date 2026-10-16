import { site } from "./site";
import type { SubscriptionPlan } from "../types";

// Business details and the legal pages (Terms and Conditions, Refunds and Cancellations,
// Privacy Policy). These are the defaults; Admin → Policies & business can edit every field,
// and the saved values are applied at start-up like the rest of the content (data/content.ts).
//
// Policy text is plain text: "## " starts a heading, "- " a bullet, a blank line a new
// paragraph. {business}, {site}, {website}, {email}, {phone}, {address} and {jurisdiction}
// are replaced with the business details below, so they only need filling in once.

export interface BusinessDetails {
  /** Registered business or proprietor name, as on the bank account Cashfree pays out to. Empty uses the site name. */
  legalName: string;
  /** Full registered address. Empty uses the site's location. */
  address: string;
  /** Support phone. Empty uses the WhatsApp number. */
  phone: string;
  /** Support email. Empty uses the site's contact email. */
  email: string;
  /** GSTIN, shown on the contact page when filled. */
  gstin: string;
  /** City whose courts handle disputes. Empty uses the first part of the site's location. */
  jurisdiction: string;
}

export interface PolicyDoc {
  title: string;
  /** Last updated, YYYY-MM-DD. */
  updated: string;
  body: string;
}

export type PolicyKey = "terms" | "refunds" | "privacy";

export interface Policies {
  business: BusinessDetails;
  /** Shown under the prices on the Pricing page. */
  pricingNote: string;
  terms: PolicyDoc;
  refunds: PolicyDoc;
  privacy: PolicyDoc;
}

/** Address and menu label of each policy page. */
export const policyPages: { key: PolicyKey; path: string; label: string }[] = [
  { key: "terms", path: "/terms", label: "Terms & Conditions" },
  { key: "refunds", path: "/refunds", label: "Refunds & Cancellations" },
  { key: "privacy", path: "/privacy", label: "Privacy Policy" },
];

const CONTACT = `## Contact us
{business}
{address}
Email: {email}
Phone: {phone}`;

const TERMS = `These Terms and Conditions ("Terms") govern your use of {website} (the "Website") and the online English courses, subscription plans and learning services offered on it by {business} ("we", "us", "our"). By creating an account, buying a course or plan, or using the Website, you agree to these Terms. If you do not agree, please do not use the Website.

## 1. Our services
{site} offers online English learning: free grammar, vocabulary and spoken English lessons and quizzes, paid courses, subscription plans that open every course for a fixed period, live speaking practice with other learners, and an AI speaking tutor. Our current courses, plans and prices are listed on the Pricing page ({website}/pricing).

## 2. Your account
- Please give your correct name, email address and phone number when you register or pay.
- You are responsible for keeping your password safe and for everything done with your account.
- One account is for one learner. Sharing an account or reselling access is not allowed.
- If you are under 18, a parent or guardian must agree to these Terms and make any payment.

## 3. Prices and payment
- All prices are shown and charged in Indian Rupees (INR, ₹).
- Payments are processed securely by our payment partner, Cashfree Payments. We never see or store your card, UPI or net banking details.
- Subscription plans are one-time payments for a fixed period (for example 1, 3, 6 or 12 months). They do not renew automatically, and you are never charged again unless you choose to buy another plan.
- We may change prices at any time. A change never affects an order you have already paid for.

## 4. Delivery of services
All our services are delivered online; nothing is shipped to you. A paid course, or every course for a subscription plan, is unlocked on your account as soon as the payment is confirmed, usually within a few minutes. If you have paid and do not have access within 24 hours, write to {email} with your order ID and we will fix it.

## 5. Free lessons and trial
Many lessons are free for everyone, and new accounts may get a free trial of paid courses. What the trial includes is shown on the Website and may change from time to time.

## 6. Acceptable use
You agree not to:
- copy, record, download, resell or share our lessons, audio or other content outside the Website;
- harass, abuse or behave inappropriately with other learners in live speaking calls and rooms;
- try to break, overload or get unauthorised access to the Website;
- use the Website for anything unlawful.
We may suspend or close an account that breaks these rules.

## 7. Intellectual property
All lessons, quizzes, text, audio, images, logos and software on the Website belong to {business} or its licensors. Buying a course or plan gives you a personal, non-transferable right to use it for your own learning.

## 8. Learning results
We work hard to make our lessons useful, but your progress depends on your own practice. We do not guarantee any particular result, score, job or exam outcome. The AI tutor can make mistakes; treat its answers as practice, not professional advice.

## 9. Refunds and cancellations
Refunds and cancellations are covered by our Refunds and Cancellations Policy ({website}/refunds), which is part of these Terms.

## 10. Limitation of liability
The Website is provided "as is". As far as the law allows, {business} is not liable for indirect or consequential loss from using the Website, and our total liability for any claim is limited to the amount you paid us for the service the claim is about.

## 11. Changes to these Terms
We may update these Terms from time to time. The latest version is always on this page with its date. Using the Website after a change means you accept the updated Terms.

## 12. Governing law
These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at {jurisdiction}, India.

${CONTACT}`;

const REFUNDS = `This policy explains how cancellations and refunds work for courses and subscription plans bought on {website} from {business}. It is part of our Terms and Conditions.

## Try before you pay
Most of our lessons are free, and new accounts get a free trial of paid courses. Please use them to make sure a course suits you before you buy.

## Cancellations
- Courses are one-time purchases, and subscription plans are one-time payments for a fixed period. Nothing renews automatically, so there is never a recurring charge to cancel.
- To cancel a purchase within the refund period below, write to us as described under "How to ask for a refund" and we will cancel it and refund you.
- You can stop using a course or plan at any time, but stopping after the refund period does not make you eligible for a refund.

## When you get a refund
- Within 7 days of payment: a full refund if you have completed no more than 25% of the lessons of the course (for a subscription plan, 25% of the lessons of the courses you used).
- Payment problems: if you were charged twice for one order, or money was debited but the course or plan was not unlocked, the extra or failed amount is refunded in full.
- Problems on our side: if a course you paid for is withdrawn, or cannot be used because of a fault on our side that we cannot fix within 7 days, we refund you in full (for a subscription plan, for the unused part).

## When a refund is not given
- More than 7 days after payment, except for the payment problems and faults above.
- When more than 25% of the course has been completed.
- When an account has been suspended for breaking our Terms and Conditions.

## How to ask for a refund
Email {email} or message us on {phone} from the email or phone number on your account, with your order ID, the course or plan name and the reason. We reply within 2 working days.

## How refunds are paid
Approved refunds are paid back to the original payment method (card, UPI, net banking or wallet) through our payment partner, Cashfree Payments. The money usually reaches you within 5 to 7 working days of approval, depending on your bank. Access to a refunded course or plan ends when the refund is made.

${CONTACT}`;

const PRIVACY = `This Privacy Policy explains what personal information {business} collects through {website}, how we use it and the choices you have.

## Information we collect
- Account details: your name, email address, phone number, password (stored only in hashed form) and a profile photo if you add one.
- Orders: what you bought, the amount, the date and the payment status. Card, UPI and bank details are entered on Cashfree Payments' secure page and never reach us.
- Learning activity: courses you open, lessons completed, quiz scores and your use of the AI tutor and live speaking practice.
- Messages you send us through the contact form, email or WhatsApp.
- Technical data such as browser type and IP address, used to keep the Website secure.

## How we use it
- To create your account, give you what you paid for and show your progress.
- To process payments and refunds and keep the records the law requires.
- To answer your questions and send you important messages about your account or orders.
- To improve our lessons and keep the Website safe.
We do not sell your personal information.

## Who we share it with
Only with service providers who help us run the Website, such as our payment partner (Cashfree Payments), our hosting provider and, when you use it, the AI provider that answers your messages to the AI tutor; and with authorities when the law requires it.

## Live speaking practice
Voice calls and rooms connect learners directly and are not recorded by us. Please do not share personal details you do not want other learners to know.

## Cookies and storage
We use your browser's storage to keep you signed in and remember your progress and settings. We do not use advertising cookies.

## Keeping and deleting your data
We keep your data while your account is open. You can ask us to correct or delete it by writing to {email}. Payment records are kept for as long as tax laws require.

## Changes to this policy
We may update this policy. The latest version is always on this page with its date.

${CONTACT}`;

const UPDATED = "2026-10-16";

export const policies: Policies = {
  business: { legalName: "", address: "", phone: "", email: "", gstin: "", jurisdiction: "" },
  pricingNote: "All prices are in Indian Rupees (INR, ₹). Courses and plans are one-time payments; nothing renews automatically.",
  terms: { title: "Terms and Conditions", updated: UPDATED, body: TERMS },
  refunds: { title: "Refunds and Cancellations Policy", updated: UPDATED, body: REFUNDS },
  privacy: { title: "Privacy Policy", updated: UPDATED, body: PRIVACY },
};

/** Subscription plans for sale (Admin → Subscription plans), kept current with the live content like the arrays in data/. */
export const subscriptionPlans: SubscriptionPlan[] = [];

/** The business details with the site's own details filling any blanks. */
export function businessInfo() {
  const b = policies.business;
  return {
    name: b.legalName.trim() || site.name,
    address: b.address.trim() || site.location,
    phone: b.phone.trim() || site.whatsapp,
    email: b.email.trim() || site.email,
    gstin: b.gstin.trim(),
    jurisdiction: b.jurisdiction.trim() || site.location.split(",")[0].trim() || "India",
  };
}
