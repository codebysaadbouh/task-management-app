"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttachmentList } from "@/components/card/AttachmentList";
import { updateCard } from "@/server/actions/card.actions";
import { getAttachments } from "@/server/actions/attachment.actions";
import type { Card } from "@/server/db/schema/cards";
import type { AttachmentMetadata } from "@/server/services/attachment.service";
import { Loader2 } from "lucide-react";

interface CardDetailProps {
  card: Card;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCardUpdate?: (updated: Card) => void;
  initialAttachments?: AttachmentMetadata[];
}

export function CardDetail({
  card,
  open,
  onOpenChange,
  onCardUpdate,
  initialAttachments = [],
}: CardDetailProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>(initialAttachments);
  const [isPending, startTransition] = useTransition();

  // Load attachments from DB whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    getAttachments(card.id).then((result) => {
      if (result.success) setAttachments(result.data);
    });
  }, [open, card.id]);

  function handleSave() {
    startTransition(async () => {
      const result = await updateCard(card.id, { title, description });
      if (result.success) {
        onCardUpdate?.({ ...card, title, description: description || null });
      } else {
        toast.error(result.error ?? "Échec de la mise à jour.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Détail de la carte</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="card-title" className="text-sm font-medium">
              Titre
            </label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              placeholder="Titre de la carte"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="card-description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="card-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              placeholder="Ajouter une description…"
              rows={4}
              className="w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm outline-none transition-[color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 resize-none"
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending || !title.trim()}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </div>

          {/* Attachments */}
          <div className="border-t border-border pt-4">
            <AttachmentList
              cardId={card.id}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
