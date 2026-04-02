"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createCard as createCardService,
  moveCard as moveCardService,
  updateCard as updateCardService,
  deleteCard as deleteCardService,
} from "@/server/services/card.service";
import type { Card } from "@/server/db/schema/cards";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function createCard(
  columnId: string,
  title: string,
  description?: string
): Promise<ActionResult<Card>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    const card = await createCardService(session.user.id, columnId, title, description);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: card };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to create card", code: "INTERNAL_ERROR" };
  }
}

export async function moveCard(
  cardId: string,
  targetColumnId: string,
  newOrder: number
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    await moveCardService(session.user.id, cardId, targetColumnId, newOrder);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: undefined };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to move card", code: "INTERNAL_ERROR" };
  }
}

export async function updateCard(
  cardId: string,
  data: { title?: string; description?: string }
): Promise<ActionResult<Card>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    const card = await updateCardService(session.user.id, cardId, data);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: card };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to update card", code: "INTERNAL_ERROR" };
  }
}

export async function deleteCard(cardId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "FORBIDDEN" };
    }
    await deleteCardService(session.user.id, cardId);
    revalidatePath("/boards/[boardId]", "page");
    return { success: true, data: undefined };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return { success: false, error: "Forbidden", code: "FORBIDDEN" };
    }
    return { success: false, error: "Failed to delete card", code: "INTERNAL_ERROR" };
  }
}
