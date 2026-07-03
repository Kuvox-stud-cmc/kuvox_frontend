import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { installProxyHandlers } from "./server/proxy.mjs";

export default defineConfig({
  plugins: [
    {
      name: "kuvox-bff-proxy",
      configureServer(server) {
        installProxyHandlers(server);
      },
    },
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
