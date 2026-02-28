"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Patient } from "@/types/crm";

/** Nome de exibicao: prioriza nome social quando preenchido (PRD 2.1). */
export function patientDisplayName(p: Patient): string {
  return (p.social_name && p.social_name.trim()) ? p.social_name.trim() : p.full_name;
}

export const patientsColumns: ColumnDef<Patient>[] = [
  {
    accessorKey: "full_name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nome" />,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/crm-saude/pacientes/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {patientDisplayName(row.original)}
      </Link>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "birth_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nascimento" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {format(new Date(row.original.birth_date), "dd/MM/yyyy", { locale: ptBR })}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Telefone" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.phone}</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "ativo" ? "secondary" : "outline"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/crm-saude/pacientes/${row.original.id}`}>Ver</Link>
      </Button>
    ),
    enableSorting: false,
  },
];
