"use client";

/**
 * Formulário de confirmação da Tela 3 (coluna direita).
 * Em modo reagendamento, nome e e-mail vêm pré-preenchidos e ficam imutáveis.
 */
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export interface BookingFormData {
  name: string;
  email: string;
  notes?: string;
}

export interface BookingFormProps {
  onSubmit: (data: BookingFormData) => Promise<void>;
  /** Em reagendamento: nome e e-mail vêm da reserva anterior e ficam imutáveis. */
  defaultName?: string;
  defaultEmail?: string;
  nameAndEmailReadOnly?: boolean;
  /** Rótulo do botão de envio (ex.: "Reagendar" em modo reagendamento). */
  submitLabel?: string;
}

export function BookingForm({
  onSubmit,
  defaultName = "",
  defaultEmail = "",
  nameAndEmailReadOnly = false,
  submitLabel = "Confirmar",
}: BookingFormProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof BookingFormData, string>>
  >({});

  useEffect(() => {
    if (nameAndEmailReadOnly && defaultName) setName(defaultName);
    if (nameAndEmailReadOnly && defaultEmail) setEmail(defaultEmail);
  }, [nameAndEmailReadOnly, defaultName, defaultEmail]);

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

  const inputClass = (hasError: boolean, readOnly?: boolean) =>
    cn(
      "rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
      readOnly
        ? "cursor-default border-border bg-muted text-foreground read-only:outline-none"
        : "bg-background text-foreground focus:ring-2 focus:ring-ring",
      hasError ? "border-destructive" : "border-border"
    );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      aria-label="Formulário de confirmação de agendamento"
      noValidate
    >
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
          onChange={(e) => !nameAndEmailReadOnly && setName(e.target.value)}
          readOnly={nameAndEmailReadOnly}
          className={inputClass(!!errors.name, nameAndEmailReadOnly)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "booking-name-error" : undefined}
          autoComplete="name"
        />
        {errors.name && (
          <p id="booking-name-error" className="text-xs text-destructive" role="alert">
            {errors.name}
          </p>
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
          onChange={(e) => !nameAndEmailReadOnly && setEmail(e.target.value)}
          readOnly={nameAndEmailReadOnly}
          className={inputClass(!!errors.email, nameAndEmailReadOnly)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "booking-email-error" : undefined}
          autoComplete="email"
        />
        {errors.email && (
          <p id="booking-email-error" className="text-xs text-destructive" role="alert">
            {errors.email}
          </p>
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
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
          aria-label="Voltar para seleção de horário"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          aria-disabled={isSubmitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
        >
          {isSubmitting
            ? submitLabel === "Reagendar"
              ? "Reagendando..."
              : "Confirmando..."
            : submitLabel}
        </button>
      </div>
    </form>
  );
}
