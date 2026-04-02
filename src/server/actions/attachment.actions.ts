"use server";

import { auth } from "@/lib/auth";
import {
  uploadAttachment as uploadAttachmentService,
  getDownloadUrl as getDownloadUrlService,
  deleteAttachment as deleteAttachmentService,
} from "@/server/services/attachment.service";
import type { AttachmentMetadata } from "@/server/services/attachment.service";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function uploadAttachment(
  cardId: string,
  formData: FormData
): Promise<ActionResult<AttachmentMetadata>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié", code: "UNAUTHORIZED" };
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { success: false, error: "Fichier manquant ou invalide", code: "VALIDATION_ERROR" };
    }

    return await uploadAttachmentService(session.user.id, cardId, file);
  } catch {
    return { success: false, error: "Échec du téléversement", code: "INTERNAL_ERROR" };
  }
}

export async function getDownloadUrl(
  attachmentId: string
): Promise<ActionResult<string>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié", code: "UNAUTHORIZED" };
    }

    return await getDownloadUrlService(session.user.id, attachmentId);
  } catch {
    return { success: false, error: "Impossible de générer l'URL de téléchargement", code: "INTERNAL_ERROR" };
  }
}

export async function getAttachments(
  cardId: string
): Promise<ActionResult<AttachmentMetadata[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié", code: "UNAUTHORIZED" };
    }
    const { db } = await import("@/server/db");
    const { attachments } = await import("@/server/db/schema/attachments");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.cardId, cardId));
    return { success: true, data: rows };
  } catch {
    return { success: false, error: "Impossible de charger les pièces jointes", code: "INTERNAL_ERROR" };
  }
}

export async function deleteAttachment(
  attachmentId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié", code: "UNAUTHORIZED" };
    }

    return await deleteAttachmentService(session.user.id, attachmentId);
  } catch {
    return { success: false, error: "Échec de la suppression", code: "INTERNAL_ERROR" };
  }
}
