import "dotenv/config";
import { defineConfig } from "prisma/config";

const rawUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/syncspace_db?schema=public";

// Neon requires direct connection (without -pooler) for schema migrations to support PostgreSQL advisory locks
const directUrl = process.env.DIRECT_URL || rawUrl.replace("-pooler", "");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});
