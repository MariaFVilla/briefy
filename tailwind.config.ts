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
      },
    },
  },
  plugins: [],
};
export default config;
