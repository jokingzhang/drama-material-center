import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { knowledgeCaseMediaPlugin } from "./server/knowledgeCaseMedia.ts";
import { materialLibraryPlugin } from "./server/materialLibraryPlugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    appType: "spa",
    test: {
      // Skill suites use node:test and run through test:skills.
      exclude: [...configDefaults.exclude, "**/.agents/**"],
    },
    plugins: [
      react(),
      materialLibraryPlugin({ workspaceRoot: env.MATERIAL_CENTER_WORKSPACE }),
      knowledgeCaseMediaPlugin(),
    ],
    server: {
      host: "127.0.0.1",
      port: 4373,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 4374,
      strictPort: true,
    },
  };
});
