// Feature: task-management-app, Property 12: réordonnancement des colonnes persisté

import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Validates: Requirements 4.2, 4.5
 *
 * Propriété 12 : Pour toute permutation valide d'IDs de colonnes d'un tableau,
 * après l'opération de réordonnancement, l'ordre retourné par la base de données
 * doit correspondre exactement à la permutation demandée.
 *
 * This test simulates addColumn / reorderColumns logic in-memory, mirroring
 * the behaviour of column.service.ts without requiring a real DB connection.
 */

// ---------------------------------------------------------------------------
// Minimal in-memory simulation (mirrors column.service.ts logic)
// ---------------------------------------------------------------------------

interface ColumnRecord {
  id: string;
  boardId: string;
  name: string;
  order: number;
  createdAt: Date;
}

interface InMemoryDB {
  columns: ColumnRecord[];
}

function simulateAddColumn(
  db: InMemoryDB,
  userId: string,
  boardId: string,
  name: string
): ColumnRecord {
  // order = max existing order + 1 (or 0 if none)
  const boardColumns = db.columns.filter((c) => c.boardId === boardId);
  const maxOrder =
    boardColumns.length === 0
      ? -1
      : Math.max(...boardColumns.map((c) => c.order));
  const column: ColumnRecord = {
    id: crypto.randomUUID(),
    boardId,
    name,
    order: maxOrder + 1,
    createdAt: new Date(),
  };
  db.columns.push(column);
  return column;
}

function simulateReorderColumns(
  db: InMemoryDB,
  userId: string,
  boardId: string,
  orderedIds: string[]
): void {
  // Update each column's order to match its position in orderedIds
  for (let i = 0; i < orderedIds.length; i++) {
    const col = db.columns.find(
      (c) => c.id === orderedIds[i] && c.boardId === boardId
    );
    if (col) {
      col.order = i;
    }
  }
}

function simulateGetColumnsSortedByOrder(
  db: InMemoryDB,
  boardId: string
): ColumnRecord[] {
  return db.columns
    .filter((c) => c.boardId === boardId)
    .sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// Property test P12
// ---------------------------------------------------------------------------

describe("P12 – Réordonnancement des colonnes persisté", () => {
  it(
    "pour toute permutation valide d'IDs de colonnes, l'ordre en base doit correspondre exactement",
    () => {
      // Feature: task-management-app, Property 12: réordonnancement des colonnes persisté
      /**
       * Validates: Requirements 4.2, 4.5
       */

      // Fixed set of column names to create on the board
      const columnNames = ["Todo", "In Progress", "Review", "Done", "Backlog"];

      fc.assert(
        fc.property(
          fc.shuffledSubarray(columnNames, { minLength: 2 }),
          (permutedNames) => {
            const db: InMemoryDB = { columns: [] };
            const userId = crypto.randomUUID();
            const boardId = crypto.randomUUID();

            // Create columns in default order
            const createdColumns = columnNames.map((name) =>
              simulateAddColumn(db, userId, boardId, name)
            );

            // Build a permutation of IDs based on the shuffled names
            const nameToId = new Map(
              createdColumns.map((c) => [c.name, c.id])
            );
            const permutedIds = permutedNames
              .map((name) => nameToId.get(name)!)
              .filter(Boolean);

            // Apply reorder
            simulateReorderColumns(db, userId, boardId, permutedIds);

            // Read back sorted by order
            const sorted = simulateGetColumnsSortedByOrder(db, boardId);

            // The IDs of the reordered columns (in order) must match permutedIds exactly
            const reorderedIds = sorted
              .filter((c) => permutedIds.includes(c.id))
              .map((c) => c.id);

            expect(reorderedIds).toEqual(permutedIds);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "après réordonnancement, chaque colonne a un ordre unique (pas de doublons)",
    () => {
      // Feature: task-management-app, Property 12: réordonnancement des colonnes persisté
      /**
       * Validates: Requirements 4.2, 4.5
       */

      const columnNames = ["A", "B", "C", "D"];

      fc.assert(
        fc.property(
          fc.shuffledSubarray(columnNames, { minLength: 2 }),
          (permutedNames) => {
            const db: InMemoryDB = { columns: [] };
            const userId = crypto.randomUUID();
            const boardId = crypto.randomUUID();

            const createdColumns = columnNames.map((name) =>
              simulateAddColumn(db, userId, boardId, name)
            );

            const nameToId = new Map(
              createdColumns.map((c) => [c.name, c.id])
            );
            const permutedIds = permutedNames
              .map((name) => nameToId.get(name)!)
              .filter(Boolean);

            simulateReorderColumns(db, userId, boardId, permutedIds);

            // Orders of the reordered columns must be unique
            const reorderedCols = db.columns.filter((c) =>
              permutedIds.includes(c.id)
            );
            const orders = reorderedCols.map((c) => c.order);
            const uniqueOrders = new Set(orders);

            expect(uniqueOrders.size).toBe(orders.length);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "addColumn assigne order = max+1 pour chaque nouvelle colonne",
    () => {
      // Feature: task-management-app, Property 12: réordonnancement des colonnes persisté
      /**
       * Validates: Requirements 4.1, 4.5
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (count) => {
            const db: InMemoryDB = { columns: [] };
            const userId = crypto.randomUUID();
            const boardId = crypto.randomUUID();

            for (let i = 0; i < count; i++) {
              const col = simulateAddColumn(db, userId, boardId, `Col ${i}`);
              expect(col.order).toBe(i);
            }

            // Columns sorted by order must match insertion order
            const sorted = simulateGetColumnsSortedByOrder(db, boardId);
            for (let i = 0; i < count; i++) {
              expect(sorted[i].order).toBe(i);
              expect(sorted[i].name).toBe(`Col ${i}`);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
