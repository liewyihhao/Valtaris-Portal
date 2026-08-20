// Lightweight option lists for selects. Not exhaustive — enough for a working
// portal. Region eligibility is a stub check (see lib/portal/eligibility.ts).

export const COUNTRIES = [
  "Malaysia", "Indonesia", "Philippines", "Vietnam", "Thailand", "India",
  "Bangladesh", "Pakistan", "Nigeria", "Kenya", "Egypt", "Brazil", "Mexico",
  "Argentina", "United States", "United Kingdom", "Germany", "France", "Spain",
  "Poland", "Japan", "South Korea", "Other",
];

export const LANGUAGES = [
  "English", "Malay", "Indonesian", "Tagalog", "Vietnamese", "Thai", "Hindi",
  "Bengali", "Urdu", "Mandarin", "Spanish", "Portuguese", "French", "German",
  "Japanese", "Korean", "Arabic", "Swahili", "Other",
];

export const PROFICIENCIES = ["Native", "Professional fluency", "Conversational"] as const;
export const SELF_RATINGS = ["Extensive", "Moderate", "Basic", "None"] as const;

// Countries under sanctions/denied-party screening — stub list for the demo.
// A real deployment wires a screening provider (see lib/portal/screening.ts).
export const RESTRICTED_REGIONS = ["North Korea", "Iran", "Syria", "Cuba"];
