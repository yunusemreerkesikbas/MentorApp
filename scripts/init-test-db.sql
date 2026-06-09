-- Runs once on first container boot (docker-entrypoint-initdb.d).
-- The main `mentor` DB is created by POSTGRES_DB; we add the isolated test DB.
CREATE DATABASE mentor_test;
