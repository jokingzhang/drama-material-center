import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { materialLibraryPlugin } from "./server/materialLibraryPlugin.ts";

export default defineConfig({
  plugins: [react(), materialLibraryPlugin()],
  server: {
    host: "127.0.0.1",
    port: 4373,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4374,
  },
});
