"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const agentFormSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  description: z.string().optional(),
  model: z.string().min(1, { message: "Selecione um modelo." }),
  systemInstructions: z.string().min(10, { message: "As instruções devem ter pelo menos 10 caracteres." }),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;

const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
];

export function AgentForm() {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      model: "",
      systemInstructions: "",
    },
  });

  const onSubmit = async (data: AgentFormValues) => {
    const modelLabel = MODEL_OPTIONS.find((m) => m.value === data.model)?.label ?? data.model;
    toast.success("Agente criado com sucesso", {
      description: (
        <p className="mt-1.5 text-sm">
          <span className="font-medium">{data.name}</span>
          {data.description ? ` — ${data.description}` : ""}
          <span className="mt-1 block text-muted-foreground">Modelo: {modelLabel}</span>
        </p>
      ),
    });
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                <Input placeholder="Breve descrição do que o agente faz" {...field} />
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MODEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Modelo de linguagem que o agente utilizará.</FormDescription>
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
                  placeholder="Descreva o comportamento, tom e regras do agente..."
                  className="min-h-32 resize-y"
                  {...field}
                />
              </FormControl>
              <FormDescription>Define como o agente deve se comportar e responder.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit">Criar agente</Button>
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Limpar
          </Button>
        </div>
      </form>
    </Form>
  );
}
