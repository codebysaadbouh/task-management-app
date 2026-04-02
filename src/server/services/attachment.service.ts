import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { attachments } from "@/server/db/schema/attachments";
import { cards } from "@/server/db/schema/cards";
import { columns } from "@/server/db/schema/columns";
import { boards } from "@/server/db/schema/boards";
import { putObject, removeObject, presignedGetObject } from "@/lib/minio";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type AttachmentMetadata = {
  id: string;
  cardId: string;
  name: string;
  size: number;
  mimeType: string;
  storageKey: string;
  createdAt: Date;
};

interface FileInput {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Verify that a card belongs to the given user via card → column → board */
async function verifyCardOwnership(
  userId: string,
  cardId: string
): Promise<boolean> {
  const result = await db
    .select({ boardUserId: boards.userId })
    .from(cards)
    .innerJoin(columns, eq(cards.columnId, columns.id))
    .innerJoin(boards, eq(columns.boardId, boards.id))
    .where(eq(cards.id, cardId))
    .limit(1);

  return result.length > 0 && result[0].boardUserId === userId;
}

/** Verify that an attachment belongs to the given user */
async function verifyAttachmentOwnership(
  userId: string,
  attachmentId: string
): Promise<{ owned: boolean; storageKey?: string; cardId?: string }> {
  const result = await db
    .select({
      boardUserId: boards.userId,
      storageKey: attachments.storageKey,
      cardId: attachments.cardId,
    })
    .from(attachments)
    .innerJoin(cards, eq(attachments.cardId, cards.id))
    .innerJoin(columns, eq(cards.columnId, columns.id))
    .innerJoin(boards, eq(columns.boardId, boards.id))
    .where(eq(attachments.id, attachmentId))
    .limit(1);

  if (result.length === 0) {
    return { owned: false };
  }

  return {
    owned: result[0].boardUserId === userId,
    storageKey: result[0].storageKey,
    cardId: result[0].cardId,
  };
}

/**
 * Upload a file attachment to a card.
 * - Validates file size ≤ 20 MB
 * - Uploads to MinIO first
 * - Inserts metadata in DB; rolls back MinIO upload on DB failure
 */
export async function uploadAttachment(
  userId: string,
  cardId: string,
  file: FileInput
): Promise<ActionResult<AttachmentMetadata>> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: "Le fichier dépasse la taille maximale autorisée de 20 Mo.",
      code: "FILE_TOO_LARGE",
    };
  }

  // Verify card ownership
  const owned = await verifyCardOwnership(userId, cardId);
  if (!owned) {
    return {
      success: false,
      error: "Accès refusé ou carte introuvable.",
      code: "FORBIDDEN",
    };
  }

  // Generate a unique storage key
  const uniqueId = crypto.randomUUID();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `attachments/${cardId}/${uniqueId}-${sanitizedName}`;

  // Upload to MinIO first
  let buffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    await putObject(storageKey, buffer, file.type);
  } catch (err) {
    console.error("[AttachmentService] MinIO upload failed:", err);
    return {
      success: false,
      error: "Échec du téléversement vers le stockage.",
      code: "STORAGE_ERROR",
    };
  }

  // Insert metadata in DB; clean up MinIO on failure
  const attachmentId = crypto.randomUUID();
  try {
    await db.insert(attachments).values({
      id: attachmentId,
      cardId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      storageKey,
    });

    const [record] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId))
      .limit(1);

    return { success: true, data: record };
  } catch (err) {
    console.error("[AttachmentService] DB insert failed, cleaning up MinIO:", err);
    // Best-effort cleanup
    try {
      await removeObject(storageKey);
    } catch (cleanupErr) {
      console.error("[AttachmentService] MinIO cleanup failed:", cleanupErr);
    }
    return {
      success: false,
      error: "Échec de l'enregistrement des métadonnées.",
      code: "INTERNAL_ERROR",
    };
  }
}

/**
 * Generate a presigned download URL for an attachment (1 hour expiry).
 */
export async function getDownloadUrl(
  userId: string,
  attachmentId: string
): Promise<ActionResult<string>> {
  const { owned, storageKey } = await verifyAttachmentOwnership(userId, attachmentId);

  if (!owned) {
    return {
      success: false,
      error: "Accès refusé ou pièce jointe introuvable.",
      code: "FORBIDDEN",
    };
  }

  try {
    const url = await presignedGetObject(storageKey!, 3600); // 1 hour
    return { success: true, data: url };
  } catch (err) {
    console.error("[AttachmentService] Failed to generate presigned URL:", err);
    return {
      success: false,
      error: "Impossible de générer l'URL de téléchargement.",
      code: "STORAGE_ERROR",
    };
  }
}

/**
 * Delete an attachment: remove from MinIO first, then from DB.
 * If MinIO deletion fails, the DB record is preserved (no orphan metadata).
 */
export async function deleteAttachment(
  userId: string,
  attachmentId: string
): Promise<ActionResult<void>> {
  const { owned, storageKey } = await verifyAttachmentOwnership(userId, attachmentId);

  if (!owned) {
    return {
      success: false,
      error: "Accès refusé ou pièce jointe introuvable.",
      code: "FORBIDDEN",
    };
  }

  // Delete from MinIO first
  try {
    await removeObject(storageKey!);
  } catch (err) {
    console.error("[AttachmentService] MinIO deletion failed:", err);
    return {
      success: false,
      error: "Échec de la suppression du fichier dans le stockage.",
      code: "STORAGE_ERROR",
    };
  }

  // Delete from DB
  try {
    await db
      .delete(attachments)
      .where(eq(attachments.id, attachmentId));

    return { success: true, data: undefined };
  } catch (err) {
    console.error("[AttachmentService] DB deletion failed:", err);
    return {
      success: false,
      error: "Échec de la suppression des métadonnées.",
      code: "INTERNAL_ERROR",
    };
  }
}
