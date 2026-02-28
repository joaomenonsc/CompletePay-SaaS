"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Professional } from "@/types/crm";

const CATEGORY_LABELS: Record<string, string> = {
  MED: "Médico",
  ENF: "Enfermeiro(a)",
  PSI: "Psicólogo(a)",
  FIS: "Fisioterapeuta",
  NUT: "Nutricionista",
  DEN: "Dentista",
  FAR: "Farmacêutico(a)",
  FNO: "Fonoaudiólogo(a)",
  TER: "Terapeuta ocupacional",
  OUT: "Outro",
};

export function professionalDisplayName(p: Professional): string {
  return p.social_name?.trim() ? p.social_name.trim() : p.full_name;
}

export function professionalCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export const professionalsColumns: ColumnDef<Professional>[] = [
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nome" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/dashboard/crm-saude/profissionais/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {professionalDisplayName(row.original)}
      </Link>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Categoria" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {professionalCategoryLabel(row.original.category)}
      </span>
    ),
  },
  {
    accessorKey: "council",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Conselho" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.council} {row.original.registration_number}/
        {row.original.council_uf}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "ativo" ? "secondary" : "outline"}
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/crm-saude/profissionais/${row.original.id}`}>
          Ver
        </Link>
      </Button>
    ),
    enableSorting: false,
  },
];
