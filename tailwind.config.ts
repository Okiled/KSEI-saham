import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--bg-canvas) / <alpha-value>)",
        foreground: "rgb(var(--text-primary) / <alpha-value>)",
        muted: "rgb(var(--text-secondary) / <alpha-value>)",
        muted2: "rgb(var(--text-tertiary) / <alpha-value>)",
        panel: "rgb(var(--bg-surface-1) / <alpha-value>)",
        "panel-2": "rgb(var(--bg-surface-2) / <alpha-value>)",
        "panel-3": "rgb(var(--bg-surface-3) / <alpha-value>)",
        border: "rgb(var(--border-subtle) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        local: "rgb(var(--accent-local) / <alpha-value>)",
        foreign: "rgb(var(--accent-foreign) / <alpha-value>)",
        unknown: "rgb(var(--accent-unknown) / <alpha-value>)",
        focus: "rgb(var(--accent-focus) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",

        // backward compatible aliases
        cyan: "rgb(var(--accent-local) / <alpha-value>)",
        purple: "rgb(var(--accent-foreign) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glowCyan: "0 0 0 1px rgba(85,186,171,0.35), 0 10px 32px rgba(0,0,0,0.34)",
        glowPurple: "0 0 0 1px rgba(131,144,222,0.35), 0 10px 32px rgba(0,0,0,0.34)",
        panel: "0 12px 32px rgba(0,0,0,0.26)",
      },
      backgroundImage: {
        nebula:
          "radial-gradient(circle at 15% 10%, rgba(130,150,190,0.12), transparent 28%), radial-gradient(circle at 85% 6%, rgba(95,125,190,0.1), transparent 22%), radial-gradient(circle at 50% 95%, rgba(100,120,170,0.08), transparent 28%)",
      },
      borderRadius: {
        xl: "var(--radius)",
      },
    },
  },
  plugins: [],
};

export default config;
