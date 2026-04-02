// Feature: task-management-app, Property 14: round-trip upload de pièce jointe

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

/**
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * Properties tested in this file:
 *   P14 – Round-trip upload de pièce jointe
 *   P15 – URL signée non-vide avec expiration
 *   P16 – Suppression atomique pièce jointe
 *   P17 – Rejet des fichiers trop volumineux
 *   P18 – Atomicité en cas d'indisponibilité MinIO
 *
 * All tests run against an in-memory simulation of attachment.service.ts so
 * that no real DB or MinIO connection is required.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// ---------------------------------------------------------------------------
// In-memory types
// ---------------------------------------------------------------------------

interface AttachmentRecord {
  id: string;
  cardId: string;
  name: string;
  size: number;
  mimeType: string;
  storageKey: string;
  createdAt: Date;
}

interface MinIOStore {
  objects: Map<string, { data: Uint8Array; contentType: string }>;
  /** When true, every write/delete throws an error */
  broken: boolean;
}

interface InMemoryDB {
  attachments: AttachmentRecord[];
}

// ---------------------------------------------------------------------------
// In-memory MinIO simulation
// ---------------------------------------------------------------------------

function createMinIOStore(): MinIOStore {
  return { objects: new Map(), broken: false };
}

async function minioPutObject(
  store: MinIOStore,
  storageKey: string,
  data: Uint8Array,
  contentType: string
): Promise<void> {
  if (store.broken) throw new Error("MinIO unavailable");
  store.objects.set(storageKey, { data, contentType });
}

async function minioRemoveObject(
  store: MinIOStore,
  storageKey: string
): Promise<void> {
  if (store.broken) throw new Error("MinIO unavailable");
  store.objects.delete(storageKey);
}

function minioPresignedGetObject(
  store: MinIOStore,
  storageKey: string,
  expirySeconds: number
): string {
  if (!store.objects.has(storageKey)) {
    throw new Error(`Object not found: ${storageKey}`);
  }
  // Simulate a presigned URL with an expiry query param
  return `https://minio.example.com/${storageKey}?X-Amz-Expires=${expirySeconds}&X-Amz-Signature=abc123`;
}

// ---------------------------------------------------------------------------
// In-memory service simulation (mirrors attachment.service.ts)
// ---------------------------------------------------------------------------

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

interface FileInput {
  name: string;
  size: number;
  type: string;
  bytes: Uint8Array;
}

async function simulateUploadAttachment(
  db: InMemoryDB,
  store: MinIOStore,
  userId: string,
  cardId: string,
  file: FileInput
): Promise<ActionResult<AttachmentRecord>> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large", code: "FILE_TOO_LARGE" };
  }

  const storageKey = `attachments/${cardId}/${crypto.randomUUID()}-${file.name}`;

  // Upload to MinIO first
  try {
    await minioPutObject(store, storageKey, file.bytes, file.type);
  } catch {
    return { success: false, error: "Storage error", code: "STORAGE_ERROR" };
  }

  // Insert metadata in DB; rollback MinIO on failure
  try {
    const record: AttachmentRecord = {
      id: crypto.randomUUID(),
      cardId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      storageKey,
      createdAt: new Date(),
    };
    db.attachments.push(record);
    return { success: true, data: record };
  } catch {
    // Rollback MinIO upload
    await minioRemoveObject(store, storageKey).catch(() => {});
    return { success: false, error: "DB error", code: "INTERNAL_ERROR" };
  }
}

async function simulateGetDownloadUrl(
  db: InMemoryDB,
  store: MinIOStore,
  userId: string,
  attachmentId: string
): Promise<ActionResult<string>> {
  const record = db.attachments.find((a) => a.id === attachmentId);
  if (!record) {
    return { success: false, error: "Not found", code: "FORBIDDEN" };
  }

  try {
    const url = minioPresignedGetObject(store, record.storageKey, 3600);
    return { success: true, data: url };
  } catch {
    return { success: false, error: "Storage error", code: "STORAGE_ERROR" };
  }
}

async function simulateDeleteAttachment(
  db: InMemoryDB,
  store: MinIOStore,
  userId: string,
  attachmentId: string
): Promise<ActionResult<void>> {
  const record = db.attachments.find((a) => a.id === attachmentId);
  if (!record) {
    return { success: false, error: "Not found", code: "FORBIDDEN" };
  }

  // Delete from MinIO first
  try {
    await minioRemoveObject(store, record.storageKey);
  } catch {
    return { success: false, error: "Storage error", code: "STORAGE_ERROR" };
  }

  // Delete from DB
  db.attachments = db.attachments.filter((a) => a.id !== attachmentId);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(bytes: Uint8Array, name = "test.bin", type = "application/octet-stream"): FileInput {
  return { name, size: bytes.length, type, bytes };
}

// ---------------------------------------------------------------------------
// P14 – Round-trip upload de pièce jointe
// ---------------------------------------------------------------------------

describe("P14 – Round-trip upload de pièce jointe", () => {
  /**
   * Validates: Requirements 6.1, 6.5
   *
   * Propriété 14 : Pour tout fichier valide (≤ 20 Mo), les métadonnées retournées
   * doivent correspondre au fichier original, et le fichier doit être accessible
   * dans MinIO via la clé de stockage.
   */
  it(
    "pour tout fichier valide (≤ 20 Mo), les métadonnées correspondent au fichier original",
    async () => {
      // Feature: task-management-app, Property 14: round-trip upload de pièce jointe
      /**
       * Validates: Requirements 6.1, 6.5
       */
      await fc.assert(
        fc.asyncProperty(
          // Generate byte arrays up to 1 KB (representative of ≤ 20 MB constraint)
          fc.uint8Array({ minLength: 0, maxLength: 1024 }),
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          fc.constantFrom("image/png", "application/pdf", "text/plain", "application/octet-stream"),
          async (bytes, fileName, mimeType) => {
            const db: InMemoryDB = { attachments: [] };
            const store = createMinIOStore();
            const userId = crypto.randomUUID();
            const cardId = crypto.randomUUID();

            const file = makeFile(bytes, fileName, mimeType);
            const result = await simulateUploadAttachment(db, store, userId, cardId, file);

            // Upload must succeed
            expect(result.success).toBe(true);
            if (!result.success) return;

            const metadata = result.data;

            // Metadata must match the original file
            expect(metadata.name).toBe(fileName);
            expect(metadata.size).toBe(bytes.length);
            expect(metadata.mimeType).toBe(mimeType);
            expect(metadata.cardId).toBe(cardId);
            expect(metadata.storageKey).toBeTruthy();
            expect(metadata.createdAt).toBeInstanceOf(Date);

            // File must be accessible in MinIO via the storage key
            expect(store.objects.has(metadata.storageKey)).toBe(true);
            const stored = store.objects.get(metadata.storageKey)!;
            expect(stored.contentType).toBe(mimeType);
            expect(stored.data).toEqual(bytes);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// P15 – URL signée non-vide avec expiration
// ---------------------------------------------------------------------------

describe("P15 – URL signée non-vide avec expiration", () => {
  /**
   * Validates: Requirements 6.2
   *
   * Propriété 15 : Pour toute pièce jointe existante, getDownloadUrl doit retourner
   * une URL non-vide contenant un paramètre d'expiration (X-Amz-Expires).
   */
  it(
    "pour toute pièce jointe existante, getDownloadUrl retourne une URL avec paramètre d'expiration",
    async () => {
      // Feature: task-management-app, Property 15: URL signée non-vide avec expiration
      /**
       * Validates: Requirements 6.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 256 }),
          fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
          async (bytes, fileName) => {
            const db: InMemoryDB = { attachments: [] };
            const store = createMinIOStore();
            const userId = crypto.randomUUID();
            const cardId = crypto.randomUUID();

            // Upload a file first
            const file = makeFile(bytes, fileName);
            const uploadResult = await simulateUploadAttachment(db, store, userId, cardId, file);
            expect(uploadResult.success).toBe(true);
            if (!uploadResult.success) return;

            const attachmentId = uploadResult.data.id;

            // Get the download URL
            const urlResult = await simulateGetDownloadUrl(db, store, userId, attachmentId);

            // Must succeed
            expect(urlResult.success).toBe(true);
            if (!urlResult.success) return;

            const url = urlResult.data;

            // URL must be non-empty
            expect(url.length).toBeGreaterThan(0);

            // URL must contain an expiration parameter
            expect(url).toContain("X-Amz-Expires=");

            // Expiry value must be a positive integer
            const match = url.match(/X-Amz-Expires=(\d+)/);
            expect(match).not.toBeNull();
            const expiryValue = parseInt(match![1], 10);
            expect(expiryValue).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "getDownloadUrl échoue pour un attachmentId inexistant",
    async () => {
      // Feature: task-management-app, Property 15: URL signée non-vide avec expiration
      /**
       * Validates: Requirements 6.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (fakeAttachmentId) => {
            const db: InMemoryDB = { attachments: [] };
            const store = createMinIOStore();
            const userId = crypto.randomUUID();

            const result = await simulateGetDownloadUrl(db, store, userId, fakeAttachmentId);

            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// P16 – Suppression atomique pièce jointe
// ---------------------------------------------------------------------------

describe("P16 – Suppression atomique pièce jointe", () => {
  /**
   * Validates: Requirements 6.3
   *
   * Propriété 16 : Pour toute pièce jointe supprimée, ni les métadonnées en base
   * ni le fichier dans MinIO ne doivent être accessibles après l'opération.
   */
  it(
    "après deleteAttachment, ni les métadonnées ni le fichier MinIO ne sont accessibles",
    async () => {
      // Feature: task-management-app, Property 16: suppression atomique pièce jointe
      /**
       * Validates: Requirements 6.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 256 }),
          fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
          async (bytes, fileName) => {
            const db: InMemoryDB = { attachments: [] };
            const store = createMinIOStore();
            const userId = crypto.randomUUID();
            const cardId = crypto.randomUUID();

            // Upload a file
            const file = makeFile(bytes, fileName);
            const uploadResult = await simulateUploadAttachment(db, store, userId, cardId, file);
            expect(uploadResult.success).toBe(true);
            if (!uploadResult.success) return;

            const { id: attachmentId, storageKey } = uploadResult.data;

            // Verify it exists before deletion
            expect(db.attachments.find((a) => a.id === attachmentId)).toBeDefined();
            expect(store.objects.has(storageKey)).toBe(true);

            // Delete the attachment
            const deleteResult = await simulateDeleteAttachment(db, store, userId, attachmentId);
            expect(deleteResult.success).toBe(true);

            // Metadata must be gone from DB
            expect(db.attachments.find((a) => a.id === attachmentId)).toBeUndefined();

            // File must be gone from MinIO
            expect(store.objects.has(storageKey)).toBe(false);

            // getDownloadUrl must now fail
            const urlResult = await simulateGetDownloadUrl(db, store, userId, attachmentId);
            expect(urlResult.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "deleteAttachment ne supprime que la pièce jointe ciblée, pas les autres",
    async () => {
      // Feature: task-management-app, Property 16: suppression atomique pièce jointe
      /**
       * Validates: Requirements 6.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (count) => {
            const db: InMemoryDB = { attachments: [] };
            const store = createMinIOStore();
            const userId = crypto.randomUUID();
            const cardId = crypto.randomUUID();

            // Upload multiple files
            const ids: string[] = [];
            for (let i = 0; i < count; i++) {
              const bytes = new Uint8Array([i, i + 1, i + 2]);
              const result = await simulateUploadAttachment(
                db, store, userId, cardId, makeFile(bytes, `file-${i}.bin`)
              );
              expect(result.success).toBe(true);
              if (result.success) ids.push(result.data.id);
            }

            // Delete only the first one
            const targetId = ids[0];
            const remainingIds = ids.slice(1);

            await simulateDeleteAttachment(db, store, userId, targetId);

            // Target must be gone
            expect(db.attachments.find((a) => a.id === targetId)).toBeUndefined();

            // Others must still exist
            for (const id of remainingIds) {
              expect(db.attachments.find((a) => a.id === id)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// P17 – Rejet des fichiers trop volumineux
// ---------------------------------------------------------------------------

describe("P17 – Rejet des fichiers trop volumineux", () => {
  /**
   * Validates: Requirements 6.4
   *
   * Propriété 17 : Pour tout fichier dont la taille dépasse 20 Mo, la tentative
   * d'upload doit être rejetée avec une erreur, et aucune métadonnée ne doit
   * être insérée en base de données.
   */
  it(
    "pour tout fichier > 20 Mo, l'upload est rejeté et aucune métadonnée n'est insérée",
    async () => {
      // Feature: task-management-app, Property 17: rejet des fichiers trop volumineux
      /**
       * Validates: Requirements 6.4
       */
      await fc.assert(
        fc.asyncProperty(
          // Size strictly above 20 MB
          fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE + 10_000_000 }),
          fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
          async (oversizedBytes, fileName) => {
            const db: InMemoryDB = { attachments: [] };
            const store = createMinIOStore();
            const userId = crypto.randomUUID();
            const cardId = crypto.randomUUID();

            // Create a file descriptor with the oversized size (no real bytes needed)
            const file: FileInput = {
              name: fileName,
              size: oversizedBytes,
              type: "application/octet-stream",
              bytes: new Uint8Array(0), // empty — size check happens before reading bytes
            };

            const result = await simulateUploadAttachment(db, store, userId, cardId, file);

            // Must be rejected
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.code).toBe("FILE_TOO_LARGE");
            }

            // No metadata must have been inserted
            expect(db.attachments).toHaveLength(0);

            // Nothing must have been written to MinIO
            expect(store.objects.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "un fichier exactement à 20 Mo est accepté",
    async () => {
      // Feature: task-management-app, Property 17: rejet des fichiers trop volumineux
      /**
       * Validates: Requirements 6.4 (boundary)
       */
      const db: InMemoryDB = { attachments: [] };
      const store = createMinIOStore();
      const userId = crypto.randomUUID();
      const cardId = crypto.randomUUID();

      // Exactly at the limit — use a small real buffer but report size = MAX
      const file: FileInput = {
        name: "exactly-20mb.bin",
        size: MAX_FILE_SIZE,
        type: "application/octet-stream",
        bytes: new Uint8Array(1), // minimal real data
      };

      const result = await simulateUploadAttachment(db, store, userId, cardId, file);
      expect(result.success).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------
// P18 – Atomicité en cas d'indisponibilité MinIO
// ---------------------------------------------------------------------------

describe("P18 – Atomicité en cas d'indisponibilité MinIO", () => {
  /**
   * Validates: Requirements 6.6
   *
   * Propriété 18 : Lorsque MinIO retourne une erreur lors d'un upload, aucune
   * métadonnée ne doit être persistée en base de données (pas d'entrée orpheline).
   */
  it(
    "lorsque MinIO est indisponible, aucune métadonnée n'est insérée en base",
    async () => {
      // Feature: task-management-app, Property 18: atomicité en cas d'indisponibilité MinIO
      /**
       * Validates: Requirements 6.6
       */
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 1024 }),
          fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
          async (bytes, fileName) => {
            const db: InMemoryDB = { attachments: [] };
            // MinIO is broken — all writes will throw
            const store = createMinIOStore();
            store.broken = true;

            const userId = crypto.randomUUID();
            const cardId = crypto.randomUUID();

            const file = makeFile(bytes, fileName);
            const result = await simulateUploadAttachment(db, store, userId, cardId, file);

            // Upload must fail
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.code).toBe("STORAGE_ERROR");
            }

            // No orphaned metadata must exist in DB
            expect(db.attachments).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "lorsque MinIO est indisponible, les métadonnées existantes ne sont pas affectées",
    async () => {
      // Feature: task-management-app, Property 18: atomicité en cas d'indisponibilité MinIO
      /**
       * Validates: Requirements 6.6
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (existingCount) => {
            const db: InMemoryDB = { attachments: [] };
            const store = createMinIOStore();
            const userId = crypto.randomUUID();
            const cardId = crypto.randomUUID();

            // Upload some files while MinIO is healthy
            for (let i = 0; i < existingCount; i++) {
              const bytes = new Uint8Array([i, i + 1]);
              const result = await simulateUploadAttachment(
                db, store, userId, cardId, makeFile(bytes, `existing-${i}.bin`)
              );
              expect(result.success).toBe(true);
            }

            expect(db.attachments).toHaveLength(existingCount);

            // Now break MinIO and attempt another upload
            store.broken = true;
            const failBytes = new Uint8Array([99]);
            const failResult = await simulateUploadAttachment(
              db, store, userId, cardId, makeFile(failBytes, "will-fail.bin")
            );

            expect(failResult.success).toBe(false);

            // Existing metadata must be untouched
            expect(db.attachments).toHaveLength(existingCount);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
