"use client";

import { useEffect, useState } from "react";
import type { Column } from "@/server/db/schema/columns";
import type { Card } from "@/server/db/schema/cards";

interface KanbanBoardClientProps {
  boardId: string;
  initialColumns: Column[];
  initialCards: Card[];
}

// Lazy-loaded only on client — never imported during SSR
let KanbanBoardLazy: React.ComponentType<KanbanBoardClientProps> | null = null;

export default function KanbanBoardClient(props: KanbanBoardClientProps) {
  const [Board, setBoard] = useState<React.ComponentType<KanbanBoardClientProps> | null>(null);

  useEffect(() => {
    // Import only runs in the browser, after hydration is complete
    if (KanbanBoardLazy) {
      setBoard(() => KanbanBoardLazy);
    } else {
      import("./KanbanBoard").then((mod) => {
        KanbanBoardLazy = mod.default;
        setBoard(() => mod.default);
      });
    }
  }, []);

  if (!Board) {
    // Identical markup on server and client — no mismatch possible
    return (
      <div className="flex gap-4 overflow-x-auto p-4 h-full items-start">
        {props.initialColumns.map((col) => (
          <div
            key={col.id}
            className="flex flex-col w-72 shrink-0 rounded-lg border bg-muted/40"
          >
            <div className="px-3 py-2 border-b border-border font-medium text-sm">
              {col.name}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <Board {...props} />;
}
