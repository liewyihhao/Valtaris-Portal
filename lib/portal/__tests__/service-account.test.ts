import { describe, it, expect } from "vitest";
import {
  generateKey,
  hashKey,
  keyPrefixFor,
  hasScope,
  sanitizeScopes,
  extractKey,
  KEY_PREFIX,
} from "../service-account";

describe("service-account key helpers (§9)", () => {
  it("generates prefixed, unique keys", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a.startsWith(KEY_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("hashes deterministically and never returns the raw key", () => {
    const key = "vlt_deadbeef";
    expect(hashKey(key)).toBe(hashKey(key));
    expect(hashKey(key)).not.toContain("deadbeef");
    expect(hashKey(key)).toHaveLength(64); // sha256 hex
  });

  it("derives a short non-secret prefix", () => {
    const key = "vlt_0123456789abcdef";
    expect(keyPrefixFor(key)).toBe("vlt_012345");
    expect(key.startsWith(keyPrefixFor(key))).toBe(true);
  });
});

describe("service-account scopes", () => {
  it("checks a required scope against the granted CSV", () => {
    expect(hasScope("worksummary:write,standing:read", "standing:read")).toBe(true);
    expect(hasScope("standing:read", "worksummary:write")).toBe(false);
    expect(hasScope("", "standing:read")).toBe(false);
  });

  it("drops unknown scopes when sanitizing", () => {
    expect(sanitizeScopes(["standing:read", "delete:everything", "worksummary:write"])).toEqual([
      "standing:read",
      "worksummary:write",
    ]);
    expect(sanitizeScopes(["nope"])).toEqual([]);
  });
});

describe("extractKey", () => {
  it("reads a Bearer token", () => {
    const req = new Request("https://x/y", { headers: { authorization: "Bearer vlt_abc" } });
    expect(extractKey(req)).toBe("vlt_abc");
  });

  it("reads an X-Api-Key header", () => {
    const req = new Request("https://x/y", { headers: { "x-api-key": "vlt_xyz" } });
    expect(extractKey(req)).toBe("vlt_xyz");
  });

  it("returns null when absent", () => {
    expect(extractKey(new Request("https://x/y"))).toBeNull();
  });
});
