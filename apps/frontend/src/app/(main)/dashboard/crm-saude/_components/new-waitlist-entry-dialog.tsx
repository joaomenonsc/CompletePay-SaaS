"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWaitlistEntry, fetchPatients, fetchProfessionals } from "@/lib/api/crm";
import type { Patient, WaitlistEntryCreateInput } from "@/types/crm";
import { Loader2 } from "lucide-react";

interface NewWaitlistEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewWaitlistEntryDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewWaitlistEntryDialogProps) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [appointmentType, setAppointmentType] = useState("consulta");
  const [priority, setPriority] = useState(0);

  const { data: patientsData } = useQuery({
    queryKey: ["crm-patients-list-waitlist"],
    queryFn: () => fetchPatients({ limit: 300 }),
    enabled: open,
  });
  const patients = patientsData?.items ?? [];

  const { data: professionalsData } = useQuery({
    queryKey: ["crm-professionals-list"],
    queryFn: () => fetchProfessionals({ limit: 200 }),
    enabled: open,
  });
  const professionals = professionalsData?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (body: WaitlistEntryCreateInput) => createWaitlistEntry(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-waitlist"] });
      toast.success("Paciente adicionado à lista de espera.");
      onOpenChange(false);
      setPatientId("");
      setProfessionalId("");
      setAppointmentType("consulta");
      setPriority(0);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao adicionar."),
  });

  const handleSubmit = () => {
    if (!patientId || !professionalId) {
      toast.error("Selecione o paciente e o profissional.");
      return;
    }
    createMutation.mutate({
      patient_id: patientId,
      professional_id: professionalId,
      appointment_type: appointmentType,
      priority,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar à lista de espera</DialogTitle>
          <DialogDescription>
            Use quando não houver horário disponível. O paciente poderá ser encaixado em cancelamentos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Paciente *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p: Patient) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </SelectItem>
                ))}
                {patients.length === 0 && (
                  <SelectItem value="__none" disabled>
                    Nenhum paciente cadastrado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Profissional *</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p: { id: string; full_name: string }) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Tipo de atendimento</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consulta">Consulta</SelectItem>
                <SelectItem value="retorno">Retorno</SelectItem>
                <SelectItem value="procedimento">Procedimento</SelectItem>
                <SelectItem value="teleconsulta">Teleconsulta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Prioridade (0–100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={priority}
              onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!patientId || !professionalId || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Adicionar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
