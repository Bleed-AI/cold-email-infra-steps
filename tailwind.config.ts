import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          950: "#050608",
          900: "#0a0c10",
          800: "#0f1218",
          700: "#161a23",
          600: "#1f2533",
        },
        accent: {
          DEFAULT: "#7cf5d0",
          500: "#7cf5d0",
          400: "#a4ffe1",
          600: "#3fd7ad",
        },
        violet: {
          glow: "#7c5cff",
        },
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        gridMove: {
          "0%": { transform: "translate(0,0)" },
          "100%": { transform: "translate(40px,40px)" },
        },
      },
      animation: {
        floaty: "floaty 4s ease-in-out infinite",
        pulseRing: "pulseRing 2.4s ease-out infinite",
        shimmer: "shimmer 3s linear infinite",
        gridMove: "gridMove 12s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
