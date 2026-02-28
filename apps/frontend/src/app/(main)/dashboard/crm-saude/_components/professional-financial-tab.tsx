"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfessionalFinancial, useUpdateProfessionalFinancial } from "@/hooks/use-professionals";

const REPASSE_OPTIONS = ["porcentagem", "valor_fixo", "tabela"];

interface ProfessionalFinancialTabProps {
  professionalId: string;
}

export function ProfessionalFinancialTab({ professionalId }: ProfessionalFinancialTabProps) {
  const { data: financial, isLoading } = useProfessionalFinancial(professionalId);
  const updateMutation = useUpdateProfessionalFinancial(professionalId);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [repasseModel, setRepasseModel] = useState("");

  useEffect(() => {
    if (!financial) return;
    setCnpj(financial.cnpj ?? "");
    setRazaoSocial(financial.razao_social ?? "");
    setPixKey(financial.pix_key ?? "");
    setRepasseModel(financial.repasse_model ?? "");
  }, [financial]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        cnpj: cnpj.trim() || null,
        razao_social: razaoSocial.trim() || null,
        pix_key: pixKey.trim() || null,
        repasse_model: repasseModel.trim() || null,
      },
      {
        onSuccess: () => toast.success("Dados financeiros atualizados"),
        onError: (err: Error) => toast.error(err?.message ?? "Erro ao salvar"),
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Carregando…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados financeiros</CardTitle>
        <CardDescription>
          CNPJ, razão social, Pix e modelo de repasse. Visível apenas para perfis Financeiro e Gestor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fin-cnpj">CNPJ</Label>
              <Input
                id="fin-cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <Label htmlFor="fin-razao">Razão social</Label>
              <Input
                id="fin-razao"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="fin-pix">Chave Pix</Label>
            <Input
              id="fin-pix"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
            />
          </div>
          <div>
            <Label>Modelo de repasse</Label>
            <Select
              value={repasseModel || "none"}
              onValueChange={(v) => setRepasseModel(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {REPASSE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o === "porcentagem" ? "Porcentagem" : o === "valor_fixo" ? "Valor fixo" : "Tabela"}
                  </SelectItem>
                ))}
                <SelectItem value="none">—</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
