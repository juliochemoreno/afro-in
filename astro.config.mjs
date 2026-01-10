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
    },
  }),
});
