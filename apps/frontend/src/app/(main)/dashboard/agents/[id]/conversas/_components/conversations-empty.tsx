"use client";

import Link from "next/link";

import { MessageCircle, Play, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ConversationsEmptyProps {
  agentId: string;
}

export function ConversationsEmpty({ agentId }: ConversationsEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
        <MessageCircle className="size-12" strokeWidth={1.25} />
      </div>
      <h2 className="font-semibold text-lg">Nenhuma conversa registrada ainda</h2>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">
        As conversas aparecerão aqui quando seus clientes começarem a interagir com o agente.
      </p>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">
        Certifique-se de que o agente está publicado e com pelo menos um canal ativo.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link prefetch={false} href={`/dashboard/agents/${agentId}/canais`}>
            <Radio className="size-4" />
            Configurar Canais
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link prefetch={false} href={`/dashboard/agents/${agentId}/playground`}>
            <Play className="size-4" />
            Testar no Playground
          </Link>
        </Button>
      </div>
    </div>
  );
}
