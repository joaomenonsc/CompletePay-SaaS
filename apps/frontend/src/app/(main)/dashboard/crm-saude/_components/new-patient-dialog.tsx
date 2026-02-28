"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePatient } from "@/hooks/use-patients";
import { checkDuplicatePatients } from "@/lib/api/crm";
import type { Patient } from "@/types/crm";

import { patientFormSchema, type PatientFormValues } from "./patient-schema";

function patientDisplayName(p: Patient): string {
  return (p.social_name && p.social_name.trim() ? p.social_name : p.full_name) || "Sem nome";
}

const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "I", label: "Indeterminado" },
  { value: "O", label: "Outro" },
];

interface NewPatientDialogProps {
  trigger?: React.ReactNode;
}

export function NewPatientDialog({ trigger }: NewPatientDialogProps) {
  const [open, setOpen] = useState(false);
  const createPatient = useCreatePatient();
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      full_name: "",
      social_name: "",
      birth_date: "",
      phone: "",
      cpf: "",
      email: "",
      sex: null,
      origin: "",
    },
  });

  const fullName = form.watch("full_name");
  const birthDate = form.watch("birth_date");
  const phone = form.watch("phone");
  const cpf = form.watch("cpf");

  const { data: possibleDuplicates = [] } = useQuery({
    queryKey: ["crm-check-duplicate", fullName, birthDate, phone, cpf],
    queryFn: () =>
      checkDuplicatePatients({
        full_name: fullName?.trim() || null,
        birth_date: birthDate || null,
        phone: phone?.trim() || null,
        cpf: cpf?.trim() || null,
      }),
    enabled: Boolean(
      open &&
        (([fullName?.trim(), birthDate].every(Boolean) && (fullName?.trim()?.length ?? 0) >= 2) ||
          (!!phone?.trim() && phone.trim().replace(/\D/g, "").length >= 8) ||
          (!!cpf?.trim() && cpf.replace(/\D/g, "").length >= 10))
    ),
  });

  const onSubmit = (data: PatientFormValues) => {
    createPatient.mutate(
      {
        full_name: data.full_name,
        social_name: data.social_name || null,
        birth_date: data.birth_date,
        phone: data.phone,
        cpf: data.cpf || null,
        email: data.email || null,
        sex: data.sex ?? null,
        origin: data.origin || null,
      },
      {
        onSuccess: () => {
          toast.success("Paciente cadastrado com sucesso");
          form.reset();
          setOpen(false);
        },
        onError: (err: Error) => {
          toast.error(err.message || "Erro ao cadastrar paciente");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>Novo paciente</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo paciente</DialogTitle>
          <DialogDescription>
            Preencha os dados básicos. Nome completo, data de nascimento e telefone são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        {possibleDuplicates.length > 0 && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertTitle>Possível duplicata</AlertTitle>
            <AlertDescription>
              Encontramos cadastros com dados semelhantes. Verifique antes de continuar:
              <ul className="mt-2 list-inside list-disc space-y-1">
                {possibleDuplicates.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/crm-saude/pacientes/${p.id}`}
                      className="text-primary underline hover:no-underline"
                      onClick={() => setOpen(false)}
                    >
                      {patientDisplayName(p)}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Maria da Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="social_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome social</FormLabel>
                  <FormControl>
                    <Input placeholder="Como prefere ser chamado(a)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de nascimento *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone *</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input placeholder="000.000.000-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sexo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEX_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
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
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem (lead)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Instagram, indicação" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
              >
                Limpar
              </Button>
              <Button type="submit" disabled={createPatient.isPending}>
                {createPatient.isPending ? "Salvando…" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
