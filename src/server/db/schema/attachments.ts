import { mysqlTable, varchar, int, timestamp } from "drizzle-orm/mysql-core";
import { cards } from "./cards";

export const attachments = mysqlTable("attachments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  cardId: varchar("card_id", { length: 36 })
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  size: int("size").notNull(), // in bytes
  mimeType: varchar("mime_type", { length: 127 }).notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull(), // MinIO object key
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
