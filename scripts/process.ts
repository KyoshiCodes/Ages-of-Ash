/** Execute argument arrays without a shell, including package-manager scripts on Windows. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
export function commandSpec(command: string, args: string[]) {
  if (
    command === "pnpm" &&
    process.env.npm_execpath &&
    existsSync(process.env.npm_execpath)
  )
    return process.env.npm_execpath.endsWith(".exe")
      ? { command: process.env.npm_execpath, args }
      : {
          command: process.execPath,
          args: [process.env.npm_execpath, ...args],
        };
  return {
    command:
      process.platform === "win32" && !command.endsWith(".exe")
        ? `${command}.exe`
        : command,
    args,
  };
}
export function execute(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const spec = commandSpec(command, args);
  const result = spawnSync(spec.command, spec.args, {
    stdio: "inherit",
    shell: false,
    env,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed (${result.status ?? result.error?.name})`,
    );
}
