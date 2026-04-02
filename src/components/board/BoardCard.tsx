"use client";

import { useState, useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { GripVertical, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCard } from "@/server/actions/card.actions";
import type { Card } from "@/server/db/schema/cards";
import { CardDetail } from "@/components/card/CardDetail";

interface BoardCardProps {
  card: Card;
  onCardDelete?: (cardId: string) => void;
  onCardUpdate?: (card: Card) => void;
  isDragOverlay?: boolean;
}

export default function BoardCard({ card, onCardDelete, onCardUpdate, isDragOverlay = false }: BoardCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", card },
    disabled: isDragOverlay,
  });

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      };

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await deleteCard(card.id);
      if (result.success) {
        onCardDelete?.(card.id);
      } else {
        toast.error("Impossible de supprimer la carte. Veuillez réessayer.");
      }
    });
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2.5 text-sm shadow-sm hover:shadow-md hover:border-border/80 transition-all duration-150 ${
          isPending ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {/* Drag handle */}
        {!isDragOverlay && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Déplacer la carte"
            tabIndex={-1}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Card title — click to open detail */}
        <button
          className="flex-1 text-left truncate hover:text-primary transition-colors"
          onClick={() => setIsDetailOpen(true)}
          disabled={isPending}
        >
          {card.title}
        </button>

        {/* Loading indicator */}
        {isPending && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
        )}

        {/* Delete button */}
        {!isDragOverlay && !isPending && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
            onClick={handleDelete}
            aria-label="Supprimer la carte"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Card detail modal */}
      <CardDetail
        card={card}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onCardUpdate={onCardUpdate}
      />
    </>
  );
}
