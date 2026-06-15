import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/FifaWorldCup2026/",
  plugins: [react()],
  test: {
    environment: "node",
  },
});
