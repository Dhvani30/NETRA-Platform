/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        netra: {
          primary: "var(--ds-color-primary)", secondary: "var(--ds-color-secondary)",
          success: "var(--ds-color-success)", warning: "var(--ds-color-warning)", danger: "var(--ds-color-danger)", info: "var(--ds-color-info)",
          "neutral-900": "var(--ds-color-neutral-900)", "neutral-800": "var(--ds-color-neutral-800)", "neutral-700": "var(--ds-color-neutral-700)", "neutral-500": "var(--ds-color-neutral-500)", "neutral-400": "var(--ds-color-neutral-400)",
          bg: "var(--ds-color-bg)", "bg-mid": "var(--ds-color-bg-mid)", "bg-elevated": "var(--ds-color-bg-elevated)",
          surface: "var(--ds-color-glass)", "surface-hover": "var(--ds-color-glass-hover)", "surface-inner": "var(--ds-color-glass-inner)", "surface-float": "var(--ds-color-glass-float)",
          accent: "var(--ds-color-accent)", "accent-dim": "var(--ds-color-accent-dim)", "accent-bright": "var(--ds-color-accent-bright)", "accent-faint": "var(--ds-color-accent-faint)",
          text: "var(--ds-color-text-1)", "text-muted": "var(--ds-color-text-2)", "text-subtle": "var(--ds-color-text-3)",
          border: "var(--ds-color-border)", "border-bright": "var(--ds-color-border-bright)", "glass-border": "var(--ds-color-glass-border)", "glass-bright": "var(--ds-color-glass-bright)",
          red: "var(--ds-color-red-muted)", amber: "var(--ds-color-amber-muted)", green: "var(--ds-color-green-muted)", blue: "var(--ds-color-blue-muted)", "on-accent": "var(--ds-color-on-accent)",
          "chart-muted-1": "var(--ds-color-chart-muted-1)", "chart-muted-2": "var(--ds-color-chart-muted-2)", "chart-muted-3": "var(--ds-color-chart-muted-3)", "chart-muted-4": "var(--ds-color-chart-muted-4)",
          "metal-light": "var(--ds-color-metal-light)", "metal-mid": "var(--ds-color-metal-mid)", "metal-dark": "var(--ds-color-metal-dark)", "metal-sheen": "var(--ds-color-metal-sheen)",
        },
      },
      fontFamily: {
        "netra-sans": ["var(--ds-font-sans)", "system-ui", "sans-serif"],
        "netra-mono": ["var(--ds-font-mono)", "monospace"],
      },
      fontSize: {
        "ds-7": "var(--ds-type-7)", "ds-8": "var(--ds-type-8)", "ds-9": "var(--ds-type-9)", "ds-10": "var(--ds-type-10)",
        "ds-11": "var(--ds-type-11)", "ds-11.5": "var(--ds-type-11-5)", "ds-12": "var(--ds-type-12)", "ds-12.5": "var(--ds-type-12-5)",
        "ds-13": "var(--ds-type-13)", "ds-14": "var(--ds-type-14)", "ds-15": "var(--ds-type-15)", "ds-16": "var(--ds-type-16)",
        "ds-18": "var(--ds-type-18)", "ds-20": "var(--ds-type-20)", "ds-22": "var(--ds-type-22)", "ds-26": "var(--ds-type-26)",
        "ds-28": "var(--ds-type-28)", "ds-30": "var(--ds-type-30)", "ds-36": "var(--ds-type-36)", "ds-48": "var(--ds-type-48)",
      },
      spacing: {
        "ds-1": "var(--ds-space-1)", "ds-2": "var(--ds-space-2)", "ds-3": "var(--ds-space-3)", "ds-4": "var(--ds-space-4)",
        "ds-5": "var(--ds-space-5)", "ds-6": "var(--ds-space-6)", "ds-7": "var(--ds-space-7)", "ds-8": "var(--ds-space-8)",
        "ds-10": "var(--ds-space-10)", "ds-12": "var(--ds-space-12)", "ds-14": "var(--ds-space-14)", "ds-16": "var(--ds-space-16)",
        "ds-18": "var(--ds-space-18)", "ds-20": "var(--ds-space-20)", "ds-24": "var(--ds-space-24)", "ds-28": "var(--ds-space-28)",
        "ds-32": "var(--ds-space-32)", "ds-36": "var(--ds-space-36)", "ds-40": "var(--ds-space-40)", "ds-48": "var(--ds-space-48)",
        "ds-52": "var(--ds-space-52)", "ds-56": "var(--ds-space-56)", "ds-64": "var(--ds-space-64)", "ds-72": "var(--ds-space-72)",
        "ds-80": "var(--ds-space-80)", "ds-88": "var(--ds-space-88)", "ds-100": "var(--ds-space-100)",
      },
      borderRadius: {
        "ds-xs": "var(--ds-radius-xs)", "ds-sm": "var(--ds-radius-sm)", "ds-md": "var(--ds-radius-md)", "ds-nav": "var(--ds-radius-nav)", "ds-card": "var(--ds-radius-card)", "ds-pill": "var(--ds-radius-pill)",
      },
      boxShadow: {
        "ds-glass": "var(--ds-shadow-glass)", "ds-glass-hover": "var(--ds-shadow-glass-hover)", "ds-float": "var(--ds-shadow-float)", "ds-metal-button": "var(--ds-shadow-metal-button)",
      },
      lineHeight: {
        "ds-tight": "var(--ds-leading-tight)", "ds-snug": "var(--ds-leading-snug)", "ds-normal": "var(--ds-leading-normal)",
        "ds-relaxed": "var(--ds-leading-relaxed)", "ds-readable": "var(--ds-leading-readable)", "ds-comfortable": "var(--ds-leading-comfortable)", "ds-loose": "var(--ds-leading-loose)",
      },
      letterSpacing: {
        "ds-tight": "var(--ds-tracking-tight)", "ds-display": "var(--ds-tracking-display)", "ds-label": "var(--ds-tracking-label)", "ds-wide": "var(--ds-tracking-wide)",
      },
      screens: { mobile: "600px", tablet: "900px" },
    },
  },
  plugins: [],
}
