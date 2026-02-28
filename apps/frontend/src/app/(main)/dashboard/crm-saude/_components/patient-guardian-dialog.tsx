"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createGuardian, updateGuardian } from "@/lib/api/crm";
import type { PatientGuardian } from "@/types/crm";
import type { GuardianCreateInput } from "@/types/crm";

const PATIENTS_QUERY_KEY = ["crm-patients"] as const;

interface FormValues {
  name: string;
  cpf: string;
  parentesco: string;
  phone: string;
  email: string;
  autorizado_informacoes: boolean;
}

interface PatientGuardianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  guardian?: PatientGuardian | null;
  onSuccess?: () => void;
}

export function PatientGuardianDialog({
  open,
  onOpenChange,
  patientId,
  guardian,
  onSuccess,
}: PatientGuardianDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!guardian?.id;

  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      cpf: "",
      parentesco: "",
      phone: "",
      email: "",
      autorizado_informacoes: false,
    },
  });

  useEffect(() => {
    if (guardian) {
      form.reset({
        name: guardian.name,
        cpf: guardian.cpf ?? "",
        parentesco: guardian.parentesco ?? "",
        phone: guardian.phone ?? "",
        email: guardian.email ?? "",
        autorizado_informacoes: guardian.autorizado_informacoes ?? false,
      });
    } else {
      form.reset({
        name: "",
        cpf: "",
        parentesco: "",
        phone: "",
        email: "",
        autorizado_informacoes: false,
      });
    }
  }, [guardian, open, form]);

  const createMutation = useMutation({
    mutationFn: (body: GuardianCreateInput) => createGuardian(patientId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, patientId] });
      toast.success("Responsável adicionado");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao adicionar responsável");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ guardianId, body }: { guardianId: string; body: GuardianCreateInput }) =>
      updateGuardian(patientId, guardianId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, patientId] });
      toast.success("Responsável atualizado");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar responsável");
    },
  });

  const onSubmit = (data: FormValues) => {
    const body: GuardianCreateInput = {
      name: data.name.trim(),
      cpf: data.cpf.trim() || null,
      parentesco: data.parentesco.trim() || null,
      phone: data.phone.trim() || null,
      email: data.email.trim() || null,
      autorizado_informacoes: data.autorizado_informacoes,
    };
    if (isEdit && guardian) {
      updateMutation.mutate({ guardianId: guardian.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar responsável" : "Adicionar responsável"}</DialogTitle>
          <DialogDescription>
            Dados do responsável legal (menores ou incapazes).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Nome é obrigatório", minLength: 2 }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do responsável" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentesco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parentesco</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pai, Mãe, Avô" {...field} />
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
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
              name="autorizado_informacoes"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-base">Autorizado a receber informações</FormLabel>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
