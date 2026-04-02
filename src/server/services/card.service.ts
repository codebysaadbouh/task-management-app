import { eq, and, max, asc, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { cards } from "@/server/db/schema/cards";
import { columns } from "@/server/db/schema/columns";
import { boards } from "@/server/db/schema/boards";
import type { Card } from "@/server/db/schema/cards";

function forbiddenError(): Error & { code: string } {
  const error = new Error("Forbidden") as Error & { code: string };
  error.code = "FORBIDDEN";
  return error;
}

async function verifyCardOwnership(userId: string, cardId: string): Promise<Card> {
  const [row] = await db
    .select({ card: cards })
    .from(cards)
    .innerJoin(columns, eq(cards.columnId, columns.id))
    .innerJoin(boards, eq(columns.boardId, boards.id))
    .where(and(eq(cards.id, cardId), eq(boards.userId, userId)))
    .limit(1);

  if (!row) throw forbiddenError();
  return row.card;
}

async function verifyColumnOwnership(userId: string, columnId: string): Promise<void> {
  const [row] = await db
    .select({ columnId: columns.id })
    .from(columns)
    .innerJoin(boards, eq(columns.boardId, boards.id))
    .where(and(eq(columns.id, columnId), eq(boards.userId, userId)))
    .limit(1);

  if (!row) throw forbiddenError();
}

export async function createCard(
  userId: string,
  columnId: string,
  title: string,
  description?: string
): Promise<Card> {
  await verifyColumnOwnership(userId, columnId);

  const [result] = await db
    .select({ maxOrder: max(cards.order) })
    .from(cards)
    .where(eq(cards.columnId, columnId));

  const nextOrder = (result?.maxOrder ?? -1) + 1;

  const id = crypto.randomUUID();
  await db.insert(cards).values({ id, columnId, title, description, order: nextOrder });

  const [card] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return card;
}

export async function moveCard(
  userId: string,
  cardId: string,
  targetColumnId: string,
  newOrder: number
): Promise<void> {
  const card = await verifyCardOwnership(userId, cardId);
  await verifyColumnOwnership(userId, targetColumnId);

  const sourceColumnId = card.columnId;

  await db.transaction(async (tx) => {
    // Move the card to the target column at the desired order
    await tx
      .update(cards)
      .set({ columnId: targetColumnId, order: newOrder })
      .where(eq(cards.id, cardId));

    // Reindex source column (if different from target)
    if (sourceColumnId !== targetColumnId) {
      const sourceCards = await tx
        .select()
        .from(cards)
        .where(and(eq(cards.columnId, sourceColumnId), ne(cards.id, cardId)))
        .orderBy(asc(cards.order));

      for (let i = 0; i < sourceCards.length; i++) {
        await tx
          .update(cards)
          .set({ order: i })
          .where(eq(cards.id, sourceCards[i].id));
      }
    }

    // Reindex target column
    const targetCards = await tx
      .select()
      .from(cards)
      .where(eq(cards.columnId, targetColumnId))
      .orderBy(asc(cards.order));

    // Place the moved card at newOrder, shift others
    const withoutMoved = targetCards.filter((c) => c.id !== cardId);
    const reindexed = [
      ...withoutMoved.slice(0, newOrder),
      { id: cardId },
      ...withoutMoved.slice(newOrder),
    ];

    for (let i = 0; i < reindexed.length; i++) {
      await tx
        .update(cards)
        .set({ order: i })
        .where(eq(cards.id, reindexed[i].id));
    }
  });
}

export async function updateCard(
  userId: string,
  cardId: string,
  data: { title?: string; description?: string }
): Promise<Card> {
  await verifyCardOwnership(userId, cardId);

  await db.update(cards).set(data).where(eq(cards.id, cardId));

  const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  return card;
}

export async function deleteCard(userId: string, cardId: string): Promise<void> {
  await verifyCardOwnership(userId, cardId);
  await db.delete(cards).where(eq(cards.id, cardId));
}
