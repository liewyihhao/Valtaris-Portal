// ---------------------------------------------------------------------------
// i18n CONTENT LAYER — GROUNDWORK (master design §6).
//
// English ships first, but all worker-facing copy is routed through this layer
// now so later localization is "add a catalog file", not "rewrite hardcoded
// strings across the app". A message is a template keyed by a stable id;
// `t(key, vars)` looks it up and interpolates {placeholders}.
//
// To add a locale later: create lib/portal/messages/<locale>.ts exporting the
// same keys, register it in CATALOGS, and map languages to it in
// localeForLanguage(). No call site changes.
// ---------------------------------------------------------------------------

import { en } from "./messages/en";

export type Locale = "en";
export const DEFAULT_LOCALE: Locale = "en";

export type MessageKey = keyof typeof en;

const CATALOGS: Record<Locale, Record<string, string>> = { en };

/**
 * Resolve a supported locale from a user's primary language. Only English is
 * supported today, so everything falls back to DEFAULT_LOCALE — but this is the
 * single place that mapping will grow (e.g. "Spanish" → "es") when catalogs
 * are added, so no call site needs to change.
 */
export function localeForLanguage(_primaryLanguage?: string | null): Locale {
  return DEFAULT_LOCALE;
}

/** Interpolate {name} placeholders from `vars` into a template string. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/**
 * Translate a message key with optional interpolation vars. Falls back to the
 * English catalog, then to the raw key (so a missing message is visible in dev
 * rather than silently blank). Pure — unit-testable.
 */
export function t(key: MessageKey, vars?: Record<string, string | number>, locale: Locale = DEFAULT_LOCALE): string {
  const template = CATALOGS[locale]?.[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
  return interpolate(template, vars);
}
