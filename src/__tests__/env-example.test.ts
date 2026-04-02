import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// Feature: task-management-app, Property: .env.example contains all required variables (Requirement 9.3)

const REQUIRED_VARS = [
  // MySQL
  'DATABASE_URL',
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_DATABASE',
  // MinIO
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  // NextAuth
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  // Google OAuth
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

describe('.env.example', () => {
  const envExamplePath = resolve(process.cwd(), '.env.example');
  const content = readFileSync(envExamplePath, 'utf-8');
  const definedKeys = content
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => line.split('=')[0].trim());

  it.each(REQUIRED_VARS)('contains variable %s', (varName) => {
    expect(definedKeys).toContain(varName);
  });
});
