// Pluggable identity/KYC verification. Interface + a stub so a real provider
// (Onfido / Persona / Sumsub) can be wired later. Valtaris stores ONLY the
// pass/fail result + a provider reference — never the raw ID/biometric data.

import { KYC_ID_BIOMETRIC_TIER, type KycLevel, type Tier } from "./constants";

export interface KycProvider {
  // Kicks off an ID + biometric (liveness) check; returns a provider reference.
  startIdBiometric(input: { userId: string }): Promise<{ providerRef: string }>;
}

export const stubKycProvider: KycProvider = {
  async startIdBiometric({ userId }) {
    // TODO: wire a real KYC provider (Onfido/Persona/Sumsub) and a webhook that
    // flips TrustProfile.idVerifiedAt / biometricVerifiedAt on completion.
    return { providerRef: `kyc_stub_${userId.slice(0, 8)}` };
  },
};

export function getKycProvider(): KycProvider {
  return stubKycProvider;
}

// Does a given tier require the deepest (ID + biometric) verification?
export function requiresIdBiometric(tier: Tier): boolean {
  const order = ["T0_trainee", "T1_associate", "T2_skilled", "T3_specialist"];
  return order.indexOf(tier) >= order.indexOf(KYC_ID_BIOMETRIC_TIER);
}

// Is this annotator's KYC sufficient for the tier they hold?
export function kycSatisfiesTier(kycLevel: KycLevel, highestTier: Tier): boolean {
  if (requiresIdBiometric(highestTier)) return kycLevel === "id_biometric";
  return kycLevel === "email_phone" || kycLevel === "id_biometric";
}
