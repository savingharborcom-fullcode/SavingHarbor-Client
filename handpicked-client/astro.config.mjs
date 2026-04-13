import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";
import react from '@astrojs/react';
import critters from "astro-critters"

export default defineConfig({
  output: "server",
  adapter: vercel(),
  site: "https://www.savingharbor.com",
  integrations: [tailwind(),react(), critters()],
});
