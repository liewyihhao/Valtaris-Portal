import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        base: "#08090C",
        surface: "#0E1015",
        "surface-2": "#14171F",
        elevated: "#181C25",
        // Text
        ink: "#F4F6FA",
        "ink-muted": "#A2A9B8",
        "ink-faint": "#6B7280",
        // Accent — "Valtaris signal"
        accent: {
          DEFAULT: "#5EE0C1",
          soft: "#8EE9D3",
          deep: "#22A88C",
        },
        iris: "#7C9CFF",
        line: "rgba(255,255,255,0.08)",
        "line-strong": "rgba(255,255,255,0.14)",

        // -------------------------------------------------------------------
        // Portal palette (build-prompt Section 3). Backed by CSS variables in
        // globals.css so these stay design tokens, never one-off hex in JSX.
        // Namespaced `p-*` to keep the marketing theme above untouched.
        // -------------------------------------------------------------------
        "p-base": "var(--p-bg-base)",
        "p-surface": "var(--p-bg-surface)",
        "p-surface-2": "var(--p-bg-surface-2)",
        "p-border": "var(--p-border)",
        "p-border-focus": "var(--p-border-focus)",
        "p-primary": "var(--p-text-primary)",
        "p-secondary": "var(--p-text-secondary)",
        "p-disabled": "var(--p-text-disabled)",
        "p-accent": "var(--p-accent)",
        "p-accent-hover": "var(--p-accent-hover)",
        "p-accent-subtle": "var(--p-accent-subtle)",
        success: "var(--p-success)",
        warning: "var(--p-warning)",
        danger: "var(--p-danger)",
        info: "var(--p-info)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        content: "1200px",
        prose: "68ch",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(94,224,193,0.18), 0 20px 60px -20px rgba(94,224,193,0.20)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(8,9,12,0) 0%, #08090C 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "dash-flow": {
          to: { strokeDashoffset: "-16" },
        },
        "pulse-node": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) forwards",
        "dash-flow": "dash-flow 1.2s linear infinite",
        "pulse-node": "pulse-node 3s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
