"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Column } from "@/server/db/schema/columns";
import type { Card } from "@/server/db/schema/cards";
import { addColumn, reorderColumns } from "@/server/actions/column.actions";
import { moveCard } from "@/server/actions/card.actions";
import BoardColumn from "./BoardColumn";
import BoardCard from "./BoardCard";

interface KanbanBoardProps {
  boardId: string;
  initialColumns: Column[];
  initialCards: Card[];
}

export default function KanbanBoard({
  boardId,
  initialColumns,
  initialCards,
}: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>(
    [...initialColumns].sort((a, b) => a.order - b.order)
  );
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const getCardsForColumn = useCallback(
    (columnId: string) =>
      cards
        .filter((c) => c.columnId === columnId)
        .sort((a, b) => a.order - b.order),
    [cards]
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const type = active.data.current?.type as string | undefined;
    if (type === "card") {
      setActiveCard(active.data.current?.card as Card);
    } else if (type === "column") {
      setActiveColumn(active.data.current?.column as Column);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type as string | undefined;
    if (activeType !== "card") return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const overType = over.data.current?.type as string | undefined;
    const targetColumnId =
      overType === "column"
        ? overId
        : (over.data.current?.card as Card | undefined)?.columnId;

    if (!targetColumnId) return;

    setCards((prev) => {
      const activeCardData = prev.find((c) => c.id === activeCardId);
      if (!activeCardData) return prev;
      if (activeCardData.columnId === targetColumnId) return prev;

      const targetCards = prev
        .filter((c) => c.columnId === targetColumnId)
        .sort((a, b) => a.order - b.order);

      const newOrder =
        overType === "card"
          ? (over.data.current?.card as Card).order
          : targetCards.length;

      return prev.map((c) =>
        c.id === activeCardId
          ? { ...c, columnId: targetColumnId, order: newOrder }
          : c
      );
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;

    const activeType = active.data.current?.type as string | undefined;

    // --- Column reorder ---
    if (activeType === "column") {
      const activeColId = active.id as string;
      const overColId = over.id as string;
      if (activeColId === overColId) return;

      const prevColumns = columns;
      const oldIndex = columns.findIndex((c) => c.id === activeColId);
      const newIndex = columns.findIndex((c) => c.id === overColId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(columns, oldIndex, newIndex).map(
        (col, idx) => ({ ...col, order: idx })
      );
      setColumns(reordered);

      const result = await reorderColumns(
        boardId,
        reordered.map((c) => c.id)
      );
      if (!result.success) {
        setColumns(prevColumns);
        toast.error("Impossible de réordonner les colonnes. Veuillez réessayer.");
      }
      return;
    }

    // --- Card move ---
    if (activeType === "card") {
      const activeCardId = active.id as string;
      const overType = over.data.current?.type as string | undefined;

      const targetColumnId =
        overType === "column"
          ? (over.id as string)
          : (over.data.current?.card as Card | undefined)?.columnId;

      if (!targetColumnId) return;

      const prevCards = cards;
      const movedCard = cards.find((c) => c.id === activeCardId);
      if (!movedCard) return;

      // Compute final order within target column
      const targetCards = cards
        .filter((c) => c.columnId === targetColumnId && c.id !== activeCardId)
        .sort((a, b) => a.order - b.order);

      let newOrder: number;
      if (overType === "card") {
        const overCard = over.data.current?.card as Card;
        const overIndex = targetCards.findIndex((c) => c.id === overCard.id);
        newOrder = overIndex === -1 ? targetCards.length : overIndex;
      } else {
        newOrder = targetCards.length;
      }

      // Reindex target column cards
      const updatedCards = cards.map((c) => {
        if (c.id === activeCardId) {
          return { ...c, columnId: targetColumnId, order: newOrder };
        }
        if (c.columnId === targetColumnId && c.id !== activeCardId) {
          const idx = targetCards.findIndex((tc) => tc.id === c.id);
          if (idx === -1) return c;
          return { ...c, order: idx >= newOrder ? idx + 1 : idx };
        }
        return c;
      });
      setCards(updatedCards);

      const result = await moveCard(activeCardId, targetColumnId, newOrder);
      if (!result.success) {
        setCards(prevCards);
        toast.error("Impossible de déplacer la carte. Veuillez réessayer.");
      }
      return;
    }
  }

  async function handleAddColumn() {
    setIsAddingColumn(true);
    const name = `Colonne ${columns.length + 1}`;
    const result = await addColumn(boardId, name);
    if (result.success) {
      setColumns((prev) => [...prev, result.data]);
    } else {
      toast.error("Impossible d'ajouter une colonne. Veuillez réessayer.");
    }
    setIsAddingColumn(false);
  }

  const columnIds: UniqueIdentifier[] = columns.map((c) => c.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto p-4 h-full items-start">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              cards={getCardsForColumn(column.id)}
              boardId={boardId}
              onColumnUpdate={(updated) =>
                setColumns((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                )
              }
              onColumnDelete={(columnId) =>
                setColumns((prev) => prev.filter((c) => c.id !== columnId))
              }
              onCardCreate={(card) => setCards((prev) => [...prev, card])}
              onCardDelete={(cardId) =>
                setCards((prev) => prev.filter((c) => c.id !== cardId))
              }
              onCardUpdate={(updated) =>
                setCards((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                )
              }
            />
          ))}
        </SortableContext>

        <Button
          variant="outline"
          className="shrink-0 h-10 gap-2 rounded-xl border-dashed text-muted-foreground hover:text-foreground hover:border-border bg-transparent hover:bg-muted/50"
          onClick={handleAddColumn}
          disabled={isAddingColumn}
        >
          <Plus className="h-4 w-4" />
          {isAddingColumn ? "Ajout…" : "Ajouter une colonne"}
        </Button>
      </div>

      <DragOverlay>
        {activeCard && (
          <BoardCard card={activeCard} isDragOverlay />
        )}
        {activeColumn && (
          <BoardColumn
            column={activeColumn}
            cards={getCardsForColumn(activeColumn.id)}
            boardId={boardId}
            isDragOverlay
            onColumnUpdate={() => {}}
            onColumnDelete={() => {}}
            onCardCreate={() => {}}
            onCardDelete={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
