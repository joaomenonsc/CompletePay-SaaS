"use client";

import { useState } from "react";

import { useParams } from "next/navigation";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgent } from "@/hooks/use-agents";

interface TriggerItem {
  id: string;
  trigger: string;
  orientacao: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function AgentGuardrailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent } = useAgent(id);

  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>([
    "concorrentes",
    "informações financeiras internas",
  ]);
  const [newTopic, setNewTopic] = useState("");
  const [triggers, setTriggers] = useState<TriggerItem[]>([
    {
      id: generateId(),
      trigger: "reclamacao",
      orientacao: "Demonstre empatia e ofereça solução ou escalação",
    },
    {
      id: generateId(),
      trigger: "cancelamento",
      orientacao: "Tente reter com benefícios, mas respeite a decisão",
    },
  ]);
  const [turnLimit, setTurnLimit] = useState(15);

  const removeTopic = (index: number) => {
    setForbiddenTopics((prev) => prev.filter((_, i) => i !== index));
  };

  const addTopic = () => {
    const t = newTopic.trim();
    if (!t) return;
    setForbiddenTopics((prev) => [...prev, t]);
    setNewTopic("");
  };

  const addTrigger = () => {
    setTriggers((prev) => [...prev, { id: generateId(), trigger: "", orientacao: "" }]);
  };

  const _updateTrigger = (triggerId: string, field: "trigger" | "orientacao", value: string) => {
    setTriggers((prev) => prev.map((t) => (t.id === triggerId ? { ...t, [field]: value } : t)));
  };

  const removeTrigger = (triggerId: string) => {
    setTriggers((prev) => prev.filter((t) => t.id !== triggerId));
  };

  const handleSave = () => {
    toast.success("Alterações salvas");
  };

  if (!agent) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h2 className="font-semibold text-lg">Guardrails de Segurança</h2>
      </div>

      {/* Tópicos Proibidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tópicos Proibidos</CardTitle>
          <CardDescription>O agente evitará esses assuntos e redirecionará a conversa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {forbiddenTopics.map((topic, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: topics can duplicate, index needed for removeTopic
                key={`${topic}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => removeTopic(index)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label="Remover tópico"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add tópico..."
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTopic();
                }
              }}
              className="max-w-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTopic}>
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Respostas Obrigatórias (Triggers) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respostas Obrigatórias (Triggers)</CardTitle>
          <CardDescription>Quando o agente detectar esses gatilhos, seguirá a orientação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {triggers.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Trigger:</span> {t.trigger || "—"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Orientação:</span> {t.orientacao || "—"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm">
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeTrigger(t.id)}
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addTrigger}>
            <Plus className="size-4" />
            Adicionar Trigger
          </Button>
        </CardContent>
      </Card>

      {/* Limite de Turnos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limite de Turnos por Conversa</CardTitle>
          <CardDescription>Após o limite, escala para humano.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="turn-limit" className="sr-only">
              Turnos
            </Label>
            <Input
              id="turn-limit"
              type="number"
              min={1}
              max={100}
              value={turnLimit}
              onChange={(e) => setTurnLimit(Number(e.target.value) || 15)}
              className="w-20"
            />
            <span className="text-muted-foreground text-sm">turnos (após o limite, escala para humano)</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar Alterações</Button>
      </div>
    </div>
  );
}
