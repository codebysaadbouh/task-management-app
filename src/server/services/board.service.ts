import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { boards } from "@/server/db/schema/boards";
import type { Board } from "@/server/db/schema/boards";

export async function createBoard(userId: string, name: string): Promise<Board> {
  const id = crypto.randomUUID();
  await db.insert(boards).values({ id, userId, name });
  const [board] = await db.select().from(boards).where(eq(boards.id, id)).limit(1);
  return board;
}

export async function getUserBoards(userId: string): Promise<Board[]> {
  return db.select().from(boards).where(eq(boards.userId, userId));
}

export async function renameBoard(
  userId: string,
  boardId: string,
  name: string
): Promise<void> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    const error = new Error("Forbidden") as Error & { code: string };
    error.code = "FORBIDDEN";
    throw error;
  }

  await db.update(boards).set({ name }).where(eq(boards.id, boardId));
}

export async function deleteBoard(userId: string, boardId: string): Promise<void> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    const error = new Error("Forbidden") as Error & { code: string };
    error.code = "FORBIDDEN";
    throw error;
  }

  await db.delete(boards).where(eq(boards.id, boardId));
}
