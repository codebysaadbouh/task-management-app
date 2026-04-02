import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Validates: Requirements 10.1
describe('Drizzle schema entity files exist separately', () => {
  const schemaFiles = [
    'src/server/db/schema/users.ts',
    'src/server/db/schema/boards.ts',
    'src/server/db/schema/columns.ts',
    'src/server/db/schema/cards.ts',
    'src/server/db/schema/attachments.ts',
  ];

  it.each(schemaFiles)('%s exists', (filePath) => {
    expect(existsSync(resolve(process.cwd(), filePath))).toBe(true);
  });
});
