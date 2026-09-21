/** Build deployable server entries and static web. External native packages stay installed on host. */
import { build } from "esbuild";
import { execute } from "./process.ts";
import "./validate-content.ts";
await build({
  entryPoints: {
    api: "apps/api/src/index.ts",
    worker: "apps/worker/src/index.ts",
  },
  outdir: "dist",
  platform: "node",
  format: "esm",
  bundle: true,
  packages: "external",
  target: "node24",
  sourcemap: true,
});
execute("pnpm", [
  "exec",
  "vite",
  "build",
  "--config",
  "apps/web/vite.config.ts",
]);
await import("./performance-budget.ts");
