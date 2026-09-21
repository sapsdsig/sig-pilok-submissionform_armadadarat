/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sig: {
          red: "#f4313f",
          dark: "#be1e2d",
        },
        ink: "#17212b",
      },
      boxShadow: {
        card: "0 1px 3px rgba(23, 33, 43, 0.08)",
      },
    },
  },
  plugins: [],
};
