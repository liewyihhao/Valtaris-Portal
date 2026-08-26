// =============================================================================
// READY-TO-PASTE — Portal ingest endpoint for Website applications.
//
// COPY this file into the Portal repo (liewyihhao/Valtaris-Portal) at:
//     app/api/ingest/applications/route.ts
//
// It implements the contract in the Website's docs/portal-integration.md:
// verifies the Bearer token, validates the payload, stores the CV privately,
// creates a ContributorApplication record, and returns { id, status }.
//
// Requires (Portal side):
//   env  PORTAL_INGEST_TOKEN   — shared secret (must match the Website's value)
//   env  PRIVATE_UPLOAD_DIR    — optional; where CVs are written (default ./private-uploads)
//   a Prisma model — see schema.additions.prisma (adapt to your existing model).
//
// Adjust the two ADAPT blocks below to your project (db import + persistence).
// =============================================================================

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// --- ADAPT #1: import your Prisma client -------------------------------------
import { prisma } from "@/lib/db"; // <-- change to your Prisma client path
// -----------------------------------------------------------------------------

export const runtime = "nodejs"; // needs Node (fs, crypto, Prisma)

const MAX_CV_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED_CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

type IncomingLanguage = {
  languageName?: string;
  proficiency?: string;
  speaking?: string; reading?: string; writing?: string; listening?: string;
  yearsExposure?: string; learnedIn?: string; dialectLocale?: string;
  isStrongest?: boolean;
};

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  // --- 1. Auth: Bearer token -------------------------------------------------
  const expected = process.env.PORTAL_INGEST_TOKEN;
  if (!expected) {
    console.error("[ingest] PORTAL_INGEST_TOKEN not set");
    return bad(500, "Server not configured.");
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !timingSafeEqual(token, expected)) {
    return bad(401, "Unauthorized.");
  }

  // --- 2. Parse + validate ---------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid JSON body.");
  }

  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const consent = Boolean(body.consentDataProcessing);

  if (!fullName) return bad(422, "fullName is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(422, "Valid email is required.");
  if (!consent) return bad(422, "consentDataProcessing must be true.");

  const opportunitySlug = body.opportunitySlug ? String(body.opportunitySlug) : null;
  const languages: IncomingLanguage[] = Array.isArray(body.languages)
    ? (body.languages as IncomingLanguage[]).filter((l) => l && l.languageName)
    : [];

  // --- 3. Optional idempotency (dedupe rapid resubmits) ----------------------
  // Skip if you don't need it. Requires a unique-ish lookup on your model.
  // const dupe = await prisma.contributorApplication.findFirst({
  //   where: { email, opportunitySlug, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
  // });
  // if (dupe) return NextResponse.json({ id: dupe.id, status: dupe.status, deduped: true });

  // --- 4. Store the CV privately (never public) ------------------------------
  let resumePath: string | null = null;
  const resumeBase64 = typeof body.resumeBase64 === "string" ? body.resumeBase64 : null;
  const resumeFileName = body.resumeFileName ? String(body.resumeFileName) : null;
  const resumeType = body.resumeType ? String(body.resumeType) : null;

  if (resumeBase64 && resumeFileName) {
    const buf = Buffer.from(resumeBase64, "base64");
    if (buf.length > MAX_CV_BYTES) return bad(413, "Resume exceeds 6MB.");
    if (resumeType && !ALLOWED_CV_TYPES.has(resumeType)) return bad(415, "Unsupported resume type.");

    // ADAPT: in production, upload `buf` to private object storage (S3/GCS/R2)
    // and store the object key instead of a local path.
    const dir = process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads");
    await fs.mkdir(dir, { recursive: true });
    const safe = resumeFileName.replace(/[^a-z0-9._-]/gi, "_");
    const key = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safe}`;
    await fs.writeFile(path.join(dir, key), buf);
    resumePath = key; // store the key/path; serve only via an authenticated route
  }

  // --- ADAPT #2: persist to your database ------------------------------------
  // This uses the suggested `ContributorApplication` model in
  // schema.additions.prisma. Rename / map fields to your existing applicant
  // model as needed. Your funnel/ops can then read from this intake table.
  try {
    const application = await prisma.contributorApplication.create({
      data: {
        source: "valtaris-website",
        opportunitySlug,
        fullName,
        preferredName: str(body.preferredName),
        email,
        phone: str(body.phone),
        country: str(body.country),
        state: str(body.state),
        city: str(body.city),
        timezone: str(body.timezone),
        preferredContact: str(body.preferredContact),
        linkedin: str(body.linkedin),
        portfolio: str(body.portfolio),
        website: str(body.website),
        highestEducation: str(body.highestEducation),
        fieldOfStudy: str(body.fieldOfStudy),
        institution: str(body.institution),
        graduationYear: str(body.graduationYear),
        hasPriorExperience: Boolean(body.hasPriorExperience),
        yearsExperience: str(body.yearsExperience),
        experienceEntries: JSON.stringify(body.experienceEntries ?? []),
        skills: JSON.stringify(body.skills ?? []),
        customSkills: JSON.stringify(body.customSkills ?? []),
        hoursPerWeek: str(body.hoursPerWeek),
        availabilitySlots: JSON.stringify(body.availabilitySlots ?? []),
        startAvailability: str(body.startAvailability),
        openToFuture: body.openToFuture === undefined ? true : Boolean(body.openToFuture),
        resumeFileName,
        resumePath,
        essay: str(body.essay),
        essayQ1: str(body.essayQ1),
        essayQ2: str(body.essayQ2),
        essayQ3: str(body.essayQ3),
        essayQ4: str(body.essayQ4),
        consentDataProcessing: true,
        consentContact: Boolean(body.consentContact),
        status: "NEW",
        languages: {
          create: languages.map((l) => ({
            languageName: String(l.languageName),
            proficiency: l.proficiency ?? "",
            speaking: l.speaking ?? null,
            reading: l.reading ?? null,
            writing: l.writing ?? null,
            listening: l.listening ?? null,
            yearsExposure: l.yearsExposure ?? null,
            learnedIn: l.learnedIn ?? null,
            dialectLocale: l.dialectLocale ?? null,
            isStrongest: Boolean(l.isStrongest),
          })),
        },
      },
    });

    return NextResponse.json({ id: application.id, status: "NEW" }, { status: 201 });
  } catch (e) {
    console.error("[ingest] persistence failed", e);
    return bad(500, "Could not store application.");
  }
  // -----------------------------------------------------------------------------
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
