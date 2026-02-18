"use no memo";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { EllipsisVertical } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConversationActions } from "./conversation-actions-context";

export interface ConversationMessage {
  role: "user" | "assistant";
  text: string;
  time?: string;
  kbRef?: string;
}

export interface ConversationRow {
  id: string;
  data: string;
  canal: string;
  status: string;
  msgs: number;
  csat: string;
  duracao: string;
  /** Período da conversa, ex: "14:32 - 14:36" */
  timeRange?: string;
  /** Label do canal para exibição no detalhe, ex: "Chat Widget" */
  canalLabel?: string;
  tokens?: number;
  custoEst?: string;
  messages: ConversationMessage[];
}

export const conversationColumns: ColumnDef<ConversationRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Selecionar todos"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div
        role="presentation"
        className="flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
    cell: ({ row }) => {
      const table = (
        row as Row<ConversationRow> & {
          table?: { getState(): { pagination: { pageIndex: number; pageSize: number } } };
        }
      ).table;
      const pagination = table?.getState?.()?.pagination;
      const n = pagination != null ? pagination.pageIndex * pagination.pageSize + row.index + 1 : row.index + 1;
      return <span className="font-medium">{n}</span>;
    },
    enableSorting: false,
  },
  {
    accessorKey: "data",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Data" />,
    cell: ({ row }) => row.original.data,
    enableSorting: false,
  },
  {
    accessorKey: "canal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Canal" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
        {row.original.canal}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
        {row.original.status}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "msgs",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Msgs" className="w-full text-right" />,
    cell: ({ row }) => <div className="text-right">{row.original.msgs}</div>,
    enableSorting: false,
  },
  {
    accessorKey: "csat",
    header: ({ column }) => <DataTableColumnHeader column={column} title="CSAT" />,
    cell: ({ row }) => row.original.csat,
    enableSorting: false,
  },
  {
    accessorKey: "duracao",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Duração" />,
    cell: ({ row }) => row.original.duracao,
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell row={row} />,
    enableSorting: false,
  },
];

function ActionsCell({ row }: { row: Row<ConversationRow> }) {
  const actions = useConversationActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
          size="icon"
          onClick={(e) => e.stopPropagation()}
        >
          <EllipsisVertical />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            actions?.onOpenDetail(row);
          }}
        >
          Ver detalhe
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            actions?.onExportCsv(row);
          }}
        >
          Exportar CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
