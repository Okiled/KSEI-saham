import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("pdfjs-dist")) return "pdfjs";
          if (id.includes("d3-")) return "d3";
          if (id.includes("@radix-ui") || id.includes("cmdk")) return "ui-vendor";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("react-router-dom")) return "router";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("scheduler")) return "react";
        },
      },
    },
  },
});
