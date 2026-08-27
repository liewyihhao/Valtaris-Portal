// English message catalog (default locale). Worker-facing copy lives here so it
// can be localized later without touching call sites (master design §6).
//
// Keys are namespaced by surface (`notif.*` = notification templates). Add a
// new locale by copying this file to <locale>.ts with the same keys.
//
// Interpolation: {placeholders} are filled by t(key, vars). Keep placeholder
// names stable across locales.

export const en = {
  // --- Assessment / certification exam ---
  "notif.exam.pass.title": "You passed the {track} certification exam",
  "notif.exam.pass.body": "You're now certified at {tier} for {track}. Your tier is live on your profile.",
  "notif.exam.fail.title": "{track} exam — not passed this time",
  "notif.exam.fail.body":
    "You scored {score}%. You can retry after the 24-hour cooldown; the Learning Center course for {track} can help close the gap first.",

  // --- Validator capability ---
  "notif.validator.granted.title": "Validator access granted — {track}",
  "notif.validator.granted.body":
    "You passed the {track} validator calibration exam. You can now review other annotators' work in the Validate queue.",
  "notif.validator.recertified.title": "Validator access recertified — {track}",
  "notif.validator.recertified.body": "Your validator calibration for {track} is renewed. The review queue is open to you.",
  "notif.validator.pausedTier.title": "Validator access paused — {track}",
  "notif.validator.pausedTier.body":
    "Your {track} tier dropped below T2, so your validator capability there is paused. Requalify at T2+ to restore it.",
  "notif.validator.pausedFraud.title": "Validator access paused pending review",
  "notif.validator.pausedFraud.body":
    "A confirmed-fraud clawback on your own work has paused your validator capabilities while Trust & Safety reviews. This decision is appealable.",

  // --- Review / correction window ---
  "notif.correction.requested.title": "Correction requested on your submission",
  "notif.correction.requested.body":
    "A validator asked for a correction{detail}. Resubmit within {hours} hours or the payout is closed (and remains appealable).",
  "notif.correction.expired.title": "Correction window closed",
  "notif.correction.expired.body":
    "The correction window passed without a resubmission, so this payout was closed. If you think this is wrong, you can appeal it.",

  // --- Payout ---
  "notif.payout.paid.title": "Payment sent — ${amount}",
  "notif.payout.paid.body":
    "Your payout of ${amount} {currency} was dispatched via {provider}. Settlement time depends on your provider.",
  "notif.payout.paidRun.title": "Payment sent — ${amount}",
  "notif.payout.paidRun.body": "Your payout of ${amount} was dispatched in this payout run. Settlement time depends on your provider.",
  "notif.payout.clawback.title": "Payout reversed — confirmed fraud",
  "notif.payout.clawback.body":
    "A payout was reversed after a confirmed-fraud review: {detail}. Your validator and Studio access are suspended pending outcome. This decision is appealable.",

  // --- Appeals ---
  "notif.appeal.upheld.title": "Your appeal was upheld",
  "notif.appeal.upheld.body": "We reviewed your appeal and restored the payout. {note}",
  "notif.appeal.denied.title": "Your appeal was reviewed",
  "notif.appeal.denied.body": "We reviewed your appeal and the original decision stands. {note}",

  // --- Guidelines / recertification ---
  "notif.guideline.update.title": "Guideline update — {track} v{version}",
  "notif.guideline.update.body":
    'The {track} guidelines were updated to v{version}. A short "what changed" module is in your Learning Center — please review it before your next task.',

  // --- Compliance ---
  "notif.compliance.review.title": "Account under compliance review",
  "notif.compliance.review.body":
    "A routine sanctions re-screen needs review before further payouts. Compliance will follow up; you can appeal any resulting decision.",

  // --- Project invitations ---
  "notif.project.invited.title": "You're invited to a project",
  "notif.project.invited.body":
    "You've been selected for {project} ({track}). Review it in your invitations and accept to start working.",

  // --- Support ---
  "notif.support.resolved.title": "Your ticket was resolved",
} as const;
