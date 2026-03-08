import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handlePricesRequest } from "./api/_lib/prices-service";

function pricesApiPlugin() {
  const handleRequest = async (req: { method?: string; url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body: string) => void; statusCode: number }) => {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }

    const url = new URL(req.url ?? "/api/prices", "http://127.0.0.1");
    const result = await handlePricesRequest(url.searchParams.get("tickers") ?? "");

    res.statusCode = result.status;
    for (const [header, value] of Object.entries(result.headers)) {
      res.setHeader(header, value);
    }
    res.end(JSON.stringify(result.payload));
  };

  return {
    name: "prices-api-dev-middleware",
    configureServer(server: { middlewares: { use: (path: string, handler: (req: any, res: any) => Promise<void>) => void } }) {
      server.middlewares.use("/api/prices", async (req, res) => {
        await handleRequest(req, res);
      });
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, handler: (req: any, res: any) => Promise<void>) => void } }) {
      server.middlewares.use("/api/prices", async (req, res) => {
        await handleRequest(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), pricesApiPlugin()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
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
