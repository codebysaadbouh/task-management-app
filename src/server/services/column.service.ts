import { eq, and, max } from "drizzle-orm";
import { db } from "@/server/db";
import { columns } from "@/server/db/schema/columns";
import { boards } from "@/server/db/schema/boards";
import type { Column } from "@/server/db/schema/columns";

function forbiddenError(): Error & { code: string } {
  const error = new Error("Forbidden") as Error & { code: string };
  error.code = "FORBIDDEN";
  return error;
}

async function verifyBoardOwnership(userId: string, boardId: string): Promise<void> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) throw forbiddenError();
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

export async function addColumn(
  userId: string,
  boardId: string,
  name: string
): Promise<Column> {
  await verifyBoardOwnership(userId, boardId);

  const [result] = await db
    .select({ maxOrder: max(columns.order) })
    .from(columns)
    .where(eq(columns.boardId, boardId));

  const nextOrder = (result?.maxOrder ?? -1) + 1;

  const id = crypto.randomUUID();
  await db.insert(columns).values({ id, boardId, name, order: nextOrder });

  const [column] = await db
    .select()
    .from(columns)
    .where(eq(columns.id, id))
    .limit(1);

  return column;
}

export async function reorderColumns(
  userId: string,
  boardId: string,
  orderedIds: string[]
): Promise<void> {
  await verifyBoardOwnership(userId, boardId);

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(columns)
        .set({ order: i })
        .where(and(eq(columns.id, orderedIds[i]), eq(columns.boardId, boardId)));
    }
  });
}

export async function renameColumn(
  userId: string,
  columnId: string,
  name: string
): Promise<void> {
  await verifyColumnOwnership(userId, columnId);
  await db.update(columns).set({ name }).where(eq(columns.id, columnId));
}

export async function deleteColumn(
  userId: string,
  columnId: string
): Promise<void> {
  await verifyColumnOwnership(userId, columnId);
  await db.delete(columns).where(eq(columns.id, columnId));
}
