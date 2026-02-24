"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const bookingFormSchema = z.object({
  guestName: z.string().min(1, "Nome é obrigatório"),
  guestEmail: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  guestNotes: z.string().optional(),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export interface BookingFormProps {
  defaultValues?: Partial<BookingFormValues>;
  onSubmit: (values: BookingFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  /** Tema escuro para páginas públicas */
  variant?: "default" | "dark";
}

const darkInputClass =
  "border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus-visible:ring-zinc-500";
const darkLabelClass = "text-zinc-300";

export function BookingForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Confirmar agendamento",
  variant = "default",
}: BookingFormProps) {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      guestName: defaultValues?.guestName ?? "",
      guestEmail: defaultValues?.guestEmail ?? "",
      guestNotes: defaultValues?.guestNotes ?? "",
    },
  });

  const isDark = variant === "dark";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="guestName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={cn(isDark && darkLabelClass)}>Nome</FormLabel>
              <FormControl>
                <Input
                  placeholder="Seu nome"
                  className={cn(isDark && darkInputClass)}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="guestEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={cn(isDark && darkLabelClass)}>E-mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  className={cn(isDark && darkInputClass)}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="guestNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={cn(isDark && darkLabelClass)}>Observações (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Alguma informação adicional..."
                  className={cn("min-h-[80px]", isDark && darkInputClass)}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className={cn(
            "w-full",
            isDark && "bg-white text-zinc-900 hover:bg-zinc-200"
          )}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Agendando..." : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
