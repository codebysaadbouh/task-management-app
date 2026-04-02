"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadAttachment, deleteAttachment } from "@/server/actions/attachment.actions";
import type { AttachmentMetadata } from "@/server/services/attachment.service";
import { Paperclip, Download, Trash2, Loader2 } from "lucide-react";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

interface AttachmentListProps {
  cardId: string;
  attachments: AttachmentMetadata[];
  onAttachmentsChange?: (attachments: AttachmentMetadata[]) => void;
}

export function AttachmentList({ cardId, attachments, onAttachmentsChange }: AttachmentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size validation
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Le fichier dépasse la limite de 20 Mo.");
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadAttachment(cardId, formData);
      if (result.success) {
        onAttachmentsChange?.([...attachments, result.data]);
        toast.success("Pièce jointe ajoutée.");
      } else {
        toast.error(result.error ?? "Échec du téléversement.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleDelete(attachmentId: string) {
    setDeletingId(attachmentId);
    startTransition(async () => {
      const result = await deleteAttachment(attachmentId);
      if (result.success) {
        onAttachmentsChange?.(attachments.filter((a) => a.id !== attachmentId));
        toast.success("Pièce jointe supprimée.");
      } else {
        toast.error(result.error ?? "Échec de la suppression.");
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="size-4" />
          Pièces jointes ({attachments.length})
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {isPending && !deletingId ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Ajouter
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={isPending}
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{attachment.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatSize(attachment.size)} · {formatDate(attachment.createdAt)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  asChild
                >
                  <a
                    href={`/api/attachments/${attachment.id}/download`}
                    download={attachment.name}
                    aria-label={`Télécharger ${attachment.name}`}
                  >
                    <Download className="size-4" />
                  </a>
                </Button>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  disabled={isPending}
                  onClick={() => handleDelete(attachment.id)}
                  aria-label={`Supprimer ${attachment.name}`}
                >
                  {deletingId === attachment.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
