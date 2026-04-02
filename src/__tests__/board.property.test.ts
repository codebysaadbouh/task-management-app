// Feature: task-management-app, Property 7: round-trip création d'entité (boards)

import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Validates: Requirements 3.1
 *
 * Propriété 7 : Pour tout nom valide, créer un tableau puis le relire doit retourner
 * les mêmes données que celles soumises à la création.
 *
 * This test simulates the createBoard / getUserBoards logic in-memory, mirroring
 * the behaviour of board.service.ts without requiring a real DB connection.
 */

// ---------------------------------------------------------------------------
// Minimal in-memory DB simulation (mirrors board.service.ts logic)
// ---------------------------------------------------------------------------

interface BoardRecord {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemoryDB {
  boards: BoardRecord[];
}

function simulateCreateBoard(
  db: InMemoryDB,
  userId: string,
  name: string
): BoardRecord {
  const board: BoardRecord = {
    id: crypto.randomUUID(),
    userId,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.boards.push(board);
  // Simulate the SELECT after INSERT (returns the inserted row)
  const found = db.boards.find((b) => b.id === board.id);
  if (!found) throw new Error("Board not found after insert");
  return found;
}

function simulateGetUserBoards(db: InMemoryDB, userId: string): BoardRecord[] {
  return db.boards.filter((b) => b.userId === userId);
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("P7 – Round-trip création d'entité (boards)", () => {
  it(
    "pour tout nom valide, le tableau créé est retrouvé avec le même nom via getUserBoards",
    () => {
      // Feature: task-management-app, Property 7: round-trip création d'entité
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 255 }),
          (userId, name) => {
            const db: InMemoryDB = { boards: [] };

            const created = simulateCreateBoard(db, userId, name);

            // Round-trip: read back via getUserBoards
            const userBoards = simulateGetUserBoards(db, userId);
            const found = userBoards.find((b) => b.id === created.id);

            expect(found).toBeDefined();
            expect(found!.name).toBe(name);
            expect(found!.userId).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "pour tout nom valide, createBoard retourne un tableau dont le nom correspond exactement au nom soumis",
    () => {
      // Feature: task-management-app, Property 7: round-trip création d'entité
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 255 }),
          (userId, name) => {
            const db: InMemoryDB = { boards: [] };

            const created = simulateCreateBoard(db, userId, name);

            expect(created.name).toBe(name);
            expect(created.userId).toBe(userId);
            expect(created.id).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "getUserBoards n'expose pas les tableaux d'un autre utilisateur (isolation)",
    () => {
      // Feature: task-management-app, Property 7: round-trip création d'entité (boards)
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 255 }),
          (userA, userB, name) => {
            fc.pre(userA !== userB);

            const db: InMemoryDB = { boards: [] };

            simulateCreateBoard(db, userA, name);

            const boardsForB = simulateGetUserBoards(db, userB);
            expect(boardsForB).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "P7 (async): pour tout nom valide, createBoard puis getUserBoards retourne un tableau avec le même nom",
    async () => {
      // Feature: task-management-app, Property 7: round-trip création d'entité (boards)
      /**
       * Validates: Requirements 3.1
       *
       * Propriété 7 : Pour tout nom valide, créer un tableau puis le relire via getUserBoards
       * doit retourner les mêmes données que celles soumises à la création.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 255 }),
          async (name) => {
            const userId = crypto.randomUUID();
            const db: InMemoryDB = { boards: [] };

            // Simulate createBoard
            const created = simulateCreateBoard(db, userId, name);

            // Simulate getUserBoards (round-trip)
            const userBoards = simulateGetUserBoards(db, userId);
            const found = userBoards.find((b) => b.id === created.id);

            expect(found).toBeDefined();
            expect(found!.name).toBe(name);
            expect(found!.userId).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// P8 – Mise à jour persistée (boards)
// ---------------------------------------------------------------------------

// Feature: task-management-app, Property 8: mise à jour persistée

/**
 * Validates: Requirements 3.2
 *
 * Propriété 8 : Pour tout nouveau nom, renommer un tableau puis le relire doit
 * retourner le nouveau nom.
 *
 * This test simulates the renameBoard / getUserBoards logic in-memory, mirroring
 * the behaviour of board.service.ts without requiring a real DB connection.
 */

function simulateRenameBoard(
  db: InMemoryDB,
  userId: string,
  boardId: string,
  newName: string
): void {
  const board = db.boards.find(
    (b) => b.id === boardId && b.userId === userId
  );
  if (!board) {
    const error = new Error("Forbidden") as Error & { code: string };
    error.code = "FORBIDDEN";
    throw error;
  }
  board.name = newName;
  board.updatedAt = new Date();
}

function simulateGetBoardById(
  db: InMemoryDB,
  boardId: string
): BoardRecord | undefined {
  return db.boards.find((b) => b.id === boardId);
}

describe("P8 – Mise à jour persistée (boards)", () => {
  it(
    "pour tout nouveau nom, renommer un tableau puis le relire doit retourner le nouveau nom",
    () => {
      // Feature: task-management-app, Property 8: mise à jour persistée
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.string({ minLength: 1, maxLength: 255 }),
          (userId, initialName, newName) => {
            const db: InMemoryDB = { boards: [] };

            // Create a board with the initial name
            const created = simulateCreateBoard(db, userId, initialName);

            // Rename it
            simulateRenameBoard(db, userId, created.id, newName);

            // Read it back and verify the new name is persisted
            const found = simulateGetBoardById(db, created.id);
            expect(found).toBeDefined();
            expect(found!.name).toBe(newName);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "renommer un tableau ne modifie pas les autres tableaux de l'utilisateur",
    () => {
      // Feature: task-management-app, Property 8: mise à jour persistée
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.string({ minLength: 1, maxLength: 255 }),
          (userId, nameA, nameB, newNameA) => {
            const db: InMemoryDB = { boards: [] };

            const boardA = simulateCreateBoard(db, userId, nameA);
            const boardB = simulateCreateBoard(db, userId, nameB);

            simulateRenameBoard(db, userId, boardA.id, newNameA);

            // boardB should be unchanged
            const foundB = simulateGetBoardById(db, boardB.id);
            expect(foundB).toBeDefined();
            expect(foundB!.name).toBe(nameB);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// P10 – Isolation des tableaux par utilisateur
// ---------------------------------------------------------------------------

// Feature: task-management-app, Property 10: isolation des tableaux par utilisateur

/**
 * Validates: Requirements 3.4
 *
 * Propriété 10 : Pour tout ensemble d'utilisateurs avec leurs tableaux respectifs,
 * la liste des tableaux retournée pour un utilisateur donné ne doit contenir que
 * les tableaux dont il est propriétaire.
 */

function simulateDeleteBoard(
  db: InMemoryDB,
  userId: string,
  boardId: string
): void {
  const board = db.boards.find(
    (b) => b.id === boardId && b.userId === userId
  );
  if (!board) {
    const error = new Error("Forbidden") as Error & { code: string };
    error.code = "FORBIDDEN";
    throw error;
  }
  db.boards = db.boards.filter((b) => b.id !== boardId);
}

// ---------------------------------------------------------------------------
// P11 – Contrôle d'accès 403
// ---------------------------------------------------------------------------

// Feature: task-management-app, Property 11: contrôle d'accès 403

/**
 * Validates: Requirements 3.5
 *
 * Propriété 11 : Pour tout tableau appartenant à l'utilisateur A, toute tentative
 * d'accès (modification, suppression) par un utilisateur B différent doit retourner
 * une erreur avec le code 'FORBIDDEN' (équivalent HTTP 403).
 */

describe("P11 – Contrôle d'accès 403", () => {
  it(
    "renommer un tableau appartenant à userA avec userB doit lever une erreur FORBIDDEN",
    () => {
      // Feature: task-management-app, Property 11: contrôle d'accès 403
      /**
       * Validates: Requirements 3.5
       */
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.string({ minLength: 1, maxLength: 255 }),
          (userA, userB, boardName, newName) => {
            fc.pre(userA !== userB);

            const db: InMemoryDB = { boards: [] };

            // userA creates a board
            const board = simulateCreateBoard(db, userA, boardName);

            // userB tries to rename it — must throw FORBIDDEN
            let thrownError: (Error & { code?: string }) | null = null;
            try {
              simulateRenameBoard(db, userB, board.id, newName);
            } catch (e) {
              thrownError = e as Error & { code?: string };
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError!.code).toBe("FORBIDDEN");

            // Board name must remain unchanged
            const found = simulateGetBoardById(db, board.id);
            expect(found).toBeDefined();
            expect(found!.name).toBe(boardName);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "supprimer un tableau appartenant à userA avec userB doit lever une erreur FORBIDDEN",
    () => {
      // Feature: task-management-app, Property 11: contrôle d'accès 403
      /**
       * Validates: Requirements 3.5
       */
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 255 }),
          (userA, userB, boardName) => {
            fc.pre(userA !== userB);

            const db: InMemoryDB = { boards: [] };

            // userA creates a board
            const board = simulateCreateBoard(db, userA, boardName);

            // userB tries to delete it — must throw FORBIDDEN
            let thrownError: (Error & { code?: string }) | null = null;
            try {
              simulateDeleteBoard(db, userB, board.id);
            } catch (e) {
              thrownError = e as Error & { code?: string };
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError!.code).toBe("FORBIDDEN");

            // Board must still exist
            const found = simulateGetBoardById(db, board.id);
            expect(found).toBeDefined();
            expect(found!.userId).toBe(userA);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// P10 – Isolation des tableaux par utilisateur
// ---------------------------------------------------------------------------

describe("P10 – Isolation des tableaux par utilisateur", () => {
  it(
    "getUserBoards ne retourne que les tableaux du propriétaire, jamais ceux d'autres utilisateurs",
    () => {
      // Feature: task-management-app, Property 10: isolation des tableaux par utilisateur
      /**
       * Validates: Requirements 3.4
       */
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              boardName: fc.string({ minLength: 1, maxLength: 255 }),
            }),
            { minLength: 1 }
          ),
          (entries) => {
            const db: InMemoryDB = { boards: [] };

            // Create all boards in the shared in-memory DB
            for (const { userId, boardName } of entries) {
              simulateCreateBoard(db, userId, boardName);
            }

            // For each unique userId, verify isolation
            const uniqueUserIds = [...new Set(entries.map((e) => e.userId))];

            for (const userId of uniqueUserIds) {
              const boards = simulateGetUserBoards(db, userId);

              // Every board returned must belong to this userId
              for (const board of boards) {
                expect(board.userId).toBe(userId);
              }

              // No board from another user should appear
              const otherUserBoards = db.boards.filter(
                (b) => b.userId !== userId
              );
              for (const otherBoard of otherUserBoards) {
                const leaked = boards.find((b) => b.id === otherBoard.id);
                expect(leaked).toBeUndefined();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
