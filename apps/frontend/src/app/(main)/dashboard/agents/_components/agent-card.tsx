"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Copy, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateAgent, useDeleteAgent } from "@/hooks/use-agents";
import { getCategoryInfo } from "@/lib/agent-categories";
import type { Agent } from "@/types/agent";

const statusVariant: Record<Agent["status"], "default" | "secondary" | "outline"> = {
  ativo: "default",
  rascunho: "secondary",
  pausado: "outline",
};

const statusLabel: Record<Agent["status"], string> = {
  ativo: "Ativo",
  rascunho: "Draft",
  pausado: "Pausado",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const router = useRouter();
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const category = getCategoryInfo(agent.category);
  const Icon = category?.icon;

  const conversations = agent.conversationsCount ?? 0;
  const resolution = agent.resolutionRate != null ? `${agent.resolutionRate}%` : "—";
  const csat = agent.csat != null ? `${agent.csat.toFixed(1)}` : "—";

  const _handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/dashboard/agents/${agent.id}/editor`);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteAgent.mutate(agent.id, {
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
      <Card className="transition-shadow hover:shadow-md *:data-[slot=card]:shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {Icon ? (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              ) : null}
              <span className="truncate text-muted-foreground text-sm">{category?.label ?? agent.category ?? "—"}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Menu do agente"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="size-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                  <Trash2 className="size-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Link prefetch={false} href={`/dashboard/agents/${agent.id}/editor`} className="block">
            <h3 className="mt-1 truncate font-semibold text-foreground">{agent.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-muted-foreground text-sm">{agent.description || "Sem descrição."}</p>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Badge variant={statusVariant[agent.status]} className="text-xs">
            {statusLabel[agent.status]}
          </Badge>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-muted/50 px-2 py-2 text-center">
              <p className="font-semibold text-foreground text-sm tabular-nums">{conversations}</p>
              <p className="text-muted-foreground text-xs">Conversas</p>
            </div>
            <div className="rounded-md bg-muted/50 px-2 py-2 text-center">
              <p className="font-semibold text-foreground text-sm tabular-nums">{resolution}</p>
              <p className="text-muted-foreground text-xs">Resolucão</p>
            </div>
            <div className="rounded-md bg-muted/50 px-2 py-2 text-center">
              <p className="font-semibold text-foreground text-sm tabular-nums">{csat}</p>
              <p className="text-muted-foreground text-xs">CSAT</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <Link prefetch={false} href={`/dashboard/agents/${agent.id}/editor`}>
                <Pencil className="size-3.5" />
                Editar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link prefetch={false} href={`/dashboard/agents/${agent.id}/playground`}>
                <Play className="size-3.5" />
                Testar
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{agent.name}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
