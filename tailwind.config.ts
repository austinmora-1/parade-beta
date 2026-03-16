import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        activity: {
          food: "hsl(var(--activity-food))",
          coffee: "hsl(var(--activity-coffee))",
          drinks: "hsl(var(--activity-drinks))",
          workout: "hsl(var(--activity-workout))",
          misc: "hsl(var(--activity-misc))",
          "me-time": "hsl(var(--activity-me-time))",
          chores: "hsl(var(--activity-chores))",
          reading: "hsl(var(--activity-reading))",
          watching: "hsl(var(--activity-watching))",
          events: "hsl(var(--activity-events))",
          errands: "hsl(var(--activity-errands))",
          movies: "hsl(var(--activity-movies))",
          shopping: "hsl(var(--activity-shopping))",
          doctor: "hsl(var(--activity-doctor))",
        },
        availability: {
          available: "hsl(var(--available))",
          "available-light": "hsl(var(--available-light))",
          partial: "hsl(var(--partial))",
          "partial-light": "hsl(var(--partial-light))",
          busy: "hsl(var(--busy))",
          "busy-light": "hsl(var(--busy-light))",
          today: "hsl(var(--today))",
          away: "hsl(var(--away))",
          "away-light": "hsl(var(--away-light))",
          "away-foreground": "hsl(var(--away-foreground))",
        },
        vibe: {
          social: "hsl(var(--vibe-social))",
          chill: "hsl(var(--vibe-chill))",
          athletic: "hsl(var(--vibe-athletic))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        soft: "var(--shadow-md)",
        glow: "var(--shadow-glow)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "marquee": {
          "0%, 5%": { transform: "translateX(0)" },
          "45%, 55%": { transform: "translateX(var(--marquee-distance))" },
          "95%, 100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "bounce-soft": "bounce-soft 2s ease-in-out infinite",
        "marquee": "marquee var(--marquee-duration, 10s) ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
