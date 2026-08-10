import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend has no CORS middleware, so all /api calls go through this
// dev proxy to http://localhost:8000. For production, either enable CORS
// on the backend or serve the built app behind the same origin as the API.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
