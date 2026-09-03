import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

import { EASE_OUT_EXPO } from "./lib/motion";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        bg: "var(--color-bg)",
        "bg-secondary": "var(--color-bg-secondary)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",

        // Borders
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",

        // Text
        ink: "var(--color-ink)",
        "ink-dim": "var(--color-ink-dim)",
        "ink-faint": "var(--color-ink-faint)",

        // Brand accent
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-dim": "var(--color-accent-dim)",
        "accent-soft": "var(--color-accent-soft)",

        // Status
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      maxWidth: {
        wrap: "1120px",
        wide: "1320px",
        reading: "720px",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      transitionTimingFunction: {
        // Built from the same tuple Framer Motion uses (see lib/motion.ts)
        // so the CSS and JS animation curves can never drift apart.
        "out-expo": `cubic-bezier(${EASE_OUT_EXPO.join(",")})`,
      },
      transitionDuration: {
        "250": "250ms",
        "400": "400ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      boxShadow: {
        panel: "var(--shadow-overlay)",
        lift: "var(--shadow-raised)",
      },
    },
  },
  plugins: [typography],
};

export default config;
