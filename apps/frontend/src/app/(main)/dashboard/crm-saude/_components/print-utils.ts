/**
 * Gera HTML para impressão / "Salvar como PDF" (Story 5.5).
 * Abre em nova janela e dispara o diálogo de impressão (usuário pode escolher "Salvar como PDF").
 */

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function printPageTitle(title: string): string {
  return `<title>${escapeHtml(title)}</title>`;
}

function printStyles(): string {
  return `
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; padding: 24px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .section { margin-top: 16px; }
    .section-title { font-weight: 600; margin-bottom: 6px; }
    .draft-badge { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
    @media print { body { padding: 0; } }
  </style>`;
}

export interface PrintEncounterContext {
  patientName: string;
  professionalName: string;
  date: string;
}

export function buildPrescriptionPrintHtml(
  ctx: PrintEncounterContext,
  items: { medication: string; dosage: string; posology?: string | null; instructions?: string | null }[],
  isDraft?: boolean
): string {
  const rows = items
    .filter((i) => i.medication?.trim() || i.dosage?.trim())
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.medication)}</td><td>${escapeHtml(i.dosage)}</td><td>${escapeHtml(i.posology ?? "")}</td><td>${escapeHtml(i.instructions ?? "")}</td></tr>`
    )
    .join("");
  const draftBadge = isDraft ? '<span class="draft-badge">Rascunho</span>' : "";
  return `<!DOCTYPE html><html><head>${printPageTitle("Prescrição")}${printStyles()}</head><body>
  <h1>Prescrição médica ${draftBadge}</h1>
  <div class="meta">Paciente: ${escapeHtml(ctx.patientName)} · Profissional: ${escapeHtml(ctx.professionalName)} · Data: ${escapeHtml(ctx.date)}</div>
  <table><thead><tr><th>Medicamento</th><th>Dosagem</th><th>Posologia</th><th>Orientações</th></tr></thead><tbody>${rows || "<tr><td colspan=\"4\">—</td></tr>"}</tbody></table>
  </body></html>`;
}

export function buildEvolutionPrintHtml(
  ctx: PrintEncounterContext,
  evolution: {
    evolution_type?: string;
    anamnesis?: string | null;
    clinical_history?: string | null;
    family_history?: string | null;
    physical_exam?: string | null;
    diagnostic_hypotheses?: string | null;
    therapeutic_plan?: string | null;
    patient_guidance?: string | null;
    suggested_return_date?: string | null;
  },
  isDraft?: boolean
): string {
  const draftBadge = isDraft ? '<span class="draft-badge">Rascunho</span>' : "";
  const sections = [
    ["Anamnese", evolution.anamnesis],
    ["História clínica", evolution.clinical_history],
    ["História familiar", evolution.family_history],
    ["Exame físico", evolution.physical_exam],
    ["Hipóteses diagnósticas", evolution.diagnostic_hypotheses],
    ["Plano terapêutico", evolution.therapeutic_plan],
    ["Orientações ao paciente", evolution.patient_guidance],
    ["Retorno sugerido", evolution.suggested_return_date],
  ]
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([title, value]) => `<div class="section"><div class="section-title">${escapeHtml(title!)}</div><div>${escapeHtml(String(value).trim()).replace(/\n/g, "<br>")}</div></div>`)
    .join("");
  const typeLabel = evolution.evolution_type ? ` · Tipo: ${escapeHtml(String(evolution.evolution_type))}` : "";
  return `<!DOCTYPE html><html><head>${printPageTitle("Evolução clínica")}${printStyles()}</head><body>
  <h1>Evolução clínica ${draftBadge}</h1>
  <div class="meta">Paciente: ${escapeHtml(ctx.patientName)} · Profissional: ${escapeHtml(ctx.professionalName)} · Data: ${escapeHtml(ctx.date)}${typeLabel}</div>
  ${sections || "<p>—</p>"}
  </body></html>`;
}

export function buildExamRequestPrintHtml(
  ctx: PrintEncounterContext,
  items: { exam_name: string; instructions?: string | null }[],
  isDraft?: boolean
): string {
  const rows = items
    .filter((i) => i.exam_name?.trim())
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.exam_name)}</td><td>${escapeHtml(i.instructions ?? "")}</td></tr>`
    )
    .join("");
  const draftBadge = isDraft ? '<span class="draft-badge">Rascunho</span>' : "";
  return `<!DOCTYPE html><html><head>${printPageTitle("Solicitação de exames")}${printStyles()}</head><body>
  <h1>Solicitação de exames ${draftBadge}</h1>
  <div class="meta">Paciente: ${escapeHtml(ctx.patientName)} · Profissional: ${escapeHtml(ctx.professionalName)} · Data: ${escapeHtml(ctx.date)}</div>
  <table><thead><tr><th>Exame</th><th>Orientações</th></tr></thead><tbody>${rows || "<tr><td colspan=\"2\">—</td></tr>"}</tbody></table>
  </body></html>`;
}

export interface ReceiptPrintContext {
  patientName: string;
  professionalName: string;
  paidAt: string;
  amount: string;
  paymentMethod: string;
  notes?: string | null;
}

export function buildReceiptPrintHtml(ctx: ReceiptPrintContext): string {
  const methodLabels: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito",
  };
  const methodLabel = methodLabels[ctx.paymentMethod] ?? ctx.paymentMethod;
  return `<!DOCTYPE html><html><head>${printPageTitle("Recibo")}${printStyles()}</head><body>
  <h1>Recibo de pagamento</h1>
  <div class="meta">Paciente: ${escapeHtml(ctx.patientName)} · Profissional: ${escapeHtml(ctx.professionalName)}</div>
  <div class="section">
    <div class="section-title">Data do pagamento</div>
    <div>${escapeHtml(ctx.paidAt)}</div>
  </div>
  <div class="section">
    <div class="section-title">Valor</div>
    <div><strong>R$ ${escapeHtml(ctx.amount)}</strong></div>
  </div>
  <div class="section">
    <div class="section-title">Forma de pagamento</div>
    <div>${escapeHtml(methodLabel)}</div>
  </div>
  ${ctx.notes ? `<div class="section"><div class="section-title">Observações</div><div>${escapeHtml(ctx.notes)}</div></div>` : ""}
  </body></html>`;
}

export function openPrintWindow(html: string): void {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => {
    setTimeout(() => {
      w.print();
      w.onafterprint = () => w.close();
    }, 300);
  };
}
