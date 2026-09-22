/** Release invariants: safe argument boundaries, secret-free diagnostics and secure production defaults. */
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandSpec } from "../scripts/process.ts";
import {
  runtimeConfig,
  errorKind,
} from "../packages/infrastructure/src/operations.ts";
describe("release foundation", () => {
  it("keeps arguments literal without a shell", () => {
    const args = ["a b", "$(danger)", "x&y", "`x`"];
    const result = commandSpec("git", args);
    expect(result.args).toEqual(args);
  });
  it("launches pnpm as an executable on Linux even when npm_execpath names an ELF shim", () => {
    const directory = mkdtempSync(join(tmpdir(), "ages-pnpm-shim-"));
    const shim = join(directory, "pnpm.cjs");
    writeFileSync(shim, Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
    const previous = process.env.npm_execpath;
    process.env.npm_execpath = shim;
    try {
      expect(commandSpec("pnpm", ["setup:db"], "linux")).toEqual({
        command: "pnpm",
        args: ["setup:db"],
      });
    } finally {
      if (previous === undefined) delete process.env.npm_execpath;
      else process.env.npm_execpath = previous;
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("uses native Windows executable shims without shell or Node dispatch", () => {
    expect(commandSpec("pnpm", ["verify:fast"], "win32")).toEqual({
      command: "pnpm.exe",
      args: ["verify:fast"],
    });
    expect(
      commandSpec("C:/PostgreSQL/bin/pg_dump.exe", ["--version"], "win32"),
    ).toEqual({
      command: "C:/PostgreSQL/bin/pg_dump.exe",
      args: ["--version"],
    });
  });
  it("defaults analytics off", () => {
    expect(
      runtimeConfig({ DATABASE_URL: "postgresql://local:pass@localhost/ages" })
        .ANALYTICS_ENABLED,
    ).toBe("false");
  });
  it("rejects insecure production configuration and bootstrap credentials", () => {
    const good = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://runtime:longpassword@localhost/ages",
      APP_ORIGIN: "https://game.example.com",
      OPS_TOKEN: "a".repeat(40),
    };
    expect(() => runtimeConfig(good)).not.toThrow();
    for (const extra of [
      { APP_ORIGIN: "http://game.example.com" },
      { PG_ADMIN_URL: "secret" },
      { OPS_TOKEN: "" },
      { HOST: "0.0.0.0" },
      { DATABASE_URL: "postgresql://runtime:REPLACE_ME@localhost/ages" },
    ])
      expect(() => runtimeConfig({ ...good, ...extra })).toThrow();
  });
  it("never turns raw error messages into diagnostics", () => {
    expect(errorKind(new Error("postgresql://secret:password@host/db"))).toBe(
      "INTERNAL_ERROR",
    );
    expect(errorKind({ code: "P2002" })).toBe("P2002");
    expect(errorKind({ code: "password=secret" })).toBe("INTERNAL_ERROR");
  });
});
