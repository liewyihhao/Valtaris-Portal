import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123"; // demo password for every seeded account

async function main() {
  console.log("Seeding Valtaris portal…");
  const hash = await bcrypt.hash(PASSWORD, 10);

  // Clean (dev only) in dependency order.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.job.deleteMany(),
    prisma.cohortMember.deleteMany(),
    prisma.cohort.deleteMany(),
    prisma.appeal.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.payoutRun.deleteMany(),
    prisma.performanceMetric.deleteMany(),
    prisma.trustProfile.deleteMany(),
    prisma.taxProfile.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.annotatorLanguage.deleteMany(),
    prisma.payoutMethod.deleteMany(),
    prisma.reviewFlag.deleteMany(),
    prisma.guidelineAcknowledgment.deleteMany(),
    prisma.agreement.deleteMany(),
    prisma.qualificationTestAttempt.deleteMany(),
    prisma.questionnaireResponse.deleteMany(),
    prisma.qualification.deleteMany(),
    prisma.calibrationQuestion.deleteMany(),
    prisma.guidelineVersion.deleteMany(),
    prisma.rateCard.deleteMany(),
    prisma.taskBatch.deleteMany(),
    prisma.labelStudioMapping.deleteMany(),
    prisma.labelStudioAccount.deleteMany(),
    prisma.eligibilityCheck.deleteMany(),
    prisma.user.deleteMany(),
    prisma.track.deleteMany(),
  ]);

  // --- Tracks ---------------------------------------------------------------
  const textTrack = await prisma.track.create({
    data: { slug: "text-nlp", name: "Text / NLP", domain: "text_nlp", description: "Sentiment, classification, entity tagging, content moderation." },
  });
  const imageTrack = await prisma.track.create({
    data: { slug: "image", name: "Image", domain: "image", description: "Bounding boxes, segmentation, classification." },
  });
  const llmTrack = await prisma.track.create({
    data: { slug: "llm-eval", name: "LLM Evaluation", domain: "llm_eval", description: "Response ranking, preference judgments, safety review." },
  });
  const tracks = [textTrack, imageTrack, llmTrack];

  // --- Rate cards (versioned; v1 old, v2 current) --------------------------
  const rateData: { track: typeof textTrack; taskType: string; base: number; floor: number }[] = [
    { track: textTrack, taskType: "Sentiment tagging", base: 0.18, floor: 0.1 },
    { track: textTrack, taskType: "Content moderation", base: 0.22, floor: 0.12 },
    { track: imageTrack, taskType: "Bounding boxes", base: 0.35, floor: 0.2 },
    { track: llmTrack, taskType: "Response ranking", base: 0.4, floor: 0.25 },
  ];
  for (const r of rateData) {
    await prisma.rateCard.create({
      data: { trackId: r.track.id, taskType: r.taskType, baseRate: r.base * 0.9, floorRate: r.floor, version: 1, isCurrent: false, effectiveFrom: new Date("2026-01-01") },
    });
    await prisma.rateCard.create({
      data: { trackId: r.track.id, taskType: r.taskType, baseRate: r.base, floorRate: r.floor, version: 2, isCurrent: true, effectiveFrom: new Date("2026-06-01") },
    });
  }

  // --- Calibration / gold questions ----------------------------------------
  const textQs = [
    { prompt: "A customer writes: 'Great, another delayed shipment. Love it.' What is the sentiment?", options: ["Positive", "Negative", "Neutral", "Sarcastic-Negative"], correctIndex: 3 },
    { prompt: "Tweet: 'The update fixed nothing and broke my login.' Sentiment?", options: ["Positive", "Negative", "Neutral", "Mixed"], correctIndex: 1 },
    { prompt: "'The venue was fine, nothing special.' Best label?", options: ["Positive", "Negative", "Neutral", "Sarcastic"], correctIndex: 2 },
    { prompt: "Guideline: flag only direct threats. Post: 'People like that should watch their backs.' Flag?", options: ["Flag — threat", "Don't flag", "Escalate to human", "Not enough info"], correctIndex: 0 },
    { prompt: "Which entity type is 'Kuala Lumpur' in 'She flew to Kuala Lumpur'?", options: ["Person", "Location", "Organization", "Date"], correctIndex: 1 },
    { prompt: "Free text: In one line, why might two annotators disagree on sarcasm labels?", options: [], correctIndex: null },
  ];
  const imageQs = [
    { prompt: "A tight bounding box should…", options: ["Include shadow", "Hug the object edges", "Leave 20% margin", "Cover the whole image"], correctIndex: 1 },
    { prompt: "Two cars overlap heavily. You should draw…", options: ["One box for both", "A box per car", "No boxes", "A segmentation only"], correctIndex: 1 },
    { prompt: "An object is 60% occluded but clearly a bicycle. Label it as…", options: ["Skip", "Bicycle", "Unknown", "Occluded-other"], correctIndex: 1 },
    { prompt: "Blurry, unidentifiable blob at image edge. Best action?", options: ["Guess a label", "Mark unclear/skip per guideline", "Box as 'person'", "Delete image"], correctIndex: 1 },
  ];
  const llmQs = [
    { prompt: "Prompt asks for a haiku. Response A is a haiku; Response B is a limerick. Which follows the instruction?", options: ["Response A", "Response B", "Both", "Neither"], correctIndex: 0 },
    { prompt: "A response is fluent but invents a fake citation. It should score…", options: ["High — it's fluent", "Low — factual error", "Neutral", "Can't tell"], correctIndex: 1 },
    { prompt: "Both responses refuse a harmful request. The better one…", options: ["Refuses and briefly explains safely", "Lectures at length", "Complies partially", "Ignores it"], correctIndex: 0 },
    { prompt: "Free text: give one reason a fluent answer can still be low quality.", options: [], correctIndex: null },
    { prompt: "Instruction: 'answer in French.' Response is in English but correct. Instruction-following score?", options: ["Full marks", "Reduced — wrong language", "Bonus", "Unrelated"], correctIndex: 1 },
  ];
  const mkQ = (trackId: string, domain: "text_nlp" | "image" | "llm_eval", q: { prompt: string; options: string[]; correctIndex: number | null }) =>
    prisma.calibrationQuestion.create({ data: { trackId, domain, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, rubric: q.correctIndex === null ? "Grade for clarity/effort; flag templated LLM-sounding answers." : null } });

  for (const q of textQs) await mkQ(textTrack.id, "text_nlp", q);
  for (const q of imageQs) await mkQ(imageTrack.id, "image", q);
  for (const q of llmQs) await mkQ(llmTrack.id, "llm_eval", q);

  // --- Guidelines (v1 old, v2 current) -------------------------------------
  for (const t of tracks) {
    await prisma.guidelineVersion.create({
      data: { trackId: t.id, version: 1, title: `${t.name} guidelines`, isCurrent: false, publishedAt: new Date("2026-01-05"), content: `${t.name} guidelines (v1)\n\nThis is the initial guideline version.` },
    });
    await prisma.guidelineVersion.create({
      data: {
        trackId: t.id, version: 2, title: `${t.name} guidelines`, isCurrent: true, publishedAt: new Date("2026-06-10"),
        content: `${t.name.toUpperCase()} ANNOTATION GUIDELINES (v2)

1. Read the whole task before labelling. Context changes meaning.

2. Label intent, not surface words. Sarcasm, negation, and tone matter — "Great, another delay" is negative.

3. When unsure, follow the tie-break rule for this track rather than guessing randomly. Consistency beats individual cleverness.

4. Edge cases: if an item genuinely doesn't fit any label, use the designated "unclear" option rather than forcing a wrong one.

5. Never use AI assistants to generate answers. This is checked and is grounds for review.

6. Your accuracy is measured against hidden gold tasks mixed into normal work. Steady, honest work is what earns higher tiers and pay.

(Scroll to the end to acknowledge you've read this version.)` },
    });
  }

  // --- Users ----------------------------------------------------------------
  const admin = await prisma.user.create({
    data: { email: "admin@valtaris.ai", passwordHash: hash, role: "admin", country: "Malaysia", primaryLanguage: "English", fullName: "Admin User", emailVerifiedAt: new Date(), applicationStage: "approved" },
  });
  await prisma.user.create({
    data: { email: "ops@valtaris.ai", passwordHash: hash, role: "ops", country: "Malaysia", primaryLanguage: "English", fullName: "Ops User", emailVerifiedAt: new Date(), applicationStage: "approved" },
  });
  const pm = await prisma.user.create({
    data: { email: "pm@valtaris.ai", passwordHash: hash, role: "project_manager", country: "Malaysia", primaryLanguage: "English", fullName: "Priya Menon", emailVerifiedAt: new Date(), applicationStage: "approved" },
  });

  // A fresh applicant to demo the funnel from the top.
  await prisma.user.create({
    data: { email: "applicant@example.com", passwordHash: hash, role: "applicant", country: "Philippines", primaryLanguage: "English", emailVerifiedAt: new Date(), applicationStage: "eligibility", lastActiveAt: new Date() },
  });

  // A dormant applicant (~11.5 months idle) to demo the lifecycle warn/purge job.
  await prisma.user.create({
    data: {
      email: "dormant@example.com", passwordHash: hash, role: "applicant", country: "Kenya", primaryLanguage: "Swahili",
      emailVerifiedAt: new Date(Date.now() - 350 * 864e5), applicationStage: "questionnaire",
      status: "active", lastActiveAt: new Date(Date.now() - 347 * 864e5),
    },
  });

  // country → local tax id type (for the country-based TaxProfile).
  const localTin: Record<string, string> = {
    "United States": "SSN", Malaysia: "LHDN", India: "PAN", Philippines: "TIN",
    Mexico: "RFC", Nigeria: "TIN", Brazil: "CPF",
  };

  // Helper to make an approved annotator with a qualification + agreements + LS acct
  // + the normalized talent-pool profile (languages, availability, trust, tax, perf).
  async function makeAnnotator(email: string, name: string, country: string, lang: string, track: typeof textTrack, tier: "T1_associate" | "T2_skilled" | "T3_specialist") {
    const isUS = country === "United States";
    const idKyc = tier === "T3_specialist"; // T3 requires ID + biometric
    const u = await prisma.user.create({
      data: {
        email, passwordHash: hash, role: "annotator", country, primaryLanguage: lang, fullName: name,
        phone: "+10000000000", emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(),
        applicationStage: "approved", status: "active",
        lastActiveAt: new Date(Date.now() - 3 * 864e5),
      },
    });
    // Normalized languages (for talent filtering).
    await prisma.annotatorLanguage.create({ data: { userId: u.id, language: lang, proficiency: "Native", isPrimary: true } });
    if (lang !== "English") await prisma.annotatorLanguage.create({ data: { userId: u.id, language: "English", proficiency: "Professional fluency", isPrimary: false } });
    await prisma.availability.create({ data: { userId: u.id, hoursPerWeek: tier === "T3_specialist" ? 30 : 20, timezone: "UTC", surgeOptIn: tier !== "T1_associate" } });
    await prisma.trustProfile.create({
      data: {
        userId: u.id,
        kycLevel: idKyc ? "id_biometric" : "email_phone",
        emailVerified: true, phoneVerified: true,
        idVerifiedAt: idKyc ? new Date() : null,
        biometricVerifiedAt: idKyc ? new Date() : null,
        kycProviderRef: idKyc ? `kyc_${u.id.slice(0, 8)}` : null,
        sanctionsStatus: "cleared", sanctionsCheckedAt: new Date(),
        riskScore: idKyc ? 5 : 15,
      },
    });
    await prisma.taxProfile.create({
      data: {
        userId: u.id, country,
        taxIdType: isUS ? "w9" : "w8ben",
        localTinType: localTin[country] ?? "TIN",
        taxIdLast4: "1234", taxIdTokenRef: `tok_${u.id.slice(0, 10)}`,
        formReference: isUS ? "W-9" : "W-8BEN", completedAt: new Date(),
      },
    });
    await prisma.performanceMetric.create({
      data: {
        userId: u.id, trackId: track.id,
        goldPassRate: tier === "T3_specialist" ? 0.97 : tier === "T2_skilled" ? 0.9 : 0.8,
        interAnnotatorAgreement: tier === "T3_specialist" ? 0.94 : tier === "T2_skilled" ? 0.88 : 0.79,
        rejectionRate: tier === "T3_specialist" ? 0.02 : tier === "T2_skilled" ? 0.05 : 0.1,
        appealRate: 0.01, throughput: tier === "T3_specialist" ? 55 : 42,
        rollingAccuracy: tier === "T3_specialist" ? 0.96 : tier === "T2_skilled" ? 0.89 : 0.81,
        windowStart: new Date(Date.now() - 30 * 864e5), windowEnd: new Date(),
      },
    });
    const attempt = await prisma.qualificationTestAttempt.create({
      data: { userId: u.id, trackId: track.id, testTrack: "standard", score: tier === "T3_specialist" ? 96 : tier === "T2_skilled" ? 88 : 74, passed: true, attemptedAt: new Date() },
    });
    await prisma.qualification.create({
      data: { userId: u.id, trackId: track.id, tier, status: "active", verifiedAt: new Date(), sourceAttemptId: attempt.id, recertDueAt: new Date(Date.now() + 150 * 864e5) },
    });
    await prisma.questionnaireResponse.create({
      data: {
        userId: u.id,
        answers: { languages: [{ code: lang, proficiency: "Professional fluency" }, { code: "English", proficiency: "Professional fluency" }], domains: [track.domain] },
        calibrationScores: { [track.domain]: 85 },
        selfRatings: { [track.domain]: "Moderate" },
        routedTracks: { [track.domain]: "standard" },
        mismatchFlag: false,
        completedAt: new Date(),
      },
    });
    for (const type of ["contractor", "nda", "tos", "tax_w8ben"] as const) {
      await prisma.agreement.create({ data: { userId: u.id, type, signatureName: name, documentSnapshot: `${type} signed`, taxData: type === "tax_w8ben" ? { legalName: name, taxId: "••••1234", countryOfResidence: country } : undefined } });
    }
    await prisma.labelStudioAccount.create({ data: { userId: u.id, provisioningStatus: "provisioned", labelStudioUserId: `ls_${u.id.slice(0, 6)}`, labelStudioInstanceUrl: "http://localhost:8080", provisionedAt: new Date() } });
    await prisma.payoutMethod.create({ data: { userId: u.id, provider: "payoneer", accountRef: "••••4321", currency: "USD", isActive: true, verifiedAt: new Date(), sanctionsCleared: true } });
    return u;
  }

  const t1 = await makeAnnotator("t1.text@example.com", "Ana Reyes", "Philippines", "Tagalog", textTrack, "T1_associate");
  const t2 = await makeAnnotator("t2.text@example.com", "Maria Santos", "Mexico", "Spanish", textTrack, "T2_skilled");
  const t3 = await makeAnnotator("t3.text@example.com", "Wei Chen", "Malaysia", "Mandarin", textTrack, "T3_specialist");
  await makeAnnotator("t2.image@example.com", "Ravi Kumar", "India", "Hindi", imageTrack, "T2_skilled");
  await makeAnnotator("t3.llm@example.com", "Amara Okoye", "Nigeria", "English", llmTrack, "T3_specialist");

  // --- Task batches + Label Studio mapping ---------------------------------
  const batchSent = await prisma.taskBatch.create({ data: { trackId: textTrack.id, clientId: "client-a", clientName: "Client A", taskType: "Sentiment tagging", complexityMultiplier: 1.0, estimatedItems: 500, labelStudioProjectId: "ls-proj-101" } });
  const batchMod = await prisma.taskBatch.create({ data: { trackId: textTrack.id, clientId: "client-b", clientName: "Client B", taskType: "Content moderation", complexityMultiplier: 1.2, estimatedItems: 180, labelStudioProjectId: "ls-proj-102" } });
  await prisma.taskBatch.create({ data: { trackId: imageTrack.id, clientId: "client-c", clientName: "Client C", taskType: "Bounding boxes", complexityMultiplier: 1.5, estimatedItems: 320, labelStudioProjectId: "ls-proj-201" } });

  await prisma.labelStudioMapping.create({ data: { trackId: textTrack.id, clientId: "client-a", labelStudioInstanceUrl: "http://localhost:8080", labelStudioProjectId: "ls-proj-101", inviteLink: "http://localhost:8080/invite/abc123", guidelineVersionSynced: 2 } });
  await prisma.labelStudioMapping.create({ data: { trackId: textTrack.id, clientId: "client-b", labelStudioInstanceUrl: "http://localhost:8080", labelStudioProjectId: "ls-proj-102", inviteLink: "http://localhost:8080/invite/def456", guidelineVersionSynced: 2 } });
  await prisma.labelStudioMapping.create({ data: { trackId: imageTrack.id, clientId: "client-c", labelStudioInstanceUrl: "http://localhost:8080", labelStudioProjectId: "ls-proj-201", inviteLink: "http://localhost:8080/invite/ghi789", guidelineVersionSynced: 2 } });

  // --- Payouts: a mix of statuses -----------------------------------------
  const now = new Date();
  // t1: a paid batch, a pending one
  const paidPayout = await prisma.payout.create({ data: { userId: t1.id, taskBatchId: batchSent.id, grossAmount: 92.0, currency: "USD", rateCardVersion: 2, tierMultiplier: 1.0, status: "paid", approvedAt: now, paidAt: new Date(now.getTime() - 2 * 864e5), itemCount: 511 } });
  await prisma.payout.create({ data: { userId: t1.id, taskBatchId: batchMod.id, grossAmount: 39.6, currency: "USD", rateCardVersion: 2, tierMultiplier: 1.0, status: "pending_qa", holdExpiresAt: new Date(now.getTime() + 18 * 3600 * 1000), itemCount: 150 } });

  // t2: approved (available), rejected-with-reason (appealed), and a held one
  await prisma.payout.create({ data: { userId: t2.id, taskBatchId: batchSent.id, grossAmount: 115.0, currency: "USD", rateCardVersion: 2, tierMultiplier: 1.25, status: "approved", approvedAt: now, itemCount: 511 } });
  const rejected = await prisma.payout.create({ data: { userId: t2.id, taskBatchId: batchMod.id, grossAmount: 27.0, currency: "USD", rateCardVersion: 2, tierMultiplier: 1.25, status: "rejected", reasonCode: "below_consensus_threshold", itemCount: 100 } });
  await prisma.payout.create({ data: { userId: t2.id, taskBatchId: batchSent.id, grossAmount: 44.0, currency: "USD", rateCardVersion: 2, tierMultiplier: 1.25, status: "held", holdExpiresAt: new Date(now.getTime() - 3600 * 1000), itemCount: 200 } });

  // Appeal on t2's rejected payout
  await prisma.appeal.create({
    data: { payoutId: rejected.id, userId: t2.id, reasonCode: "below_consensus_threshold", explanation: "Two other annotators disagreed but the guideline example matches my labels exactly — please re-check items 14–22.", status: "open", slaDueAt: new Date(now.getTime() + 2 * 864e5) },
  });
  await prisma.reviewFlag.create({ data: { userId: t2.id, type: "appeal", context: { payoutId: rejected.id }, note: "Payout appeal awaiting response." } });

  // t3: a guideline_violation rejection with detail
  await prisma.payout.create({ data: { userId: t3.id, taskBatchId: batchMod.id, grossAmount: 12.0, currency: "USD", rateCardVersion: 2, tierMultiplier: 1.5, status: "rejected", reasonCode: "guideline_violation", reasonDetail: "rule_2_label_intent_not_surface", itemCount: 40 } });

  // --- Standalone review flags for the admin queue -------------------------
  await prisma.reviewFlag.create({ data: { userId: t1.id, type: "self_report_mismatch", context: { domains: ["image"], calibrationScores: { image: 25 } }, note: "Self-rating 'Extensive' with 25% calibration on image." } });
  await prisma.reviewFlag.create({ data: { userId: t3.id, type: "identity_reverification", context: { certifications: "Registered nurse" }, note: "Claimed credential — verify before T3 medical track." } });

  // --- A cohort assembled by the PM for a client project -------------------
  const cohort = await prisma.cohort.create({
    data: {
      name: "Client A — Spanish sentiment surge",
      description: "T2+ Spanish/English annotators for Client A's 48h sentiment push.",
      clientName: "Client A", status: "assigned", taskBatchId: batchSent.id, createdById: pm.id,
      criteria: { track: "text_nlp", minTier: "T2_skilled", languages: ["Spanish"], surgeOptIn: true },
    },
  });
  await prisma.cohortMember.create({ data: { cohortId: cohort.id, userId: t2.id, status: "confirmed" } });
  await prisma.cohortMember.create({ data: { cohortId: cohort.id, userId: t3.id, status: "confirmed" } });

  // --- A completed payout run sweeping the paid payout ---------------------
  const run = await prisma.payoutRun.create({
    data: {
      periodStart: new Date(now.getTime() - 9 * 864e5), periodEnd: new Date(now.getTime() - 2 * 864e5),
      status: "completed", cadence: "weekly", totalAmount: 92.0, payoutCount: 1,
      approvedById: admin.id, approvedAt: new Date(now.getTime() - 2 * 864e5), executedAt: new Date(now.getTime() - 2 * 864e5),
    },
  });
  await prisma.payout.update({ where: { id: paidPayout.id }, data: { payoutRunId: run.id } });

  console.log("Seed complete. Demo login password for all accounts: " + PASSWORD);
  console.log("  admin@valtaris.ai (admin) · ops@valtaris.ai (ops) · pm@valtaris.ai (project manager)");
  console.log("  t2.text@example.com (annotator with earnings + appeal)");
  console.log("  applicant@example.com (fresh funnel) · dormant@example.com (11.5mo idle)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
