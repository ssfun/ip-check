/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-bg': '#f0f4f1',
                'brand-green-light': '#e6f4ea',
                'brand-green-dark': '#1a4d2e',
                'brand-accent': '#4caf50',
            }
        },
    },
    plugins: [],
}
