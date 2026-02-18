"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Play } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAgent, useUpdateAgent } from "@/hooks/use-agents";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  description: z.string().optional(),
  model: z.string().min(1, "Selecione um modelo."),
  systemInstructions: z.string().min(10, "Instruções com pelo menos 10 caracteres."),
});

type FormValues = z.infer<typeof schema>;

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
];

export default function AgentEditorPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent, isLoading } = useAgent(id);
  const updateAgentMutation = useUpdateAgent(id);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: agent
      ? {
          name: agent.name,
          description: agent.description ?? "",
          model: agent.model,
          systemInstructions: agent.systemInstructions,
        }
      : undefined,
    defaultValues: {
      name: "",
      description: "",
      model: "",
      systemInstructions: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    if (!id) return;
    updateAgentMutation.mutate(
      {
        name: data.name,
        description: data.description || undefined,
        model: data.model,
        system_instructions: data.systemInstructions,
      },
      {
        onSuccess: () => toast.success("Alterações salvas"),
        onError: () => toast.error("Falha ao salvar"),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
          <CardDescription>Configure instruções, modelo e parâmetros do agente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do agente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Assistente de vendas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Breve descrição" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo de IA</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o modelo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="systemInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instruções do sistema</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Comportamento, tom e regras do agente..."
                        className="min-h-32 resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Salvar alterações</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/agents/${id}/kb`} prefetch={false}>
            <BookOpen className="size-4" />
            Upload KB
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/agents/${id}/playground`} prefetch={false}>
            <Play className="size-4" />
            Ir para Playground
          </Link>
        </Button>
      </div>
    </div>
  );
}
