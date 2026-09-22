/** Execute native commands with literal argument arrays; never interpret a package-manager shim as JavaScript. */
import { spawnSync } from "node:child_process";

export function commandSpec(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
) {
  return {
    command:
      // Node 24 cannot spawn .cmd with shell:false; Volta supplies the native .exe shim.
      platform === "win32" && !command.endsWith(".exe")
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
