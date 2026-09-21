import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export * from './schema/index';
export * from './notifications';
export * from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro';

export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
