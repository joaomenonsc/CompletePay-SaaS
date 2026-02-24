"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWorkflows, updateWorkflow } from "@/lib/api/calendar";

export default function EditarWorkflowPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["calendar-workflows"],
    queryFn: () => fetchWorkflows(),
  });

  const workflow = workflows?.find((w) => w.id === id);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setIsActive(workflow.isActive);
    }
  }, [workflow]);

  const mutation = useMutation({
    mutationFn: (body: { name: string; is_active: boolean }) =>
      updateWorkflow(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-workflows"] });
      toast.success("Workflow atualizado");
    },
    onError: () => toast.error("Erro ao atualizar workflow"),
  });

  if (isLoading || (!workflows?.length && !workflow)) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!workflow) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Workflow não encontrado.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/calendario/workflows">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/calendario/workflows">← Voltar</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Editar workflow</h1>
        <p className="text-muted-foreground text-sm">{workflow.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Nome e status do workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error("Nome é obrigatório");
                return;
              }
              mutation.mutate({ name: name.trim(), is_active: isActive });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="active" className="font-normal">Ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/dashboard/calendario/workflows">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {workflow.steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Passos</CardTitle>
            <CardDescription>{workflow.steps.length} passo(s) configurado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {workflow.steps.map((s) => (
                <li key={s.id} className="text-muted-foreground">
                  {s.triggerType} → {s.actionType} (ordem {s.stepOrder})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
