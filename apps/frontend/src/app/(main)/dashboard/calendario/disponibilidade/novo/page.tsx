"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createSchedule } from "@/lib/api/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  timezone: z.string().min(1, "Timezone é obrigatório"),
  useDefaultHours: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

// 0=Segunda .. 4=Sexta (ISO weekday)
const DEFAULT_INTERVALS = [0, 1, 2, 3, 4].map((day_of_week) => ({
  day_of_week,
  start_time: "09:00",
  end_time: "17:00",
}));

export default function NovoSchedulePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      timezone: "America/Sao_Paulo",
      useDefaultHours: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      createSchedule({
        name: data.name,
        timezone: data.timezone,
        intervals: data.useDefaultHours ? DEFAULT_INTERVALS : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-schedules"] });
      toast.success("Schedule criado");
      router.push("/dashboard/calendario/disponibilidade");
    },
    onError: () => toast.error("Erro ao criar schedule"),
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/calendario/disponibilidade">← Voltar</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Novo schedule</h1>
        <p className="text-muted-foreground text-sm">
          Defina nome e timezone. Você pode usar o horário padrão (Seg–Sex 09:00–17:00) ou editar depois.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Nome e fuso horário do schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Horário comercial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input placeholder="America/Sao_Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="useDefaultHours"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Horário padrão</FormLabel>
                      <p className="text-muted-foreground text-sm">
                        Segunda a sexta, 09:00–17:00
                      </p>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Criando..." : "Criar schedule"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/calendario/disponibilidade")}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
