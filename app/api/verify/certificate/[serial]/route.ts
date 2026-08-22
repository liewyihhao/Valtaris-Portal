import { NextResponse } from "next/server";
import { verifyCertificate } from "@/lib/portal/certificate";

// Public certificate verification by serial — no auth (this is the point).
// Returns only non-sensitive fields; 404 for an unknown serial.
export async function GET(_req: Request, ctx: { params: Promise<{ serial: string }> }) {
  const { serial } = await ctx.params;
  const result = await verifyCertificate(serial);
  if (!result.found) {
    return NextResponse.json({ found: false, error: "No certificate with that serial." }, { status: 404 });
  }
  return NextResponse.json(result);
}
