/** Conventional Commit validator; message contents are data, never executable. */
import { readFileSync } from "node:fs";
const message = readFileSync(process.argv[2], "utf8").trim();
if (
  !/^(feat|fix|docs|test|chore|refactor|perf|ci|build|style)(\([a-z0-9-]+\))?!?: .{3,}/.test(
    message,
  )
) {
  console.error("Use Conventional Commits, e.g. feat: add an operation");
  process.exitCode = 1;
}
