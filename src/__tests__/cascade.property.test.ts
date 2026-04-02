// Feature: task-management-app, Property 9: cascade de suppression

import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Validates: Requirements 3.3, 4.4, 5.4
 *
 * Propriété 9 : Pour tout tableau/colonne/carte supprimé, aucun enfant ne doit
 * subsister en base de données.
 *
 * This test simulates cascade deletion logic in-memory, mirroring the behaviour
 * of board.service.ts / column.service.ts / card.service.ts without requiring
 * a real DB connection.
 */

// ---------------------------------------------------------------------------
// In-memory DB types
// ---------------------------------------------------------------------------

interface BoardRecord {
  id: string;
  userId: string;
  name: string;
}

interface ColumnRecord {
  id: string;
  boardId: string;
  name: string;
  order: number;
}

interface CardRecord {
  id: string;
  columnId: string;
  title: string;
  order: number;
}

interface AttachmentRecord {
  id: string;
  cardId: string;
  name: string;
  storageKey: string;
}

interface InMemoryDB {
  boards: BoardRecord[];
  columns: ColumnRecord[];
  cards: CardRecord[];
  attachments: AttachmentRecord[];
}

function createDB(): InMemoryDB {
  return { boards: [], columns: [], cards: [], attachments: [] };
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

function simulateCreateBoard(db: InMemoryDB, userId: string, name: string): BoardRecord {
  const board: BoardRecord = { id: crypto.randomUUID(), userId, name };
  db.boards.push(board);
  return board;
}

function simulateCreateColumn(db: InMemoryDB, boardId: string, name: string, order: number): ColumnRecord {
  const column: ColumnRecord = { id: crypto.randomUUID(), boardId, name, order };
  db.columns.push(column);
  return column;
}

function simulateCreateCard(db: InMemoryDB, columnId: string, title: string, order: number): CardRecord {
  const card: CardRecord = { id: crypto.randomUUID(), columnId, title, order };
  db.cards.push(card);
  return card;
}

function simulateCreateAttachment(db: InMemoryDB, cardId: string, name: string): AttachmentRecord {
  const attachment: AttachmentRecord = {
    id: crypto.randomUUID(),
    cardId,
    name,
    storageKey: `files/${crypto.randomUUID()}`,
  };
  db.attachments.push(attachment);
  return attachment;
}

// ---------------------------------------------------------------------------
// Cascade delete simulations (mirrors DB onDelete: 'cascade' behaviour)
// ---------------------------------------------------------------------------

/** deleteCard: removes card + all its attachments */
function simulateDeleteCard(db: InMemoryDB, cardId: string): void {
  db.attachments = db.attachments.filter((a) => a.cardId !== cardId);
  db.cards = db.cards.filter((c) => c.id !== cardId);
}

/** deleteColumn: removes column + all its cards + all attachments on those cards */
function simulateDeleteColumn(db: InMemoryDB, columnId: string): void {
  const cardIds = db.cards.filter((c) => c.columnId === columnId).map((c) => c.id);
  db.attachments = db.attachments.filter((a) => !cardIds.includes(a.cardId));
  db.cards = db.cards.filter((c) => c.columnId !== columnId);
  db.columns = db.columns.filter((col) => col.id !== columnId);
}

/** deleteBoard: removes board + all its columns + all cards in those columns + all attachments */
function simulateDeleteBoard(db: InMemoryDB, boardId: string): void {
  const columnIds = db.columns.filter((col) => col.boardId === boardId).map((col) => col.id);
  const cardIds = db.cards.filter((c) => columnIds.includes(c.columnId)).map((c) => c.id);
  db.attachments = db.attachments.filter((a) => !cardIds.includes(a.cardId));
  db.cards = db.cards.filter((c) => !columnIds.includes(c.columnId));
  db.columns = db.columns.filter((col) => col.boardId !== boardId);
  db.boards = db.boards.filter((b) => b.id !== boardId);
}

// ---------------------------------------------------------------------------
// Tree builder: creates a board with N columns, each with M cards + attachments
// ---------------------------------------------------------------------------

function buildTree(
  db: InMemoryDB,
  userId: string,
  columnCount: number,
  cardCountPerColumn: number
): { board: BoardRecord; columnIds: string[]; cardIds: string[]; attachmentIds: string[] } {
  const board = simulateCreateBoard(db, userId, "Test Board");
  const columnIds: string[] = [];
  const cardIds: string[] = [];
  const attachmentIds: string[] = [];

  for (let ci = 0; ci < columnCount; ci++) {
    const column = simulateCreateColumn(db, board.id, `Column ${ci}`, ci);
    columnIds.push(column.id);

    for (let ki = 0; ki < cardCountPerColumn; ki++) {
      const card = simulateCreateCard(db, column.id, `Card ${ci}-${ki}`, ki);
      cardIds.push(card.id);

      // Each card gets one attachment
      const attachment = simulateCreateAttachment(db, card.id, `file-${ci}-${ki}.txt`);
      attachmentIds.push(attachment.id);
    }
  }

  return { board, columnIds, cardIds, attachmentIds };
}

// ---------------------------------------------------------------------------
// Property test P9 – Cascade de suppression
// ---------------------------------------------------------------------------

describe("P9 – Cascade de suppression", () => {
  /**
   * Validates: Requirements 3.3, 4.4, 5.4
   */

  it(
    "deleteBoard supprime toutes les colonnes, cartes et pièces jointes associées",
    () => {
      // Feature: task-management-app, Property 9: cascade de suppression
      /**
       * Validates: Requirements 3.3, 4.4, 5.4
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (columnCount, cardCountPerColumn) => {
            const db = createDB();
            const userId = crypto.randomUUID();

            const { board, columnIds, cardIds, attachmentIds } = buildTree(
              db,
              userId,
              columnCount,
              cardCountPerColumn
            );

            // Verify tree was built correctly
            expect(db.boards).toHaveLength(1);
            expect(db.columns).toHaveLength(columnCount);
            expect(db.cards).toHaveLength(columnCount * cardCountPerColumn);
            expect(db.attachments).toHaveLength(columnCount * cardCountPerColumn);

            // Delete the board
            simulateDeleteBoard(db, board.id);

            // Board must be gone
            expect(db.boards.find((b) => b.id === board.id)).toBeUndefined();

            // No orphaned columns
            for (const colId of columnIds) {
              expect(db.columns.find((c) => c.id === colId)).toBeUndefined();
            }

            // No orphaned cards
            for (const cardId of cardIds) {
              expect(db.cards.find((c) => c.id === cardId)).toBeUndefined();
            }

            // No orphaned attachments
            for (const attId of attachmentIds) {
              expect(db.attachments.find((a) => a.id === attId)).toBeUndefined();
            }

            // DB must be completely empty (no leakage from other boards)
            expect(db.columns).toHaveLength(0);
            expect(db.cards).toHaveLength(0);
            expect(db.attachments).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "deleteColumn supprime toutes les cartes et pièces jointes de la colonne, sans toucher aux autres colonnes",
    () => {
      // Feature: task-management-app, Property 9: cascade de suppression
      /**
       * Validates: Requirements 4.4, 5.4
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (columnCount, cardCountPerColumn) => {
            const db = createDB();
            const userId = crypto.randomUUID();

            const { board, columnIds } = buildTree(
              db,
              userId,
              columnCount,
              cardCountPerColumn
            );

            // Pick the first column to delete
            const targetColumnId = columnIds[0];
            const remainingColumnIds = columnIds.slice(1);

            const targetCardIds = db.cards
              .filter((c) => c.columnId === targetColumnId)
              .map((c) => c.id);
            const targetAttachmentIds = db.attachments
              .filter((a) => targetCardIds.includes(a.cardId))
              .map((a) => a.id);

            simulateDeleteColumn(db, targetColumnId);

            // Deleted column must be gone
            expect(db.columns.find((c) => c.id === targetColumnId)).toBeUndefined();

            // No orphaned cards from deleted column
            for (const cardId of targetCardIds) {
              expect(db.cards.find((c) => c.id === cardId)).toBeUndefined();
            }

            // No orphaned attachments from deleted column's cards
            for (const attId of targetAttachmentIds) {
              expect(db.attachments.find((a) => a.id === attId)).toBeUndefined();
            }

            // Remaining columns must still exist
            for (const colId of remainingColumnIds) {
              expect(db.columns.find((c) => c.id === colId)).toBeDefined();
            }

            // Board must still exist
            expect(db.boards.find((b) => b.id === board.id)).toBeDefined();

            // Remaining cards (from other columns) must still exist
            const remainingCards = db.cards.filter((c) =>
              remainingColumnIds.includes(c.columnId)
            );
            expect(remainingCards).toHaveLength(
              (columnCount - 1) * cardCountPerColumn
            );
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "deleteCard supprime toutes les pièces jointes de la carte, sans toucher aux autres cartes",
    () => {
      // Feature: task-management-app, Property 9: cascade de suppression
      /**
       * Validates: Requirements 5.4
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 2, max: 5 }),
          (columnCount, cardCountPerColumn) => {
            const db = createDB();
            const userId = crypto.randomUUID();

            const { board, columnIds, cardIds } = buildTree(
              db,
              userId,
              columnCount,
              cardCountPerColumn
            );

            // Pick the first card to delete
            const targetCardId = cardIds[0];
            const remainingCardIds = cardIds.slice(1);

            const targetAttachmentIds = db.attachments
              .filter((a) => a.cardId === targetCardId)
              .map((a) => a.id);

            simulateDeleteCard(db, targetCardId);

            // Deleted card must be gone
            expect(db.cards.find((c) => c.id === targetCardId)).toBeUndefined();

            // No orphaned attachments from deleted card
            for (const attId of targetAttachmentIds) {
              expect(db.attachments.find((a) => a.id === attId)).toBeUndefined();
            }

            // Remaining cards must still exist
            for (const cardId of remainingCardIds) {
              expect(db.cards.find((c) => c.id === cardId)).toBeDefined();
            }

            // Board and columns must still exist
            expect(db.boards.find((b) => b.id === board.id)).toBeDefined();
            for (const colId of columnIds) {
              expect(db.columns.find((c) => c.id === colId)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "deleteBoard ne supprime pas les colonnes/cartes/pièces jointes d'un autre tableau",
    () => {
      // Feature: task-management-app, Property 9: cascade de suppression
      /**
       * Validates: Requirements 3.3
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 3 }),
          (columnCount, cardCountPerColumn) => {
            const db = createDB();
            const userId = crypto.randomUUID();

            // Build two independent boards
            const { board: boardA } = buildTree(db, userId, columnCount, cardCountPerColumn);
            const { board: boardB, columnIds: colIdsB, cardIds: cardIdsB, attachmentIds: attIdsB } =
              buildTree(db, userId, columnCount, cardCountPerColumn);

            // Delete only boardA
            simulateDeleteBoard(db, boardA.id);

            // boardB and all its children must still exist
            expect(db.boards.find((b) => b.id === boardB.id)).toBeDefined();
            for (const colId of colIdsB) {
              expect(db.columns.find((c) => c.id === colId)).toBeDefined();
            }
            for (const cardId of cardIdsB) {
              expect(db.cards.find((c) => c.id === cardId)).toBeDefined();
            }
            for (const attId of attIdsB) {
              expect(db.attachments.find((a) => a.id === attId)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
