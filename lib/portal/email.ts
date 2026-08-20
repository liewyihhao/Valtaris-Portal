// Email sending — stub. Wire a real provider (Resend / SES / Postmark) here.
// Used for verification, dormancy re-engagement, and payout notices.
export interface EmailProvider {
  send(msg: { to: string; subject: string; body: string }): Promise<void>;
}

export const stubEmailProvider: EmailProvider = {
  async send(msg) {
    // TODO: wire a real email provider. For now, log so dev flows are visible.
    console.log(`[email:stub] → ${msg.to} :: ${msg.subject}`);
  },
};

export async function sendEmail(msg: { to: string; subject: string; body: string }) {
  return stubEmailProvider.send(msg);
}
