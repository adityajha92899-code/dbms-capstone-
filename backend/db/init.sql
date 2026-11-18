-- FleetFlow TMS — Docker Entrypoint Initialization Script
-- Runs schema, triggers, views, indexes, and seed data in order.

\i /docker-entrypoint-initdb.d/sql/schema.sql
\i /docker-entrypoint-initdb.d/sql/triggers.sql
\i /docker-entrypoint-initdb.d/sql/views.sql
\i /docker-entrypoint-initdb.d/sql/indexes.sql
\i /docker-entrypoint-initdb.d/sql/seed.sql
