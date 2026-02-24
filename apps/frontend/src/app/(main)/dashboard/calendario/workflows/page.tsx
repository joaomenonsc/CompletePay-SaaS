"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createWorkflow,
  deleteWorkflow,
  fetchEventTypes,
  fetchWorkflows,
} from "@/lib/api/calendar";
import { Workflow } from "lucide-react";

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["calendar-workflows"],
    queryFn: () => fetchWorkflows(),
  });

  const { data: eventTypes } = useQuery({
    queryKey: ["event-types"],
    queryFn: fetchEventTypes,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkflow({
        name: name.trim(),
        event_type_id: eventTypeId || undefined,
        is_active: isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-workflows"] });
      setName("");
      setEventTypeId("");
      setIsActive(true);
      toast.success("Workflow criado");
    },
    onError: () => toast.error("Erro ao criar workflow"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-workflows"] });
      toast.success("Workflow removido");
    },
    onError: () => toast.error("Erro ao remover workflow"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <p className="text-muted-foreground text-sm">
          Automações por evento (lembretes, notificações, etc.).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="size-5" />
            Novo workflow
          </CardTitle>
          <CardDescription>
            Crie um workflow para um tipo de evento ou global (sem tipo).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wf-name">Nome</Label>
                <Input
                  id="wf-name"
                  placeholder="Ex: Lembrete 24h antes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-event-type">Tipo de evento (opcional)</Label>
                <select
                  id="wf-event-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={eventTypeId}
                  onChange={(e) => setEventTypeId(e.target.value)}
                >
                  <option value="">— Nenhum (global) —</option>
                  {eventTypes?.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wf-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="wf-active" className="font-normal">Ativo</Label>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar workflow"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
          <CardDescription>Lista de workflows da organização</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : workflows?.length ? (
            <ul className="divide-y">
              {workflows.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {w.eventTypeId
                        ? `Tipo: ${eventTypes?.find((et) => et.id === w.eventTypeId)?.title ?? w.eventTypeId}`
                        : "Global"}
                      {" · "}
                      {w.steps.length} passo(s) · {w.isActive ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/calendario/workflows/${w.id}/editar`}>
                        Editar
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(w.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhum workflow. Crie um acima.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
