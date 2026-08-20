// PLACEHOLDER agreement text — replace with reviewed legal copy before launch.
// Each is shown in full and individually e-signed (not a checkbox-with-a-link).

export const AGREEMENT_DOCS = {
  contractor: {
    title: "Independent Contractor Agreement",
    body: `PLACEHOLDER — replace with reviewed legal text before launch.

This Independent Contractor Agreement is between Valtaris ("Company") and you ("Contractor").

1. Relationship. You are an independent contractor, not an employee. You control how and when you perform accepted tasks and may accept or decline any task batch.

2. Services. You will label/annotate data according to the applicable guidelines for each qualified track. AI-assisted or automated answers are prohibited on all tasks.

3. Compensation. You are paid on a piece-rate basis: base rate × task complexity × your verified tier multiplier, subject to the published quality-check and payout terms.

4. No guarantee of work. The Company does not guarantee any minimum volume of tasks.

5. Term & termination. Either party may end this agreement at any time. Confirmed policy violations may result in account deactivation, which is separately appealable.`,
  },
  nda: {
    title: "NDA & Data-Handling Agreement",
    body: `PLACEHOLDER — replace with reviewed legal text before launch.

1. Confidential information. In performing tasks you may access client data, some of it sensitive. You must keep it strictly confidential.

2. No copying or retention. You will not download, copy, screenshot, transmit, or retain any client data outside the approved tools.

3. Personal data. Where tasks contain personal data, you will process it only as instructed and never for your own purposes.

4. Security. You will use a secure device and network, and report any suspected data exposure immediately.

5. Survival. These obligations survive the end of your engagement.`,
  },
  tos: {
    title: "Platform Terms of Service",
    body: `PLACEHOLDER — replace with reviewed legal text before launch.

1. Account. One account per person. Multi-accounting, automation, and identity misuse are prohibited.

2. Payments. Every pay reduction, rejection, or clawback carries a specific reason code and is appealable within the published SLA.

3. Quality. Ongoing accuracy monitoring (including hidden gold tasks) may affect task eligibility.

4. Acceptable use. You will follow all guidelines and applicable law.

5. Changes. Material changes to these terms will be re-presented for acknowledgment.`,
  },
} as const;

export type AgreementKey = keyof typeof AGREEMENT_DOCS;
