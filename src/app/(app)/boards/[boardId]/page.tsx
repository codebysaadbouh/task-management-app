import { notFound, redirect } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { boards } from "@/server/db/schema/boards";
import { columns } from "@/server/db/schema/columns";
import { cards } from "@/server/db/schema/cards";
import type { Column } from "@/server/db/schema/columns";
import type { Card } from "@/server/db/schema/cards";
import KanbanBoardClient from "@/components/board/KanbanBoardClient";
import { LayoutGrid } from "lucide-react";

export const dynamic = "force-dynamic";

interface BoardPageProps {
  params: Promise<{ boardId: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { boardId } = await params;

  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, session.user.id)))
    .limit(1);

  if (!board) {
    notFound();
  }

  const boardColumns: Column[] = await db
    .select()
    .from(columns)
    .where(eq(columns.boardId, boardId))
    .orderBy(asc(columns.order));

  const columnIds = boardColumns.map((c) => c.id);

  let boardCards: Card[] = [];
  if (columnIds.length > 0) {
    const allCards = await db
      .select()
      .from(cards)
      .orderBy(asc(cards.order));

    boardCards = allCards.filter((card) => columnIds.includes(card.columnId));
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary">
          <LayoutGrid className="w-4 h-4" />
        </div>
        <h1 className="text-base font-semibold truncate">{board.name}</h1>
      </div>
      <main className="flex-1 overflow-hidden">
        <KanbanBoardClient
          boardId={boardId}
          initialColumns={boardColumns}
          initialCards={boardCards}
        />
      </main>
    </div>
  );
}
