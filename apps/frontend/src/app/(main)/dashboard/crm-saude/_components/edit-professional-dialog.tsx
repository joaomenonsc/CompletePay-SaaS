"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateProfessional } from "@/hooks/use-professionals";
import { fetchOrgMembers } from "@/lib/api/organizations";
import { fetchUnits } from "@/lib/api/crm";
import { useOrganizationStore } from "@/store/organization-store";
import type { Professional } from "@/types/crm";
import { ChevronDown } from "lucide-react";

import {
  professionalEditFormSchema,
  type ProfessionalEditFormValues,
} from "./professional-schema";

const CATEGORY_OPTIONS = [
  { value: "MED", label: "Médico" },
  { value: "ENF", label: "Enfermeiro(a)" },
  { value: "PSI", label: "Psicólogo(a)" },
  { value: "FIS", label: "Fisioterapeuta" },
  { value: "NUT", label: "Nutricionista" },
  { value: "DEN", label: "Dentista" },
  { value: "FAR", label: "Farmacêutico(a)" },
  { value: "FNO", label: "Fonoaudiólogo(a)" },
  { value: "TER", label: "Terapeuta ocupacional" },
  { value: "OUT", label: "Outro" },
];

const COUNCIL_OPTIONS = [
  { value: "CRM", label: "CRM" },
  { value: "COREN", label: "COREN" },
  { value: "CRP", label: "CRP" },
  { value: "CREFITO", label: "CREFITO" },
  { value: "CRN", label: "CRN" },
  { value: "CRO", label: "CRO" },
  { value: "CRF", label: "CRF" },
  { value: "CREFONO", label: "CREFONO" },
  { value: "OUTRO", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "ferias", label: "Férias" },
  { value: "licenca", label: "Licença" },
];

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "CLT", label: "CLT" },
  { value: "PJ", label: "PJ" },
  { value: "autonomo", label: "Autônomo" },
  { value: "parceiro", label: "Parceiro" },
];

const MODALITY_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "hibrido", label: "Híbrido" },
];

interface EditProfessionalDialogProps {
  professional: Professional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfessionalDialog({
  professional,
  open,
  onOpenChange,
}: EditProfessionalDialogProps) {
  const updateProfessional = useUpdateProfessional();
  const currentOrganizationId = useOrganizationStore((s) => s.currentOrganizationId);
  const { data: units = [] } = useQuery({
    queryKey: ["crm-units"],
    queryFn: fetchUnits,
    enabled: open,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["org-members", currentOrganizationId],
    queryFn: () => fetchOrgMembers(currentOrganizationId!),
    enabled: open && !!currentOrganizationId,
  });
  const form = useForm<ProfessionalEditFormValues>({
    resolver: zodResolver(professionalEditFormSchema),
    defaultValues: {
      full_name: "",
      social_name: "",
      cpf: "",
      category: undefined,
      council: undefined,
      registration_number: "",
      council_uf: "",
      rqe: "",
      phone: "",
      email: "",
      city: "",
      uf: "",
      status: "ativo",
      user_id: null,
      employment_type: null,
      modality: null,
      unit_ids: [],
    },
  });

  useEffect(() => {
    if (professional && open) {
      form.reset({
        full_name: professional.full_name,
        social_name: professional.social_name ?? "",
        cpf: professional.cpf ?? "",
        category: professional.category,
        council: professional.council,
        registration_number: professional.registration_number,
        council_uf: professional.council_uf,
        rqe: professional.rqe ?? "",
        phone: professional.phone ?? "",
        email: professional.email ?? "",
        city: professional.city ?? "",
        uf: professional.uf ?? "",
        status: (professional.status as ProfessionalEditFormValues["status"]) || "ativo",
        user_id: professional.user_id ?? null,
        employment_type: professional.employment_type ?? null,
        modality: professional.modality ?? null,
        unit_ids: professional.unit_ids ?? [],
      });
    }
  }, [professional, open, form]);

  const onSubmit = (data: ProfessionalEditFormValues) => {
    if (!professional) return;
    updateProfessional.mutate(
      {
        id: professional.id,
        body: {
          full_name: data.full_name,
          social_name: data.social_name?.trim() || null,
          cpf: data.cpf?.trim() || null,
          category: data.category,
          council: data.council,
          registration_number: data.registration_number.trim(),
          council_uf: data.council_uf.trim().toUpperCase(),
          rqe: data.rqe?.trim() || null,
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
          city: data.city?.trim() || null,
          uf: data.uf?.trim().toUpperCase() || null,
          status: data.status,
          user_id: data.user_id?.trim() || null,
          employment_type: data.employment_type ?? null,
          modality: data.modality ?? null,
          unit_ids: data.unit_ids?.length ? data.unit_ids : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Profissional atualizado com sucesso");
          onOpenChange(false);
        },
        onError: (err: Error) => {
          const message =
            err && typeof err === "object" && "detail" in err
              ? String((err as { detail?: string }).detail)
              : err?.message ?? "Erro ao atualizar profissional";
          toast.error(message);
        },
      }
    );
  };

  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar profissional</DialogTitle>
          <DialogDescription>
            Altere os dados do profissional. Apenas gestores (GCL) podem editar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Maria Silva" {...field} />
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria profissional *</FormLabel>
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
                      {CATEGORY_OPTIONS.map((opt) => (
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
              name="council"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conselho *</FormLabel>
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
                      {COUNCIL_OPTIONS.map((opt) => (
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="registration_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do registro *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="council_uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF do conselho *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
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
              name="rqe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RQE / Especialidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Opcional" {...field} />
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
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-muted-foreground text-sm font-medium">Vínculo</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="employment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo (CLT/PJ)</FormLabel>
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
                        {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
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
                name="modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalidade</FormLabel>
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
                        {MODALITY_OPTIONS.map((opt) => (
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
            </div>
            <FormField
              control={form.control}
              name="unit_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidades de atendimento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                        >
                          {field.value?.length
                            ? `${field.value.length} unidade(s) selecionada(s)`
                            : "Selecionar unidades"}
                          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full min-w-[var(--radix-popover-trigger-width)] p-2" align="start">
                      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                        {units.filter((u) => u.is_active).map((unit) => (
                          <label
                            key={unit.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={field.value?.includes(unit.id) ?? false}
                              onCheckedChange={(checked) => {
                                const prev = field.value ?? [];
                                if (checked) {
                                  field.onChange([...prev, unit.id]);
                                } else {
                                  field.onChange(prev.filter((id) => id !== unit.id));
                                }
                              }}
                            />
                            {unit.name}
                          </label>
                        ))}
                        {units.filter((u) => u.is_active).length === 0 && (
                          <p className="text-muted-foreground px-2 py-2 text-sm">Nenhuma unidade cadastrada.</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincular usuário (login)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    value={field.value ?? "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProfessional.isPending}>
                {updateProfessional.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
