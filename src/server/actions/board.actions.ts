"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createBoard as createBoardService,
  getUserBoards as getUserBoardsService,
  renameBoard as renameBoardService,
  deleteBoard as deleteBoardService,
} from "@/server/services/board.service";
import type { Board } from "@/server/db/schema/boards";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function createBoard(name: string): Promise<ActionResult<Board>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    const board = await createBoardService(session.user.id, name);
    revalidatePath("/dashboard");
    return { success: true, data: board };
  } catch {
    return { success: false, error: "Failed to create board", code: "INTERNAL_ERROR" };
  }
}

export async function getUserBoards(): Promise<ActionResult<Board[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    const userBoards = await getUserBoardsService(session.user.id);
    return { success: true, data: userBoards };
  } catch {
    return { success: false, error: "Failed to fetch boards", code: "INTERNAL_ERROR" };
  }
}

export async function renameBoard(
  boardId: string,
  name: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    await renameBoardService(session.user.id, boardId, name);
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to rename board", code: "INTERNAL_ERROR" };
  }
}

export async function deleteBoard(boardId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    await deleteBoardService(session.user.id, boardId);
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to delete board", code: "INTERNAL_ERROR" };
  }
}
