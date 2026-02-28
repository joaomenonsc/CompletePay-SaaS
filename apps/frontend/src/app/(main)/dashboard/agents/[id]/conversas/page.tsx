"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useParams } from "next/navigation";

import type { Row } from "@tanstack/react-table";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAgent } from "@/hooks/use-agents";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";

import { type ConversationRow, conversationColumns } from "./_components/columns";
import { ConversationActionsProvider } from "./_components/conversation-actions-context";
import { ConversationDetailSheet } from "./_components/conversation-detail-sheet";
import { ConversationsEmpty } from "./_components/conversations-empty";

// Mock: lista de conversas
function useConversationsList(_agentId: string): ConversationRow[] {
  return useMemo(
    () => [
      {
        id: "1",
        data: "14/02/2026",
        canal: "Chat",
        canalLabel: "Chat Widget",
        status: "Resolvida",
        msgs: 12,
        csat: "5/5",
        duracao: "3m45s",
        timeRange: "14:32 - 14:36",
        tokens: 1247,
        custoEst: "$0.012",
        messages: [
          {
            role: "assistant",
            text: "Olá! Sou o assistente virtual da CompletePay. Como posso ajudar?",
            time: "14:32",
          },
          {
            role: "user",
            text: "Quero saber sobre os planos de pagamento",
            time: "14:32",
          },
          {
            role: "assistant",
            text: "Temos 3 planos disponíveis:\n- Starter: Grátis, até 100 tx/mês\n- Pro: R$97/mês, até 5000 tx/mês\n- Enterprise: R$297/mês, ilimitado",
            time: "14:33",
            kbRef: "tabela-precos.csv",
          },
          { role: "user", text: "Obrigado!", time: "14:35" },
          {
            role: "assistant",
            text: "De nada! Se precisar de algo mais, estou aqui. Tenha um ótimo dia!",
            time: "14:36",
          },
        ],
      },
      {
        id: "2",
        data: "14/02 13:11",
        canal: "WhatsApp",
        status: "Resolvida",
        msgs: 8,
        csat: "4/5",
        duracao: "2m12s",
        messages: [
          { role: "user", text: "Preciso de suporte" },
          { role: "assistant", text: "Claro, em que posso ajudar?" },
        ],
      },
      {
        id: "3",
        data: "14/02 12:05",
        canal: "Chat",
        status: "Escalada",
        msgs: 15,
        csat: "2/5",
        duracao: "5m30s",
        messages: [
          { role: "user", text: "Quero falar com um humano" },
          { role: "assistant", text: "Vou transferir para um atendente." },
        ],
      },
      {
        id: "4",
        data: "14/02 11:20",
        canal: "Email",
        status: "Resolvida",
        msgs: 4,
        csat: "—",
        duracao: "1h20m",
        messages: [
          { role: "user", text: "Dúvida sobre fatura" },
          { role: "assistant", text: "Enviei as informações por e-mail." },
        ],
      },
      {
        id: "5",
        data: "14/02 09:55",
        canal: "Chat",
        status: "Ativa",
        msgs: 3,
        csat: "—",
        duracao: "—",
        messages: [
          { role: "user", text: "Olá" },
          { role: "assistant", text: "Olá! Como posso ajudar?" },
        ],
      },
      {
        id: "6",
        data: "13/02 16:44",
        canal: "WhatsApp",
        status: "Resolvida",
        msgs: 10,
        csat: "4/5",
        duracao: "4m15s",
        messages: [
          { role: "user", text: "Problema com login" },
          { role: "assistant", text: "Vou te enviar o link para redefinir a senha." },
        ],
      },
      {
        id: "7",
        data: "13/02 15:30",
        canal: "Chat",
        status: "Expirada",
        msgs: 2,
        csat: "—",
        duracao: "30m",
        messages: [
          { role: "user", text: "Oi" },
          { role: "assistant", text: "Olá! Em que posso ajudar?" },
        ],
      },
    ],
    [],
  );
}

function exportConversationToCSV(id: string, messages: { role: string; text: string }[]) {
  const header = "role;text\n";
  const rows = messages.map((m) => `${m.role};${m.text.replace(/"/g, '""')}`).join("\n");
  const csv = header + rows;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conversa-${id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentConversasPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent } = useAgent(id);
  const allConversations = useConversationsList(id);

  const [dataFilter, setDataFilter] = useState("7");
  const [canalFilter, setCanalFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [csatFilter, setCsatFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    let list = allConversations;
    if (canalFilter !== "todos") {
      list = list.filter((c) => c.canal.toLowerCase() === canalFilter);
    }
    if (statusFilter !== "todos") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (csatFilter !== "todos") {
      list = list.filter((c) => c.csat === csatFilter || (csatFilter === "sem" && c.csat === "—"));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.id.includes(q) || c.canal.toLowerCase().includes(q) || c.status.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allConversations, canalFilter, statusFilter, csatFilter, search]);

  const table = useDataTableInstance({
    data: filtered,
    columns: conversationColumns,
    defaultPageSize: 10,
    getRowId: (row) => row.id,
  });

  const selected = useMemo(() => filtered.find((c) => c.id === selectedId) ?? null, [filtered, selectedId]);

  const handleOpenDetail = useCallback((row: Row<ConversationRow>) => {
    setSelectedId(row.original.id);
  }, []);

  const handleExportCsv = useCallback((row: Row<ConversationRow>) => {
    exportConversationToCSV(row.original.id, row.original.messages);
    toast.success("CSV exportado");
  }, []);

  const handleExportAll = () => {
    toast.success("Exportação em lote pode ser implementada");
  };

  const handleExportOne = () => {
    if (!selected) return;
    exportConversationToCSV(selected.id, selected.messages);
    toast.success("CSV exportado");
  };

  // Estrutura fixa até o mount para evitar hydration (store difere no servidor vs cliente)
  if (!mounted) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-lg">Conversas</h2>
          <Button variant="outline" size="sm" disabled>
            <Download className="size-4" />
            Exportar CSV
          </Button>
        </div>
        <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-lg">Conversas</h2>
        <Button variant="outline" size="sm" onClick={handleExportAll}>
          <Download className="size-4" />
          Exportar CSV
        </Button>
      </div>

      {!agent ? (
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      ) : allConversations.length === 0 ? (
        <ConversationsEmpty agentId={id} />
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={dataFilter} onValueChange={setDataFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={canalFilter} onValueChange={setCanalFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Resolvida">Resolvida</SelectItem>
                <SelectItem value="Escalada">Escalada</SelectItem>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Expirada">Expirada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={csatFilter} onValueChange={setCsatFilter}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="CSAT" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="5/5">5/5</SelectItem>
                <SelectItem value="4/5">4/5</SelectItem>
                <SelectItem value="sem">Sem avaliação</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative ml-auto min-w-[200px] max-w-xs flex-1">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Tabela (mesmo estilo do Dashboard: DataTable + DataTablePagination) */}
          <ConversationActionsProvider onOpenDetail={handleOpenDetail} onExportCsv={handleExportCsv}>
            <div className="overflow-hidden rounded-lg border">
              <DataTable
                table={table}
                columns={conversationColumns}
                onRowClick={(row) => setSelectedId(row.original.id)}
              />
            </div>
            <DataTablePagination table={table} />
          </ConversationActionsProvider>

          {/* Sheet detalhe da conversa (wireframe 7.2) */}
          <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
              <SheetTitle className="sr-only">
                {selected ? `Conversa ${selected.id}` : "Detalhe da conversa"}
              </SheetTitle>
              {selected ? (
                <ConversationDetailSheet
                  conversation={selected}
                  onClose={() => setSelectedId(null)}
                  onExportCsv={handleExportOne}
                />
              ) : null}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
