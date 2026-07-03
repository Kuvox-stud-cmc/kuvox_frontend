import { spawnSync } from "node:child_process";

const apiUrl = (process.env.VITE_API_URL || "http://localhost:5280").replace(/\/$/, "");
const result = spawnSync(
  "npx",
  [
    "openapi-typescript",
    `${apiUrl}/openapi/v1.json`,
    "-o",
    "app/lib/api/generated.ts",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
