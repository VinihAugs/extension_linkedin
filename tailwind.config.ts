import type { Config } from "tailwindcss"

export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          950: "#070A12",
          900: "#0B1020",
          800: "#121A33"
        },
        neon: {
          500: "#7C3AED",
          400: "#A78BFA",
          300: "#C4B5FD"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(167,139,250,.25), 0 12px 40px rgba(124,58,237,.25)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" }
        }
      },
      animation: {
        float: "float 3s ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config

