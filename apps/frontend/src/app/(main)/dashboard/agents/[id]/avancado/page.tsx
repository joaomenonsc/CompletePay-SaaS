"use client";

import { useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { AlertTriangle, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useAgent, useDeleteAgent } from "@/hooks/use-agents";

type ModelStrategy = "quality" | "speed" | "cost";

export default function AgentAvancadoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { data: agent } = useAgent(id);
  const deleteAgent = useDeleteAgent();

  const [strategy, setStrategy] = useState<ModelStrategy>("quality");
  const [temperature, setTemperature] = useState([0.7]);
  const [tokenBudget, setTokenBudget] = useState(100_000);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const handleSave = () => {
    toast.success("Alterações salvas");
  };

  const handleArchive = () => {
    setShowArchiveDialog(false);
    toast.success("Agente arquivado");
    router.push("/dashboard/chat");
  };

  const handleDelete = () => {
    deleteAgent.mutate(id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        toast.success("Agente excluído permanentemente");
        router.push("/dashboard/chat");
      },
      onError: () => toast.error("Falha ao excluir agente"),
    });
  };

  if (!agent) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h2 className="font-semibold text-lg">Configurações Avançadas</h2>
      </div>

      {/* Estratégia de Modelo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estratégia de Modelo</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as ModelStrategy)} className="grid gap-3">
            <div className="flex items-start space-x-3 rounded-md border p-3">
              <RadioGroupItem value="quality" id="quality" />
              <label htmlFor="quality" className="cursor-pointer text-sm">
                <span className="font-medium">Quality</span>
                <span className="block text-muted-foreground">Melhor qualidade de resposta (Claude Sonnet 4.5)</span>
              </label>
            </div>
            <div className="flex items-start space-x-3 rounded-md border p-3">
              <RadioGroupItem value="speed" id="speed" />
              <label htmlFor="speed" className="cursor-pointer text-sm">
                <span className="font-medium">Speed</span>
                <span className="block text-muted-foreground">Respostas mais rápidas (GPT-4.1-mini)</span>
              </label>
            </div>
            <div className="flex items-start space-x-3 rounded-md border p-3">
              <RadioGroupItem value="cost" id="cost" />
              <label htmlFor="cost" className="cursor-pointer text-sm">
                <span className="font-medium">Cost</span>
                <span className="block text-muted-foreground">Menor custo por conversa (GPT-4.1-mini, temp baixo)</span>
              </label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Temperature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temperature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Slider min={0} max={1} step={0.1} value={temperature} onValueChange={setTemperature} className="flex-1" />
            <span className="w-8 text-muted-foreground text-sm tabular-nums">{temperature[0].toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">0.0 Preciso</span>
            <span className="text-muted-foreground">1.0 Criativo</span>
          </div>
        </CardContent>
      </Card>

      {/* Token Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Budget Diário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              value={tokenBudget}
              onChange={(e) => setTokenBudget(Number(e.target.value) || 0)}
              className="w-32"
            />
            <span className="text-muted-foreground text-sm">tokens/dia</span>
          </div>
          <p className="text-muted-foreground text-sm">Estimativa: ~200 conversas/dia com respostas médias</p>
        </CardContent>
      </Card>

      {/* Zona de Perigo */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setShowArchiveDialog(true)}
            >
              <Archive className="size-4" />
              Arquivar Agente
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="size-4" />
              Excluir Agente
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            <strong>Arquivar:</strong> Remove de produção, mantém dados. —<strong> Excluir:</strong> Remove
            permanentemente (irreversível).
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar Alterações</Button>
      </div>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar agente</AlertDialogTitle>
            <AlertDialogDescription>
              O agente será removido de produção e não aparecerá na lista ativa. Os dados serão mantidos e você poderá
              reativar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O agente &quot;{agent.name}&quot; e todos os dados associados serão removidos
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
