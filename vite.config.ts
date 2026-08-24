import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { materialLibraryPlugin } from "./server/materialLibraryPlugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    appType: "spa",
    plugins: [react(), materialLibraryPlugin({ workspaceRoot: env.MATERIAL_CENTER_WORKSPACE })],
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
