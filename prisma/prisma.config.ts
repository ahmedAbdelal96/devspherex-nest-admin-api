import { PrismaConfig } from 'prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { z } from 'zod';

const dbUrlSchema = z.string().url();

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return dbUrlSchema.parse(url);
}

export default {
  earlyAccess: true,
  schema: prismaSchemaPath => prismaSchemaPath,
  migrate: {
    async adapter() {
      const connectionString = getDatabaseUrl();
      const pool = new pg.Pool({ connectionString });
      const adapter = new PrismaPg(pool);
      return adapter;
    },
  },
} satisfies PrismaConfig;
