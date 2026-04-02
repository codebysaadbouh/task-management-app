"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { renameColumn, deleteColumn } from "@/server/actions/column.actions";
import { createCard } from "@/server/actions/card.actions";
import type { Column } from "@/server/db/schema/columns";
import type { Card } from "@/server/db/schema/cards";
import BoardCard from "./BoardCard";

interface BoardColumnProps {
  column: Column;
  cards: Card[];
  boardId: string;
  isDragOverlay?: boolean;
  onColumnUpdate: (column: Column) => void;
  onColumnDelete: (columnId: string) => void;
  onCardCreate: (card: Card) => void;
  onCardDelete: (cardId: string) => void;
  onCardUpdate?: (card: Card) => void;
}

export default function BoardColumn({
  column,
  cards,
  isDragOverlay = false,
  onColumnUpdate,
  onColumnDelete,
  onCardCreate,
  onCardDelete,
  onCardUpdate,
}: BoardColumnProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");

  // Droppable for cards dropped into this column
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", column },
  });

  // Sortable for the column itself (drag to reorder columns)
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "column", column },
    disabled: isDragOverlay,
  });

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      };

  async function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === column.name) {
      setIsRenameOpen(false);
      return;
    }
    setIsRenaming(true);
    const result = await renameColumn(column.id, trimmed);
    if (result.success) {
      onColumnUpdate({ ...column, name: trimmed });
      setIsRenameOpen(false);
    } else {
      toast.error("Impossible de renommer la colonne. Veuillez réessayer.");
    }
    setIsRenaming(false);
  }

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteColumn(column.id);
    if (result.success) {
      onColumnDelete(column.id);
      setIsDeleteOpen(false);
    } else {
      toast.error("Impossible de supprimer la colonne. Veuillez réessayer.");
    }
    setIsDeleting(false);
  }

  async function handleAddCard() {
    const trimmed = newCardTitle.trim();
    if (!trimmed) return;
    setIsAddingCard(true);
    const result = await createCard(column.id, trimmed);
    if (result.success) {
      onCardCreate(result.data);
      setNewCardTitle("");
    } else {
      toast.error("Impossible de créer la carte. Veuillez réessayer.");
    }
    setIsAddingCard(false);
  }

  const cardIds = cards.map((c) => c.id);

  return (
    <>
      <div
        ref={setSortableRef}
        style={style}
        className="flex flex-col w-72 shrink-0 rounded-xl bg-muted/60 border border-border shadow-sm"
      >
        {/* Column header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
          {!isDragOverlay && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
              aria-label="Déplacer la colonne"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <span className="flex-1 font-semibold text-sm truncate">{column.name}</span>
          <span className="text-xs font-medium text-muted-foreground bg-background rounded-full px-2 py-0.5 border border-border">
            {cards.length}
          </span>
          {!isDragOverlay && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => { setRenameValue(column.name); setIsRenameOpen(true); }}
                aria-label="Renommer la colonne"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => setIsDeleteOpen(true)}
                aria-label="Supprimer la colonne"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {/* Cards list — droppable zone */}
        <div
          ref={setDropRef}
          className={`flex flex-col gap-2 p-2 flex-1 min-h-[60px] transition-colors ${
            isOver ? "bg-primary/5" : ""
          }`}
        >
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {cards.map((card) => (
              <BoardCard
                key={card.id}
                card={card}
                onCardDelete={onCardDelete}
                onCardUpdate={onCardUpdate}
              />
            ))}
          </SortableContext>
        </div>

        {/* Add card */}
        {!isDragOverlay && (
          <div className="p-2 border-t border-border">
            {isAddingCard ? (
              <div className="flex flex-col gap-2">
                <Input
                  autoFocus
                  placeholder="Titre de la carte…"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCard();
                    if (e.key === "Escape") {
                      setIsAddingCard(false);
                      setNewCardTitle("");
                    }
                  }}
                  className="h-8 text-sm"
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddCard} disabled={!newCardTitle.trim()}>
                    Ajouter
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setIsAddingCard(false);
                      setNewCardTitle("");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 gap-1 text-muted-foreground hover:text-foreground text-xs justify-start"
                onClick={() => setIsAddingCard(true)}
              >
                <Plus className="h-3 w-3" />
                Ajouter une carte
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer la colonne</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
            placeholder="Nom de la colonne"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la colonne</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer la colonne{" "}
            <strong>{column.name}</strong> ? Toutes les cartes qu&apos;elle contient seront
            également supprimées. Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
