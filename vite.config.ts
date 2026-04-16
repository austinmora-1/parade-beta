import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;

          // Heavy on-demand libs — isolate so they only load when used
          if (id.includes("html2canvas")) return "html2canvas";
          if (id.includes("react-image-crop")) return "image-crop";
          if (id.includes("canvas-confetti")) return "confetti";
          if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-")) return "markdown";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("embla-carousel")) return "carousel";

          // Core vendor chunks
          if (id.includes("framer-motion")) return "framer-motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react-router")) return "router";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
}));
