/** Execute trusted project commands on Windows and Linux; reject failed child processes. */
import { spawnSync } from "node:child_process";
export function execute(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0)
    throw result.error ?? new Error(`${command} failed (${result.status})`);
}
