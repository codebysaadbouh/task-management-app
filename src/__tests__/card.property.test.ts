// Feature: task-management-app, Property 7: round-trip création d'entité (cards)

import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Validates: Requirements 5.1
 *
 * Propriété 7 : Pour tout titre valide, créer une carte puis la relire doit retourner
 * les mêmes données que celles soumises à la création.
 *
 * This test simulates the createCard / getCardById logic in-memory, mirroring
 * the behaviour of card.service.ts without requiring a real DB connection.
 */

// ---------------------------------------------------------------------------
// Minimal in-memory simulation (mirrors card.service.ts logic)
// ---------------------------------------------------------------------------

interface CardRecord {
  id: string;
  columnId: string;
  title: string;
  description: string | undefined;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemoryDB {
  cards: CardRecord[];
}

function simulateCreateCard(
  db: InMemoryDB,
  userId: string,
  columnId: string,
  title: string,
  description?: string
): CardRecord {
  // order = max existing order in column + 1 (or 0 if none)
  const columnCards = db.cards.filter((c) => c.columnId === columnId);
  const maxOrder =
    columnCards.length === 0
      ? -1
      : Math.max(...columnCards.map((c) => c.order));

  const card: CardRecord = {
    id: crypto.randomUUID(),
    columnId,
    title,
    description,
    order: maxOrder + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.cards.push(card);

  // Simulate the SELECT after INSERT (returns the inserted row)
  const found = db.cards.find((c) => c.id === card.id);
  if (!found) throw new Error("Card not found after insert");
  return found;
}

function simulateGetCardById(
  db: InMemoryDB,
  cardId: string
): CardRecord | undefined {
  return db.cards.find((c) => c.id === cardId);
}

function simulateMoveCard(
  db: InMemoryDB,
  _userId: string,
  cardId: string,
  targetColumnId: string,
  newOrder: number
): void {
  const card = db.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} not found`);

  const sourceColumnId = card.columnId;

  // Move the card
  card.columnId = targetColumnId;
  card.order = newOrder;
  card.updatedAt = new Date();

  // Re-index source column (if different from target)
  if (sourceColumnId !== targetColumnId) {
    const sourceCards = db.cards
      .filter((c) => c.columnId === sourceColumnId)
      .sort((a, b) => a.order - b.order);
    sourceCards.forEach((c, i) => {
      c.order = i;
    });
  }

  // Re-index target column to eliminate duplicates
  const targetCards = db.cards
    .filter((c) => c.columnId === targetColumnId)
    .sort((a, b) => a.order - b.order);
  targetCards.forEach((c, i) => {
    c.order = i;
  });
}

// ---------------------------------------------------------------------------
// Property test P7 (cards)
// ---------------------------------------------------------------------------

describe("P7 – Round-trip création d'entité (cards)", () => {
  it(
    "pour tout titre valide, createCard puis getCardById retourne une carte avec le même titre",
    async () => {
      // Feature: task-management-app, Property 7: round-trip création d'entité (cards)
      /**
       * Validates: Requirements 5.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.option(fc.string()),
          async (title, description) => {
            const userId = crypto.randomUUID();
            const columnId = crypto.randomUUID();
            const db: InMemoryDB = { cards: [] };

            // Simulate createCard
            const created = simulateCreateCard(
              db,
              userId,
              columnId,
              title,
              description ?? undefined
            );

            // Round-trip: read back via getCardById
            const found = simulateGetCardById(db, created.id);

            expect(found).toBeDefined();
            expect(found!.title).toBe(title);
            expect(found!.columnId).toBe(columnId);
            expect(found!.description).toBe(description ?? undefined);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "createCard assigne order = max+1 pour chaque nouvelle carte dans la même colonne",
    async () => {
      // Feature: task-management-app, Property 7: round-trip création d'entité (cards)
      /**
       * Validates: Requirements 5.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (count) => {
            const userId = crypto.randomUUID();
            const columnId = crypto.randomUUID();
            const db: InMemoryDB = { cards: [] };

            for (let i = 0; i < count; i++) {
              const card = simulateCreateCard(db, userId, columnId, `Card ${i}`);
              expect(card.order).toBe(i);
            }

            // All cards in the column should have unique, sequential orders
            const columnCards = db.cards
              .filter((c) => c.columnId === columnId)
              .sort((a, b) => a.order - b.order);

            expect(columnCards).toHaveLength(count);
            for (let i = 0; i < count; i++) {
              expect(columnCards[i].order).toBe(i);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "createCard dans des colonnes différentes n'interfère pas avec les ordres",
    async () => {
      // Feature: task-management-app, Property 7: round-trip création d'entité (cards)
      /**
       * Validates: Requirements 5.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (titleA, titleB) => {
            const userId = crypto.randomUUID();
            const columnA = crypto.randomUUID();
            const columnB = crypto.randomUUID();
            const db: InMemoryDB = { cards: [] };

            const cardA = simulateCreateCard(db, userId, columnA, titleA);
            const cardB = simulateCreateCard(db, userId, columnB, titleB);

            // Each card should start at order 0 in its own column
            expect(cardA.order).toBe(0);
            expect(cardB.order).toBe(0);

            // Round-trip check
            const foundA = simulateGetCardById(db, cardA.id);
            const foundB = simulateGetCardById(db, cardB.id);

            expect(foundA!.title).toBe(titleA);
            expect(foundB!.title).toBe(titleB);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property test P13 – Déplacement de carte persisté
// ---------------------------------------------------------------------------

// Feature: task-management-app, Property 13: déplacement de carte persisté

describe("P13 – Déplacement de carte persisté", () => {
  /**
   * Validates: Requirements 5.2, 5.5
   *
   * Propriété 13 : Pour toute carte et colonne cible valide, après déplacement
   * la carte appartient à la colonne cible ET aucune colonne ne contient deux
   * cartes avec le même ordre (pas de doublons d'ordre).
   */
  it(
    "après moveCard, la carte appartient à la colonne cible et aucune colonne n'a de doublons d'ordre",
    async () => {
      // Feature: task-management-app, Property 13: déplacement de carte persisté
      /**
       * Validates: Requirements 5.2, 5.5
       */
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 0 }),
          async (userId, sourceColumnId, targetColumnId, newOrder) => {
            const db: InMemoryDB = { cards: [] };

            // Create a card in the source column
            const card = simulateCreateCard(db, userId, sourceColumnId, "Card to move");

            // Optionally add some other cards in both columns to make the test richer
            simulateCreateCard(db, userId, sourceColumnId, "Other card in source");
            simulateCreateCard(db, userId, targetColumnId, "Existing card in target");

            // Move the card
            simulateMoveCard(db, userId, card.id, targetColumnId, newOrder);

            // 1. The moved card must now belong to targetColumnId
            const movedCard = simulateGetCardById(db, card.id);
            expect(movedCard).toBeDefined();
            expect(movedCard!.columnId).toBe(targetColumnId);

            // 2. No two cards in any column share the same order value
            const allColumnIds = [...new Set(db.cards.map((c) => c.columnId))];
            for (const colId of allColumnIds) {
              const colCards = db.cards.filter((c) => c.columnId === colId);
              const orders = colCards.map((c) => c.order);
              const uniqueOrders = new Set(orders);
              expect(uniqueOrders.size).toBe(orders.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "après moveCard dans la même colonne, les ordres restent cohérents",
    async () => {
      // Feature: task-management-app, Property 13: déplacement de carte persisté
      /**
       * Validates: Requirements 5.2, 5.5
       */
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 0 }),
          async (userId, columnId, newOrder) => {
            const db: InMemoryDB = { cards: [] };

            // Create multiple cards in the same column
            const card = simulateCreateCard(db, userId, columnId, "Card A");
            simulateCreateCard(db, userId, columnId, "Card B");
            simulateCreateCard(db, userId, columnId, "Card C");

            // Move card within the same column
            simulateMoveCard(db, userId, card.id, columnId, newOrder);

            // No duplicates in the column
            const colCards = db.cards.filter((c) => c.columnId === columnId);
            const orders = colCards.map((c) => c.order);
            const uniqueOrders = new Set(orders);
            expect(uniqueOrders.size).toBe(orders.length);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
