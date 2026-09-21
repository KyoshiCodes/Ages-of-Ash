/** Reset only loopback request buckets in the explicitly isolated local test database before a test run. */
import { prisma, closeDatabase } from "../packages/database/src/index.ts";
const url = new URL(process.env.DATABASE_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "55432" ||
  url.pathname !== "/ages_test"
)
  throw new Error("Requires isolated loopback ages_test database on 55432");
try {
  await prisma.rateLimit.deleteMany({
    where: {
      key: {
        in: [
          "ip:127.0.0.1",
          "ip:::1",
          "auth:127.0.0.1",
          "auth:::1",
          "login:127.0.0.1",
          "login:::1",
        ],
      },
    },
  });
  console.log("Isolated loopback test buckets reset.");
} finally {
  await closeDatabase();
}
