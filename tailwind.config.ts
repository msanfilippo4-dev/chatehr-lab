import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fordham: {
          maroon: "#8C1515",
          dark: "#6B1010",
          light: "#A52020",
        },
      },
    },
  },
  plugins: [],
};
export default config;
