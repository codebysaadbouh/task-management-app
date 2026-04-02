import { mysqlTable, varchar, int, timestamp } from "drizzle-orm/mysql-core";
import { boards } from "./boards";

export const columns = mysqlTable("columns", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  boardId: varchar("board_id", { length: 36 })
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  order: int("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Column = typeof columns.$inferSelect;
export type NewColumn = typeof columns.$inferInsert;
