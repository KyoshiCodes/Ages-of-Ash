/** Install hooks only in real checkouts; archive installs and CI remain usable. */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (existsSync(".git") && !process.env.CI)
  spawnSync("git", ["config", "core.hooksPath", ".husky"], {
    stdio: "inherit",
  });
