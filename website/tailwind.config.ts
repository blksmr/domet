import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
    "./mdx-components.tsx",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontSize: {
      xs: "12px",
      sm: "13px",
      base: "14px",
      lg: "16px",
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        "sm": "0 8px 16px oklch(0 0 0 / 6%)"
      },
      keyframes: {
        "dropdown-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "dropdown-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
      },
      animation: {
        "dropdown-in": "dropdown-in 150ms ease-out",
        "dropdown-out": "dropdown-out 150ms ease-in",
      },
      colors: {
        text: "var(--text)",
        "muted": "var(--muted)",
        "hover": "var(--hover)",
        border: "var(--border)",
        grey: "var(--grey)",
        primary: "var(--primary)",
        secondary: "var(--background-secondary)",
        background: "var(--background)",
      },
    },
  },
  plugins: [],
} satisfies Config;
