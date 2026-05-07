import type { Config } from "tailwindcss"
import defaultTheme from "tailwindcss/defaultTheme"
import tailwindcssAnimate from "tailwindcss-animate"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        armath: {
          blue: "#3EC1CF",
          red: "#A4237E",
          black: "#231F20",
          gray: "#A7A9AB",
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config

export default config
