"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPayments } from "@/lib/api/crm";
import type { PaymentListItem } from "@/types/crm";
import { Printer } from "lucide-react";
import { buildReceiptPrintHtml, openPrintWindow } from "../_components/print-utils";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function FinanceiroPage() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [dateFrom, setDateFrom] = useState(format(firstDayOfMonth, "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(lastDayOfMonth, "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["crm-payments", dateFrom, dateTo],
    queryFn: () =>
      fetchPayments({
        date_from: dateFrom,
        date_to: dateTo,
        limit: 100,
      }),
  });

  const payments = data?.items ?? [];
  const total = data?.total ?? 0;

  const handlePrintReceipt = (p: PaymentListItem) => {
    const html = buildReceiptPrintHtml({
      patientName: p.patient_name ?? "—",
      professionalName: p.professional_name ?? "—",
      paidAt: p.paid_at ? format(new Date(p.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—",
      amount: formatBRL(p.amount),
      paymentMethod: PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method,
      notes: p.notes,
    });
    openPrintWindow(html);
  };

  return (
    <main className="space-y-6" role="main" aria-label="Financeiro">
      <header>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          Pagamentos por atendimento e emissão de recibos.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos</CardTitle>
          <CardDescription>
            Lista de pagamentos no período. Use &quot;Emitir recibo&quot; para imprimir ou salvar como PDF.
          </CardDescription>
          <div className="flex flex-wrap items-end gap-4 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">De</label>
              <input
                type="date"
                className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Até</label>
              <input
                type="date"
                className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pagamento no período.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-medium">Data</th>
                    <th className="p-2 text-left font-medium">Paciente</th>
                    <th className="p-2 text-left font-medium">Profissional</th>
                    <th className="p-2 text-right font-medium">Valor</th>
                    <th className="p-2 text-left font-medium">Forma</th>
                    <th className="p-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="p-2 whitespace-nowrap">
                        {format(new Date(p.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="p-2">{p.patient_name ?? "—"}</td>
                      <td className="p-2">{p.professional_name ?? "—"}</td>
                      <td className="p-2 text-right font-medium">{formatBRL(p.amount)}</td>
                      <td className="p-2">
                        {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrintReceipt(p)}
                            aria-label="Emitir recibo"
                          >
                            <Printer className="mr-1 size-4" />
                            Recibo
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/crm-saude/atendimentos/${p.encounter_id}`}>
                              Ver ficha
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > 0 && (
            <p className="text-muted-foreground mt-3 text-sm">
              Total no período: <strong>{formatBRL(payments.reduce((s, p) => s + p.amount, 0))}</strong> ({total} pagamento(s))
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Para registrar um pagamento, abra a ficha do atendimento e use a seção &quot;Pagamento&quot;.
      </p>
    </main>
  );
}
