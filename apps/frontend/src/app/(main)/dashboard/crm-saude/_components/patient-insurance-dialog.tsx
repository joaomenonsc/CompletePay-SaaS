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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createInsurance, fetchConvenios, updateInsurance } from "@/lib/api/crm";
import type { PatientInsurance } from "@/types/crm";
import type { InsuranceCreateInput } from "@/types/crm";

const PATIENTS_QUERY_KEY = ["crm-patients"] as const;
const CONVENIOS_QUERY_KEY = ["crm-convenios"] as const;

interface FormValues {
  tipo_atendimento: "particular" | "convenio";
  convenio_id: string;
  plano: string;
  numero_carteirinha: string;
  validade: string;
  titular: string;
  ativo: boolean;
}

interface PatientInsuranceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  insurance?: PatientInsurance | null;
  onSuccess?: () => void;
}

export function PatientInsuranceDialog({
  open,
  onOpenChange,
  patientId,
  insurance,
  onSuccess,
}: PatientInsuranceDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!insurance?.id;

  const { data: convenios = [] } = useQuery({
    queryKey: CONVENIOS_QUERY_KEY,
    queryFn: () => fetchConvenios(),
    enabled: open,
  });

  const form = useForm<FormValues>({
    defaultValues: {
      tipo_atendimento: "particular",
      convenio_id: "",
      plano: "",
      numero_carteirinha: "",
      validade: "",
      titular: "",
      ativo: true,
    },
  });

  const tipo = form.watch("tipo_atendimento");

  useEffect(() => {
    if (insurance) {
      form.reset({
        tipo_atendimento: (insurance.tipo_atendimento as "particular" | "convenio") || "particular",
        convenio_id: insurance.convenio_id ?? "",
        plano: insurance.plano ?? "",
        numero_carteirinha: insurance.numero_carteirinha ?? "",
        validade: insurance.validade ? insurance.validade.slice(0, 10) : "",
        titular: insurance.titular ?? "",
        ativo: insurance.ativo ?? true,
      });
    } else {
      form.reset({
        tipo_atendimento: "particular",
        convenio_id: "",
        plano: "",
        numero_carteirinha: "",
        validade: "",
        titular: "",
        ativo: true,
      });
    }
  }, [insurance, open, form]);

  const createMutation = useMutation({
    mutationFn: (body: InsuranceCreateInput) => createInsurance(patientId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, patientId] });
      toast.success("Convênio/particular adicionado");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao adicionar");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      insuranceId,
      body,
    }: {
      insuranceId: string;
      body: InsuranceCreateInput;
    }) => updateInsurance(patientId, insuranceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, patientId] });
      toast.success("Convênio/particular atualizado");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar");
    },
  });

  const onSubmit = (data: FormValues) => {
    const body: InsuranceCreateInput = {
      tipo_atendimento: data.tipo_atendimento,
      convenio_id: data.tipo_atendimento === "convenio" && data.convenio_id ? data.convenio_id : null,
      plano: data.plano.trim() || null,
      numero_carteirinha: data.numero_carteirinha.trim() || null,
      validade: data.validade ? data.validade : null,
      titular: data.titular.trim() || null,
      ativo: data.ativo,
    };
    if (isEdit && insurance) {
      updateMutation.mutate({ insuranceId: insurance.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar vínculo" : "Adicionar convênio/particular"}</DialogTitle>
          <DialogDescription>
            Tipo de atendimento e dados do plano ou particular.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tipo_atendimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="particular">Particular</SelectItem>
                      <SelectItem value="convenio">Convênio</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {tipo === "convenio" && (
              <FormField
                control={form.control}
                name="convenio_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Convênio</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o convênio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {convenios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                        {convenios.length === 0 && (
                          <div className="p-2 text-muted-foreground text-sm">
                            Nenhum convênio cadastrado. Cadastre em configurações.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {tipo === "convenio" && (
              <>
                <FormField
                  control={form.control}
                  name="plano"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do plano" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero_carteirinha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da carteirinha</FormLabel>
                      <FormControl>
                        <Input placeholder="Número" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validade</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="titular"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titular</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do titular" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-base">Ativo</FormLabel>
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
