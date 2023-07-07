import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
const colours = require("tailwindcss/colors");

module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    colors: {
      primary: "#100030",
      secondary: "#301E67",
      tertiary: "#170d36",
      white: "#ffffff",
      code_bg: "#24292e"
      // primary: '#271b48'
    },
    extend: { 
      colors: colors
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
