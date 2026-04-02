"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Board } from "@/server/db/schema/boards";
import { createBoard, renameBoard, deleteBoard } from "@/server/actions/board.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, LayoutGrid, Pencil, Trash2, ArrowRight } from "lucide-react";

const BOARD_COLORS = [
  "from-violet-500 to-indigo-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500",
  "from-pink-500 to-rose-500",
  "from-purple-500 to-pink-500",
];

function getBoardColor(id: string) {
  const index = id.charCodeAt(0) % BOARD_COLORS.length;
  return BOARD_COLORS[index];
}

interface Props {
  initialBoards: Board[];
}

export function DashboardClient({ initialBoards }: Props) {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamingBoard, setRenamingBoard] = useState<Board | null>(null);
  const [renameName, setRenameName] = useState("");

  function handleCreate() {
    if (!newBoardName.trim()) return;
    startTransition(async () => {
      const result = await createBoard(newBoardName.trim());
      if (result.success) {
        setBoards((prev) => [...prev, result.data]);
        setNewBoardName("");
        setCreateOpen(false);
      } else {
        toast.error(result.error ?? "Impossible de créer le tableau.");
      }
    });
  }

  function openRename(e: React.MouseEvent, board: Board) {
    e.stopPropagation();
    setRenamingBoard(board);
    setRenameName(board.name);
    setRenameOpen(true);
  }

  function handleRename() {
    if (!renamingBoard || !renameName.trim()) return;
    startTransition(async () => {
      const result = await renameBoard(renamingBoard.id, renameName.trim());
      if (result.success) {
        setBoards((prev) => prev.map((b) => b.id === renamingBoard.id ? { ...b, name: renameName.trim() } : b));
        setRenameOpen(false);
        setRenamingBoard(null);
      } else {
        toast.error(result.error ?? "Impossible de renommer le tableau.");
      }
    });
  }

  function handleDelete(e: React.MouseEvent, boardId: string) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await deleteBoard(boardId);
      if (result.success) {
        setBoards((prev) => prev.filter((b) => b.id !== boardId));
      } else {
        toast.error(result.error ?? "Impossible de supprimer le tableau.");
      }
    });
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes tableaux</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {boards.length} tableau{boards.length !== 1 ? "x" : ""}
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              Nouveau tableau
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Créer un tableau</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="board-name">Nom du tableau</Label>
              <Input
                id="board-name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Ex : Projet marketing"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={isPending || !newBoardName.trim()}>
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
            <LayoutGrid className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Aucun tableau</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Créez votre premier tableau pour commencer à organiser vos tâches.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Créer un tableau
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {boards.map((board) => (
            <li key={board.id}>
              <div className="group rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                {/* Color banner */}
                <div
                  className={`h-20 bg-gradient-to-br ${getBoardColor(board.id)} opacity-90 cursor-pointer`}
                  onClick={() => router.push(`/boards/${board.id}`)}
                />

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <button
                      className="font-semibold text-sm leading-snug line-clamp-2 flex-1 text-left hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
                      onClick={() => router.push(`/boards/${board.id}`)}
                      disabled={isPending}
                    >
                      {board.name}
                    </button>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
                      onClick={(e) => openRename(e, board)}
                      disabled={isPending}
                    >
                      <Pencil className="w-3 h-3" />
                      Renommer
                    </button>
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors"
                      onClick={(e) => handleDelete(e, board.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer le tableau</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-board">Nouveau nom</Label>
            <Input
              id="rename-board"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Annuler</Button>
            <Button onClick={handleRename} disabled={isPending || !renameName.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
