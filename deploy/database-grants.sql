-- Run as the database owner AFTER migrate deploy, before runtime starts.
-- Roles must exist. This grants no application-schema DDL to runtime accounts.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE ages TO ages_api, ages_worker;
GRANT USAGE ON SCHEMA public TO ages_api, ages_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ages_api, ages_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ages_api, ages_worker;
REVOKE ALL ON "_prisma_migrations" FROM ages_api, ages_worker;
GRANT SELECT ON "_prisma_migrations" TO ages_api, ages_worker;
REVOKE INSERT, UPDATE, DELETE ON "ContentDefinition" FROM ages_api, ages_worker;
REVOKE UPDATE, DELETE ON "Audit", "Receipt" FROM ages_api, ages_worker;
-- The bootstrap administrator separately creates pgboss AUTHORIZATION ages_worker.
