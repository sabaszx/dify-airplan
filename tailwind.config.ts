import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Original, accessible palette (not any vendor brand palette)
        base: {
          bg: "#0f1420",
          panel: "#171d2b",
          border: "#273043",
          text: "#e6ebf5",
          muted: "#9aa7bd",
        },
        accent: {
          DEFAULT: "#3b82f6",
          soft: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
