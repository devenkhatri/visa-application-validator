import type { Config } from 'drizzle-kit';
import path from 'path';

const DB_PATH = process.env.SQLITE_DB_PATH ?? path.join(process.cwd(), 'data', 'visa-mvp.db');

export default {
  schema:    './lib/db/schema.ts',
  out:       './drizzle',
  dialect:   'sqlite',
  dbCredentials: {
    url: DB_PATH,
  },
} satisfies Config;
