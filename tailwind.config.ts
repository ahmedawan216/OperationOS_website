import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

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
        "accent-dim": "var(--color-accent-dim)",
        "accent-soft": "var(--color-accent-soft)",

        // Status
        success: "var(--color-success)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      maxWidth: {
        wrap: "1120px",
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
        "pulse-dot": {
          "0%": { boxShadow: "0 0 0 0 rgba(52,211,153,0.5)" },
          "70%": { boxShadow: "0 0 0 6px rgba(52,211,153,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52,211,153,0)" },
        },
        // The animated dot that travels down each <Rail /> connector.
        // Pure CSS (matching the originally-approved prototype) instead
        // of a JS/Framer Motion loop: no "use client" boundary needed,
        // runs on the compositor thread, and is free to pause/resume via
        // the page's existing prefers-reduced-motion override.
        "rail-travel": {
          "0%": { top: "0%", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { top: "100%", opacity: "0" },
        },
        // Hero's above-the-fold entrance. Deliberately plain CSS (not
        // Framer Motion) so the headline never depends on JS hydration
        // or an IntersectionObserver round-trip before it can paint —
        // it's likely the page's LCP element.
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
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
        "pulse-dot": "pulse-dot 2s infinite",
        "rail-travel": "rail-travel 3.2s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      boxShadow: {
        panel: "0 40px 80px -30px rgba(0,0,0,0.6)",
        lift: "0 8px 22px rgba(255,255,255,0.10)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
