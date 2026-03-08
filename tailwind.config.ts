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
        muted3: "rgb(var(--text-quaternary) / <alpha-value>)",
        panel: "rgb(var(--bg-surface-1) / <alpha-value>)",
        "panel-2": "rgb(var(--bg-surface-2) / <alpha-value>)",
        "panel-3": "rgb(var(--bg-surface-3) / <alpha-value>)",
        border: "rgb(var(--border-subtle) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        teal: "rgb(var(--teal) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        rose: "rgb(var(--rose) / <alpha-value>)",
        violet: "rgb(var(--violet) / <alpha-value>)",
        blue: "rgb(var(--blue) / <alpha-value>)",
        pine: "rgb(var(--teal) / <alpha-value>)",
        bronze: "rgb(var(--amber) / <alpha-value>)",
        oxblood: "rgb(var(--rose) / <alpha-value>)",
        plum: "rgb(var(--violet) / <alpha-value>)",
        local: "rgb(var(--accent-local) / <alpha-value>)",
        foreign: "rgb(var(--accent-foreign) / <alpha-value>)",
        unknown: "rgb(var(--accent-unknown) / <alpha-value>)",
        focus: "rgb(var(--accent-focus) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",

        // backward compatible aliases
        cyan: "rgb(var(--teal) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
        "serif-display": ["Fraunces", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glowCyan: "0 0 0 1px rgba(29,76,69,0.24), 0 18px 40px rgba(95,73,47,0.1)",
        glowPurple: "0 0 0 1px rgba(104,82,97,0.22), 0 18px 40px rgba(95,73,47,0.1)",
        panel: "0 20px 50px rgba(95,73,47,0.1)",
      },
      backgroundImage: {
        nebula:
          "radial-gradient(circle at 15% 10%, rgba(153,103,55,0.18), transparent 28%), radial-gradient(circle at 85% 6%, rgba(29,76,69,0.14), transparent 22%), radial-gradient(circle at 50% 95%, rgba(104,82,97,0.1), transparent 28%)",
      },
      borderRadius: {
        xl: "var(--radius)",
      },
      transitionTimingFunction: {
        "expo-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        rowSlideIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        cellFadeIn: {
          to: { opacity: "1" },
        },
        cellGrow: {
          to: { opacity: "1", transform: "scale(1)" },
        },
        barSlide: {
          to: { transform: "scaleX(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "row-slide": "rowSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "cell-fade": "cellFadeIn 0.3s ease forwards",
        "cell-grow": "cellGrow 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "bar-slide": "barSlide 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  plugins: [],
};

export default config;
