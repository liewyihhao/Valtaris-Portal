// Email sending for the whole portal (verification, approvals, project setup,
// dormancy, notifications). Dependency-free: uses the Resend HTTP API when
// configured, otherwise logs to the console (dev / unconfigured). Never throws —
// a mail failure must not break the flow that triggered it.
//
// Enable real sending by setting in .env:
//   EMAIL_PROVIDER="resend"                (optional; auto-selected if key present)
//   RESEND_API_KEY="re_…"
//   EMAIL_FROM="Valtaris <noreply@yourdomain>"   (must be a verified sender)
// For a different provider (SMTP/SES/Postmark), swap the transport in sendVia*.

export interface EmailMessage {
  to: string;
  subject: string;
  body: string; // plain text
  html?: string; // optional; a minimal wrapper is generated when omitted
}

export type EmailResult = { sent: boolean; provider: string; error?: string };

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "Valtaris <onboarding@resend.dev>";
}

// Minimal, safe HTML rendering of a plain-text body (escaped, newlines → <br>).
function renderHtml(subject: string, body: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body style="margin:0;background:#0b1220;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#111a2e;border:1px solid #22304d;border-radius:12px;overflow:hidden">
    <div style="padding:16px 24px;border-bottom:1px solid #22304d;font-weight:700;letter-spacing:.04em;color:#7fe0c8">VALTARIS</div>
    <div style="padding:24px;color:#dbe4f0;font-size:14px;line-height:1.6">
      <h1 style="margin:0 0 12px;font-size:18px;color:#fff">${esc(subject)}</h1>
      <div style="white-space:pre-wrap">${esc(body)}</div>
    </div>
  </div></body></html>`;
}

async function sendViaResend(msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY!;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: [msg.to],
      subject: msg.subject,
      text: msg.body,
      html: msg.html ?? renderHtml(msg.subject, msg.body),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300));
  }
}

function selectedProvider(): "resend" | "console" {
  const explicit = process.env.EMAIL_PROVIDER;
  if (explicit === "resend") return "resend";
  if (explicit === "console") return "console";
  return process.env.RESEND_API_KEY ? "resend" : "console";
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = selectedProvider();
  if (provider === "resend" && process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(msg);
      return { sent: true, provider: "resend" };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[email] resend failed, falling back to console: ${error}`);
      console.log(`[email:console] → ${msg.to} :: ${msg.subject}\n${msg.body}`);
      return { sent: false, provider: "console", error };
    }
  }
  // Console fallback (dev / no key). Full body logged so dev flows are visible.
  console.log(`[email:console] → ${msg.to} :: ${msg.subject}\n${msg.body}`);
  return { sent: false, provider: "console" };
}
