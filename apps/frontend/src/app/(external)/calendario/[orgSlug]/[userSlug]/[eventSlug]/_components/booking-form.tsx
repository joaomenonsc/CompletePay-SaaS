"use client";

/**
 * Formulário de confirmação da Tela 3 (coluna direita).
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 6.3
 */
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface BookingFormData {
  name: string;
  email: string;
  notes?: string;
}

export interface BookingFormProps {
  onSubmit: (data: BookingFormData) => Promise<void>;
}

export function BookingForm({ onSubmit }: BookingFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof BookingFormData, string>>
  >({});

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "Nome é obrigatório";
    if (!email.trim()) newErrors.email = "E-mail é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "E-mail inválido";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        notes: notes.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = (hasError: boolean) =>
    cn(
      "rounded-lg border px-3 py-2 text-sm bg-background text-foreground outline-none transition-colors focus:ring-2 focus:ring-ring",
      hasError ? "border-destructive" : "border-border"
    );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="booking-name"
          className="text-sm font-medium text-foreground"
        >
          Seu nome *
        </label>
        <input
          id="booking-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass(!!errors.name)}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="booking-email"
          className="text-sm font-medium text-foreground"
        >
          Endereço de e-mail *
        </label>
        <input
          id="booking-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass(!!errors.email)}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="booking-notes"
          className="text-sm font-medium text-foreground"
        >
          Observações adicionais
        </label>
        <textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Por favor, compartilhe qualquer coisa que nos ajude a nos preparar para nossa reunião."
          rows={3}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-ring"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Ao continuar, você concorda com os nossos{" "}
        <a href="#" className="underline">
          Termos
        </a>{" "}
        e{" "}
        <a href="#" className="underline">
          Política de Privacidade
        </a>
        .
      </p>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Confirmando..." : "Confirmar"}
        </button>
      </div>
    </form>
  );
}
