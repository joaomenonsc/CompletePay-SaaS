"use client";

import { useParams } from "next/navigation";

import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgent, useUpdateAgentMutation } from "@/hooks/use-agents";

import { ChannelCardChatWidget } from "./_components/channel-card-chat-widget";
import { ChannelCardEmail } from "./_components/channel-card-email";
import { ChannelCardWhatsApp } from "./_components/channel-card-whatsapp";

export default function AgentCanaisPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent, isLoading } = useAgent(id);
  const updateAgent = useUpdateAgentMutation();

  const handlePublicar = () => {
    if (!id) return;
    updateAgent.mutate(
      { id, body: { status: "ativo" } },
      {
        onSuccess: () => toast.success("Agente publicado e ativo na lista"),
        onError: () => toast.error("Falha ao publicar"),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-6 py-4">
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <h2 className="font-semibold text-lg">Canais de Comunicação</h2>

      <ChannelCardChatWidget agentId={id} />
      <ChannelCardWhatsApp />
      <ChannelCardEmail />

      <Card className="border-primary/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="font-medium">Deixar agente ativo</p>
            <p className="text-muted-foreground text-sm">
              Após configurar pelo menos um canal, publique para o agente aparecer ativo na lista.
            </p>
          </div>
          <Button onClick={handlePublicar}>
            <Upload className="size-4" />
            Publicar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
