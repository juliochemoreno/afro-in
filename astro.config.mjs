// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: "https://afroin.org",
  output: "static", // Default in Astro 5, encompasses previous 'hybrid' behavior

  i18n: {
    defaultLocale: "es",
    locales: ["es", "en", "fr"],
    routing: {
      prefixDefaultLocale: false,
    },
  },


  // The 2026 edition moved under /2026/ when the 2027 programming launched.
  redirects: {
    "/programacion/santa-marta": { status: 301, destination: "/programacion/2026/santa-marta" },
    "/programacion/palenque": { status: 301, destination: "/programacion/2026/palenque" },
    "/en/program/santa-marta": { status: 301, destination: "/en/program/2026/santa-marta" },
    "/en/program/palenque": { status: 301, destination: "/en/program/2026/palenque" },
    "/fr/programme/santa-marta": { status: 301, destination: "/fr/programme/2026/santa-marta" },
    "/fr/programme/palenque": { status: 301, destination: "/fr/programme/2026/palenque" },
    "/programacion/2027": { status: 301, destination: "/programacion" },
    "/en/program/2027": { status: 301, destination: "/en/program" },
    "/fr/programme/2027": { status: 301, destination: "/fr/programme" },
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },

  build: {
    inlineStylesheets: "always",
  },

  server: {
    host: true,
    port: 4321,
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  },

  integrations: [mdx(), sitemap(), react()],

  adapter: cloudflare({
    imageService: "compile",
    platformProxy: {
      enabled: true,
      environment: "local",
    },
  }),
});
