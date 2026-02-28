"use client";

import { useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CalendarClock,
    Check,
    Eye,
    FileText,
    Loader2,
    Mail,
    Send,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    useTemplates,
    useLists,
    useDomains,
    useCreateCampaign,
    useSendCampaign,
} from "@/hooks/use-marketing";
import type { EmailTemplate, EmailList, EmailDomain } from "@/types/marketing";

// ── Wizard steps ───────────────────────────────────────────────────────────────

const STEPS = [
    { id: 1, label: "Template", icon: FileText },
    { id: 2, label: "Audiência", icon: Users },
    { id: 3, label: "Revisar", icon: Eye },
] as const;

// ── Page ────────────────────────────────────────────────────────────────────────

export default function NovaCampanhaPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [campaignName, setCampaignName] = useState("");
    const [subject, setSubject] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [selectedList, setSelectedList] = useState<string | null>(null);
    const [sendType, setSendType] = useState<"now" | "scheduled">("now");
    const [scheduledDate, setScheduledDate] = useState("");
    const [fromEmail, setFromEmail] = useState("");
    const [fromName, setFromName] = useState("");
    const [replyTo, setReplyTo] = useState("");

    // Fetch real templates and lists
    const { data: templatesData, isLoading: loadingTemplates } = useTemplates({ limit: 50 });
    const { data: listsData, isLoading: loadingLists } = useLists({ limit: 50 });
    const { data: domainsData } = useDomains({ status: "verified", limit: 50 });
    const createMutation = useCreateCampaign();
    const sendMutation = useSendCampaign();

    const templates = templatesData?.items ?? [];
    const lists = listsData?.items ?? [];
    const verifiedDomains = domainsData?.items ?? [];

    const selectedTemplateName = templates.find((t: EmailTemplate) => t.id === selectedTemplate)?.name ?? selectedTemplate ?? "—";
    const selectedListObj = lists.find((l: EmailList) => l.id === selectedList);
    const selectedListName = selectedListObj?.name ?? selectedList ?? "—";

    const canGoNext =
        (step === 1 && campaignName && subject && selectedTemplate) ||
        (step === 2 && selectedList) ||
        step === 3;

    const handleSubmit = () => {
        createMutation.mutate(
            {
                name: campaignName,
                subject,
                template_id: selectedTemplate,
                list_id: selectedList,
                from_email: fromEmail || undefined,
                from_name: fromName || undefined,
                reply_to: replyTo || undefined,
                scheduled_at: sendType === "scheduled" && scheduledDate
                    ? new Date(scheduledDate).toISOString()
                    : undefined,
            },
            {
                onSuccess: (created) => {
                    if (sendType === "now") {
                        sendMutation.mutate(created.id, {
                            onSuccess: () => {
                                router.push(`/dashboard/email-marketing/campanhas/${created.id}`);
                            },
                        });
                    } else {
                        router.push(`/dashboard/email-marketing/campanhas/${created.id}`);
                    }
                },
            }
        );
    };

    const isSubmitting = createMutation.isPending || sendMutation.isPending;

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/email-marketing/campanhas">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-semibold">Nova campanha</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure e envie uma campanha de email marketing.
                    </p>
                </div>
            </header>

            {/* Stepper */}
            <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                    {STEPS.map((s, i) => {
                        const StepIcon = s.icon;
                        const isActive = step === s.id;
                        const isComplete = step > s.id;

                        return (
                            <div key={s.id} className="flex items-center">
                                <button
                                    type="button"
                                    onClick={() => isComplete && setStep(s.id)}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isActive
                                        ? "bg-primary text-primary-foreground"
                                        : isComplete
                                            ? "bg-primary/10 text-primary cursor-pointer"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                >
                                    {isComplete ? (
                                        <Check className="size-4" />
                                    ) : (
                                        <StepIcon className="size-4" />
                                    )}
                                    {s.label}
                                </button>
                                {i < STEPS.length - 1 && (
                                    <div className="mx-2 h-px w-8 bg-border" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Step content */}
            <Card className="mx-auto max-w-2xl">
                <CardContent className="p-6">
                    {/* Step 1: Template */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label>Nome da campanha *</Label>
                                <Input
                                    value={campaignName}
                                    onChange={(e) => setCampaignName(e.target.value)}
                                    placeholder="Ex: Reengajamento Pacientes Q1 2026"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Assunto do email *</Label>
                                <Input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Ex: {{nome_paciente}}, sentimos sua falta!"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use {"{{variáveis}}"} para personalizar o assunto.
                                </p>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label>Selecione um template *</Label>
                                {loadingTemplates ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : templates.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {templates.map((t: EmailTemplate) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setSelectedTemplate(t.id)}
                                                className={`rounded-lg border p-4 text-left transition-all hover:border-primary/50 ${selectedTemplate === t.id
                                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                    : ""
                                                    }`}
                                            >
                                                <p className="text-sm font-medium">{t.name}</p>
                                                <Badge variant="outline" className="mt-1 text-xs capitalize">
                                                    {t.category}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed p-8 text-center">
                                        <FileText className="mx-auto size-6 text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Nenhum template encontrado.{" "}
                                            <Link href="/dashboard/email-marketing/templates/novo" className="text-primary hover:underline">
                                                Criar template
                                            </Link>
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Sender configuration */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Remetente (opcional)</Label>
                                <p className="text-xs text-muted-foreground">
                                    Configure o endereço de envio. Somente domínios verificados são aceitos.
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Email do remetente</Label>
                                        {verifiedDomains.length > 0 ? (
                                            <Select
                                                value={fromEmail}
                                                onValueChange={setFromEmail}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {verifiedDomains.map((d: EmailDomain) => (
                                                        <SelectItem key={d.id} value={`marketing@${d.domain}`}>
                                                            marketing@{d.domain}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                value={fromEmail}
                                                onChange={(e) => setFromEmail(e.target.value)}
                                                placeholder="marketing@seudominio.com"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Nome do remetente</Label>
                                        <Input
                                            value={fromName}
                                            onChange={(e) => setFromName(e.target.value)}
                                            placeholder="Clínica Exemplo"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Reply-To</Label>
                                    <Input
                                        value={replyTo}
                                        onChange={(e) => setReplyTo(e.target.value)}
                                        placeholder="contato@seudominio.com"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Audience */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label>Selecione a lista de destinatários *</Label>
                                {loadingLists ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : lists.length > 0 ? (
                                    <Select
                                        value={selectedList ?? ""}
                                        onValueChange={setSelectedList}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Escolha uma lista..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {lists.map((l: EmailList) => (
                                                <SelectItem key={l.id} value={l.id}>
                                                    {l.name} ({l.subscriber_count} contatos)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="rounded-lg border border-dashed p-8 text-center">
                                        <Users className="mx-auto size-6 text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Nenhuma lista encontrada.{" "}
                                            <Link href="/dashboard/email-marketing/listas" className="text-primary hover:underline">
                                                Criar lista
                                            </Link>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {selectedListObj && (
                                <div className="rounded-lg bg-muted/50 p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Users className="size-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">
                                                Destinatários elegíveis
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-base font-bold">
                                            {selectedListObj.subscriber_count}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Somente pacientes com email e consentimento ativo serão incluídos.
                                    </p>
                                </div>
                            )}

                            <Separator />

                            <div className="space-y-2">
                                <Label>Quando enviar?</Label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSendType("now")}
                                        className={`flex-1 rounded-lg border p-4 text-center transition-all ${sendType === "now"
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : ""
                                            }`}
                                    >
                                        <Send className="mx-auto size-5 text-muted-foreground" />
                                        <p className="mt-1 text-sm font-medium">Agora</p>
                                        <p className="text-xs text-muted-foreground">
                                            Enviar imediatamente
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSendType("scheduled")}
                                        className={`flex-1 rounded-lg border p-4 text-center transition-all ${sendType === "scheduled"
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : ""
                                            }`}
                                    >
                                        <CalendarClock className="mx-auto size-5 text-muted-foreground" />
                                        <p className="mt-1 text-sm font-medium">Agendar</p>
                                        <p className="text-xs text-muted-foreground">
                                            Definir data e hora
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {sendType === "scheduled" && (
                                <div className="space-y-2">
                                    <Label>Data e hora de envio</Label>
                                    <Input
                                        type="datetime-local"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <h3 className="text-base font-semibold">Resumo da campanha</h3>

                            <div className="rounded-lg border divide-y">
                                <div className="flex items-center justify-between p-4">
                                    <span className="text-sm text-muted-foreground">Nome</span>
                                    <span className="text-sm font-medium">{campaignName || "—"}</span>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <span className="text-sm text-muted-foreground">Assunto</span>
                                    <span className="text-sm font-medium">{subject || "—"}</span>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <span className="text-sm text-muted-foreground">Template</span>
                                    <span className="text-sm font-medium">{selectedTemplateName}</span>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <span className="text-sm text-muted-foreground">
                                        Destinatários
                                    </span>
                                    <span className="text-sm font-medium">
                                        {selectedListName}
                                        {selectedListObj ? ` (${selectedListObj.subscriber_count} contatos)` : ""}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <span className="text-sm text-muted-foreground">
                                        Envio
                                    </span>
                                    <Badge variant="outline">
                                        {sendType === "now" ? "Imediato" : scheduledDate || "Agendado"}
                                    </Badge>
                                </div>
                                {(fromEmail || fromName || replyTo) && (
                                    <div className="flex items-center justify-between p-4">
                                        <span className="text-sm text-muted-foreground">
                                            Remetente
                                        </span>
                                        <span className="text-sm font-medium text-right">
                                            {fromName && <>{fromName} </>}
                                            {fromEmail && <>&lt;{fromEmail}&gt;</>}
                                            {replyTo && <><br /><span className="text-xs text-muted-foreground">Reply-to: {replyTo}</span></>}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                    ⚠️ Ao confirmar o envio
                                </p>
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                    Os emails serão enviados para todos os destinatários elegíveis
                                    da lista selecionada. Apenas pacientes com email e consentimento
                                    LGPD ativo receberão a mensagem.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="mx-auto flex max-w-2xl items-center justify-between">
                <Button
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    disabled={step === 1}
                >
                    <ArrowLeft className="mr-2 size-4" />
                    Voltar
                </Button>
                {step < 3 ? (
                    <Button
                        onClick={() => setStep(step + 1)}
                        disabled={!canGoNext}
                    >
                        Próximo
                        <ArrowRight className="ml-2 size-4" />
                    </Button>
                ) : (
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 size-4" />
                        )}
                        {sendType === "now" ? "Enviar campanha" : "Agendar campanha"}
                    </Button>
                )}
            </div>
        </main>
    );
}
