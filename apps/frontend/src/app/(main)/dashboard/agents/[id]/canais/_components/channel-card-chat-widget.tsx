"use client";

import { useState } from "react";

import { Check, Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface ChannelCardChatWidgetProps {
  agentId: string;
}

export function ChannelCardChatWidget({ agentId }: ChannelCardChatWidgetProps) {
  const [enabled, setEnabled] = useState(true);
  const [color, setColor] = useState("#3B82F6");
  const [position, setPosition] = useState("bottom-right");
  const [title, setTitle] = useState("Precisa de ajuda?");
  const [avatarOption, setAvatarOption] = useState("agent");
  const [copied, setCopied] = useState(false);

  const embedCode = `<script src="https://cdn.completepay.com/widget/v1.js"
  data-agent-id="${agentId}"
  data-color="${color}"
  data-position="${position}">
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success("Código copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <CardTitle>Chat Widget</CardTitle>
            <p className="text-muted-foreground text-sm">Status: {enabled ? "Conectado" : "Desconectado"}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </CardHeader>
      <CardContent className="space-y-6">
        {enabled && (
          <>
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Aparência</h4>
              <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                <div className="flex aspect-square w-24 items-center justify-center rounded-lg border bg-muted sm:w-28">
                  <MessageSquare className="size-8 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="shrink-0 text-xs">Cor do Widget:</Label>
                    <span className="flex items-center gap-1">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="size-8 cursor-pointer rounded border bg-background"
                      />
                      <Input
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-8 w-24 font-mono text-xs"
                      />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="w-20 shrink-0 text-xs">Posição:</Label>
                    <Select value={position} onValueChange={setPosition}>
                      <SelectTrigger className="h-8 w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Inferior Direito</SelectItem>
                        <SelectItem value="bottom-left">Inferior Esquerdo</SelectItem>
                        <SelectItem value="top-right">Superior Direito</SelectItem>
                        <SelectItem value="top-left">Superior Esquerdo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="w-20 shrink-0 text-xs">Título:</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Precisa de ajuda?"
                      className="h-8 max-w-xs flex-1"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="w-20 shrink-0 text-xs">Avatar:</Label>
                    <Select value={avatarOption} onValueChange={setAvatarOption}>
                      <SelectTrigger className="h-8 w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Usar avatar do agente</SelectItem>
                        <SelectItem value="default">Avatar padrão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Código de Incorporação</h4>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                <code>{embedCode}</code>
              </pre>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                {copied ? "Copiado" : "Copiar Código"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
