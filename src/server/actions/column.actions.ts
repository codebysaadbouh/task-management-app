"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  addColumn as addColumnService,
  reorderColumns as reorderColumnsService,
  renameColumn as renameColumnService,
  deleteColumn as deleteColumnService,
} from "@/server/services/column.service";
import type { Column } from "@/server/db/schema/columns";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function addColumn(
  boardId: string,
  name: string
): Promise<ActionResult<Column>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    const column = await addColumnService(session.user.id, boardId, name);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: column };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to add column", code: "INTERNAL_ERROR" };
  }
}

export async function reorderColumns(
  boardId: string,
  orderedIds: string[]
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    await reorderColumnsService(session.user.id, boardId, orderedIds);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: undefined };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to reorder columns", code: "INTERNAL_ERROR" };
  }
}

export async function renameColumn(
  columnId: string,
  name: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    await renameColumnService(session.user.id, columnId, name);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: undefined };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to rename column", code: "INTERNAL_ERROR" };
  }
}

export async function deleteColumn(
  columnId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    await deleteColumnService(session.user.id, columnId);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: undefined };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to delete column", code: "INTERNAL_ERROR" };
  }
}
