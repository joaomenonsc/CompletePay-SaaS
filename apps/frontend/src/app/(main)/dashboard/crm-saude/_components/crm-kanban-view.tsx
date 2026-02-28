"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
    CalendarClock,
    Clock,
    GripVertical,
    MoreHorizontal,
    User,
    UserCog,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { updateAppointmentStatus } from "@/lib/api/crm";
import type { AppointmentListItem } from "@/types/crm";

// ─── Column definitions ────────────────────────────────────────────────────────

interface KanbanColumn {
    id: string;
    label: string;
    colorClass: string;       // dot / header accent
    headerBg: string;         // column header background
    cardBorder: string;       // card left-border accent
    transitions: string[];    // valid next statuses
}

const COLUMNS: KanbanColumn[] = [
    {
        id: "agendado",
        label: "Agendado",
        colorClass: "bg-blue-500",
        headerBg: "bg-blue-500/10 border-blue-200 dark:border-blue-800",
        cardBorder: "border-l-blue-400",
        transitions: ["confirmado", "cancelado"],
    },
    {
        id: "confirmado",
        label: "Confirmado",
        colorClass: "bg-emerald-500",
        headerBg: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-800",
        cardBorder: "border-l-emerald-400",
        transitions: ["em_atendimento", "no_show", "cancelado"],
    },
    {
        id: "em_atendimento",
        label: "Em atendimento",
        colorClass: "bg-amber-500",
        headerBg: "bg-amber-500/10 border-amber-200 dark:border-amber-800",
        cardBorder: "border-l-amber-400",
        transitions: ["atendido"],
    },
    {
        id: "atendido",
        label: "Atendido",
        colorClass: "bg-muted-foreground",
        headerBg: "bg-muted border-border",
        cardBorder: "border-l-muted-foreground",
        transitions: [],
    },
    {
        id: "no_show",
        label: "Não compareceu",
        colorClass: "bg-orange-500",
        headerBg: "bg-orange-500/10 border-orange-200 dark:border-orange-800",
        cardBorder: "border-l-orange-400",
        transitions: ["agendado"],
    },
    {
        id: "cancelado",
        label: "Cancelado",
        colorClass: "bg-destructive",
        headerBg: "bg-destructive/10 border-destructive/20",
        cardBorder: "border-l-destructive",
        transitions: ["agendado"],
    },
];

const STATUS_LABELS: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    em_atendimento: "Em atendimento",
    atendido: "Atendido",
    no_show: "Não compareceu",
    cancelado: "Cancelado",
};

// ─── Card ──────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
    appointment: AppointmentListItem;
    column: KanbanColumn;
    onCardClick: (a: AppointmentListItem) => void;
    onStatusChange: (id: string, status: string) => void;
    isPending: boolean;
}

function KanbanCard({ appointment: a, column, onCardClick, onStatusChange, isPending }: KanbanCardProps) {
    const start = new Date(a.start_time);
    const end = new Date(a.end_time);

    return (
        <div
            className={`
        group relative rounded-lg border border-l-4 bg-card shadow-sm transition-all
        hover:shadow-md cursor-pointer select-none
        ${column.cardBorder}
      `}
            onClick={() => onCardClick(a)}
        >
            {/* Header row */}
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <GripVertical className="size-3.5 opacity-30" />
                    <span className="text-xs font-medium truncate max-w-[120px]">
                        {format(start, "dd/MM", { locale: ptBR })}
                    </span>
                </div>

                {/* Quick action menu — stops propagation so it doesn't open detail */}
                {column.transitions.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled={isPending}
                            >
                                <MoreHorizontal className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[160px]">
                            {column.transitions.map((next) => (
                                <DropdownMenuItem
                                    key={next}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(a.id, next);
                                    }}
                                >
                                    Mover para: {STATUS_LABELS[next] ?? next}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* Body */}
            <div className="px-3 pb-3 space-y-2">
                {/* Time */}
                <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="size-3.5 text-muted-foreground shrink-0" />
                    {format(start, "HH:mm")} – {format(end, "HH:mm")}
                </div>

                {/* Patient */}
                <div className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                        {a.patient_name ?? "Paciente"}
                    </span>
                </div>

                {/* Professional */}
                <div className="flex items-center gap-1.5">
                    <UserCog className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                        {a.professional_name ?? "Profissional"}
                    </span>
                </div>

                {/* Type badge */}
                <div className="pt-0.5">
                    <Badge variant="outline" className="text-xs capitalize px-2 py-0">
                        {a.appointment_type}
                    </Badge>
                </div>
            </div>
        </div>
    );
}

// ─── Column ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
    column: KanbanColumn;
    appointments: AppointmentListItem[];
    onCardClick: (a: AppointmentListItem) => void;
    onStatusChange: (id: string, status: string) => void;
    pendingId: string | null;
}

function KanbanColumnView({ column, appointments, onCardClick, onStatusChange, pendingId }: KanbanColumnProps) {
    return (
        <div className="flex min-w-[240px] max-w-[280px] flex-1 flex-col gap-3">
            {/* Column header */}
            <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${column.headerBg}`}>
                <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${column.colorClass}`} />
                    <span className="text-sm font-semibold">{column.label}</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-background rounded-full px-2 py-0.5 border">
                    {appointments.length}
                </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 min-h-[80px]">
                {appointments.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                        Nenhum agendamento
                    </div>
                ) : (
                    appointments.map((a) => (
                        <KanbanCard
                            key={a.id}
                            appointment={a}
                            column={column}
                            onCardClick={onCardClick}
                            onStatusChange={onStatusChange}
                            isPending={pendingId === a.id}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Main export ───────────────────────────────────────────────────────────────

interface CrmKanbanViewProps {
    appointments: AppointmentListItem[];
    isLoading?: boolean;
    onAppointmentClick: (a: AppointmentListItem) => void;
}

export function CrmKanbanView({ appointments, isLoading, onAppointmentClick }: CrmKanbanViewProps) {
    const queryClient = useQueryClient();
    const [pendingId, setPendingId] = React.useState<string | null>(null);

    const updateStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            updateAppointmentStatus(id, { status }),
        onMutate: ({ id }) => setPendingId(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crm-appointments-wide"] });
            queryClient.invalidateQueries({ queryKey: ["crm-appointments-list"] });
            toast.success("Status atualizado.");
        },
        onError: (err: { response?: { data?: { detail?: string } } }) => {
            toast.error(err?.response?.data?.detail ?? "Erro ao atualizar status.");
        },
        onSettled: () => setPendingId(null),
    });

    if (isLoading) {
        return (
            <div className="w-full overflow-x-hidden">
                <div className="overflow-x-auto pb-4">
                    <div className="flex gap-4" style={{ width: 'max-content', minWidth: '100%' }}>
                        {COLUMNS.map((col) => (
                            <div key={col.id} className="flex min-w-[240px] flex-1 flex-col gap-3">
                                <Skeleton className="h-9 w-full rounded-lg" />
                                <Skeleton className="h-24 w-full rounded-lg" />
                                <Skeleton className="h-24 w-full rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Group by status
    const byStatus: Record<string, AppointmentListItem[]> = {};
    for (const col of COLUMNS) byStatus[col.id] = [];
    for (const a of appointments) {
        const s = (a.status ?? "agendado").toLowerCase();
        if (byStatus[s]) byStatus[s].push(a);
        else byStatus["agendado"].push(a); // fallback
    }

    // Sort each column by start_time
    for (const key of Object.keys(byStatus)) {
        byStatus[key].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }

    return (
        <div className="w-full overflow-x-hidden">
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4" style={{ width: 'max-content', minWidth: '100%' }}>
                    {COLUMNS.map((col) => (
                        <KanbanColumnView
                            key={col.id}
                            column={col}
                            appointments={byStatus[col.id] ?? []}
                            onCardClick={onAppointmentClick}
                            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                            pendingId={pendingId}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// Need React for useState
import React from "react";
