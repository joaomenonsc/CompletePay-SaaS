"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUnit, fetchUnits } from "@/lib/api/crm";
import { Plus, ChevronRight } from "lucide-react";

const QUERY_KEY = ["crm-units"];

export default function UnidadesPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const { data: units = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchUnits,
  });
  const createMutation = useMutation({
    mutationFn: (body: { name: string; is_active?: boolean }) => createUnit(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Unidade cadastrada com sucesso");
      setName("");
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? "Erro ao cadastrar unidade");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Informe o nome da unidade");
      return;
    }
    createMutation.mutate({ name: trimmed, is_active: true });
  };

  return (
    <main className="space-y-6" role="main" aria-label="Unidades">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Unidades de atendimento</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre as unidades (clínicas, consultórios) para vincular aos
            profissionais.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Nova unidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova unidade</DialogTitle>
              <DialogDescription>
                Informe o nome da unidade de atendimento (ex.: Matriz, Filial Centro).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="unit-name">Nome *</Label>
                  <Input
                    id="unit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Matriz"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando…" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lista de unidades</CardTitle>
          <CardDescription>
            {units.length} unidade(s). Vincule às unidades nos cadastros de
            profissionais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Carregando…
            </p>
          ) : units.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nenhuma unidade cadastrada. Clique em &quot;Nova unidade&quot; para
              começar.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {units.map((unit) => (
                <li key={unit.id}>
                  <Link
                    href={`/dashboard/crm-saude/unidades/${unit.id}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{unit.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={unit.is_active ? "secondary" : "outline"}>
                        {unit.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
