import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  console.error(
    "[DB] ERROR: DATABASE_URL is not set. Please configure your environment variables."
  );
  process.exit(1);
}

const pool = mysql.createPool(process.env.DATABASE_URL);

export const db = drizzle(pool, { schema, mode: "default" });
export type DB = typeof db;
