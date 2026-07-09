import type { Config } from "tailwindcss";
import path from "path";

// Globs absolutos (con forward slashes — fast-glob no acepta backslashes):
// el CSS se genera bien aunque el dev server se lance desde otro directorio.
const abs = (glob: string) => path.join(__dirname, glob).replace(/\\/g, "/");

const config: Config = {
  content: [
    abs("./pages/**/*.{js,ts,jsx,tsx,mdx}"),
    abs("./components/**/*.{js,ts,jsx,tsx,mdx}"),
    abs("./app/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Rosa Bitélica (del logo)
        brand: {
          50: "#FFF0F6",
          100: "#FFE0EC",
          200: "#FFC2D9",
          300: "#FF8FB9",
          400: "#FF5C99",
          500: "#FF2D7D",
          600: "#F01263",
          700: "#D10A54",
          800: "#A80845",
          900: "#7E0634",
        },
      },
    },
  },
  plugins: [],
};
export default config;
