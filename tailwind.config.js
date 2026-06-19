/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        sidebar: 'hsl(var(--sidebar) / <alpha-value>)',
        'sidebar-border': 'hsl(var(--sidebar-border) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        text: 'hsl(var(--text) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)', 
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)', 
        },
        border: 'hsl(var(--border) / <alpha-value>)', 
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Instrument Serif', 'serif'],
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'premium': '0 20px 40px -10px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02)',
        'premium-hover': '0 30px 60px -12px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.03)',
      }
    },
  },
  plugins: [],
}
