import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/testSetup.ts",
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          antd: ["antd", "@ant-design/icons"],
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query", "axios", "zustand"],
        },
      },
    },
  },
});
