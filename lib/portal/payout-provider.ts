import type { PayoutProvider as Provider } from "./constants";

// Provider-interface abstraction. The actual money movement is mocked here —
// wire a real Payoneer/Wise/bank integration behind this interface later.
export interface PayoutRail {
  // Returns a provider-side payment id on success.
  send(params: { amount: number; currency: string; accountRef: string }): Promise<{ paymentId: string }>;
  // Fee preview shown BEFORE the annotator confirms (no surprise deductions).
  quoteFee(amount: number): { feeAmount: number; note: string };
}

export function getPayoutRail(_provider: Provider): PayoutRail {
  return {
    async send({ amount, currency }) {
      // TODO: wire real payout provider (Payoneer primary; Wise/bank fallback).
      return { paymentId: `mock_${currency}_${Math.round(amount * 100)}_${Date.now()}` };
    },
    quoteFee(amount) {
      // Flat $1.50 + 0% FX markup, mirroring the Payoneer example in the spec.
      const feeAmount = Math.min(1.5, amount);
      return { feeAmount, note: "~$1.50 flat + 0% FX markup (mid-market rate)" };
    },
  };
}
