"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Copy, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgent, useCreateAgent, useDeleteAgent } from "@/hooks/use-agents";

type AgentStatus = "ativo" | "rascunho" | "pausado";

const statusConfig: Record<
  AgentStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ativo: { label: "Ativo", variant: "default" },
  rascunho: { label: "Rascunho", variant: "secondary" },
  pausado: { label: "Pausado", variant: "outline" },
};

interface AgentHeaderProps {
  agentId: string;
  name?: string;
  imageUrl?: string | null;
  status?: AgentStatus;
}

export function AgentHeader({ agentId, name = "Agente", imageUrl, status = "ativo" }: AgentHeaderProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: agent } = useAgent(agentId);
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();

  useEffect(() => setMounted(true), []);

  const displayName = mounted ? name : "Agente";
  const displayStatus = mounted ? status : "rascunho";
  const { label: statusLabel, variant: statusVariant } = statusConfig[displayStatus];
  const initials = mounted
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "A";

  const handleDuplicate = () => {
    if (!agent) return;
    createAgent.mutate(
      {
        name: `${agent.name}-copia`,
        description: agent.description ?? undefined,
        image_url: agent.imageUrl ?? null,
        status: "rascunho",
        model: agent.model,
        system_instructions: agent.systemInstructions,
        category: agent.category ?? undefined,
        template_id: agent.templateId ?? undefined,
      },
      {
        onSuccess: (data) => {
          toast.success('Agente duplicado com sufixo "-copia"');
          router.push(`/dashboard/agents/${data.id}/editor`);
        },
        onError: () => toast.error("Falha ao duplicar agente"),
      },
    );
  };

  const handleDeleteConfirm = () => {
    deleteAgent.mutate(agentId, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        toast.success("Agente excluído");
        router.push("/dashboard/chat");
      },
      onError: () => toast.error("Falha ao excluir agente"),
    });
  };

  return (
    <>
      <header className="flex shrink-0 flex-col gap-3 bg-background/95 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link href="/dashboard/chat" prefetch={false}>
                <ArrowLeft className="size-4" />
                <span className="sr-only">Voltar</span>
              </Link>
            </Button>
            <Avatar className="size-10 shrink-0">
              {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
              <AvatarFallback className="bg-primary/10 font-medium text-primary text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-semibold text-foreground">{displayName}</h1>
              <Badge variant={statusVariant} className="mt-0.5 text-xs">
                {statusLabel}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/agents/${agentId}/playground`} prefetch={false}>
                <Play className="size-4" />
                Testar
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu do agente">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/agents/${agentId}/editor`} prefetch={false}>
                    <Pencil className="size-4" />
                    Editar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="size-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem>Exportar</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="size-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{displayName}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
