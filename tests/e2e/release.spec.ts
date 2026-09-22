/** HTTP release acceptance: readiness, correlation, origin policy and operator isolation. */
import { test, expect } from "@playwright/test";
test("health, headers and origin rejection remain observable without leaking operational details", async ({
  request,
}) => {
  const ready = await request.get("/api/ready");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toMatchObject({
    ok: true,
    database: true,
    worker: true,
  });
  expect(ready.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  expect(ready.headers()["x-content-type-options"]).toBe("nosniff");
  const second = await request.get("/api/live");
  expect(second.headers()["x-request-id"]).not.toBe(
    ready.headers()["x-request-id"],
  );
  const denied = await request.post("/api/auth/guest", {
    data: {},
    headers: { origin: "https://untrusted.example" },
  });
  expect(denied.status()).toBe(403);
  expect(denied.headers()["access-control-allow-origin"]).toBeUndefined();
  expect(
    (await request.get("http://127.0.0.1:3000/internal/metrics")).status(),
  ).toBe(404);
});
