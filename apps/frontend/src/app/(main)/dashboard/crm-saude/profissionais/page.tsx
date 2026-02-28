"use client";

import { useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";
import { useDebounce } from "@/hooks/use-debounce";
import { useProfessionals } from "@/hooks/use-professionals";
import { Plus, Search } from "lucide-react";

import { NewProfessionalDialog } from "../_components/new-professional-dialog";
import { professionalsColumns } from "../_components/professionals-columns";
import { ServerPagination } from "../_components/server-pagination";

const DEFAULT_PAGE_SIZE = 20;

export default function ProfissionaisPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useProfessionals({
    limit: pageSize,
    offset: pageIndex * pageSize,
    q: debouncedSearch || undefined,
  });

  const professionals = data?.items ?? [];
  const total = data?.total ?? 0;

  const table = useDataTableInstance({
    data: professionals,
    columns: professionalsColumns,
    getRowId: (row) => row.id,
    enableRowSelection: false,
    defaultPageSize: pageSize,
    defaultPageIndex: 0,
  });

  return (
    <main className="space-y-6" role="main" aria-label="Profissionais">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profissionais de Saúde</h1>
          <p className="text-muted-foreground text-sm">
            Cadastro e gestão de profissionais.
          </p>
        </div>
        <NewProfessionalDialog
          trigger={
            <Button>
              <Plus className="mr-2 size-4" />
              Novo profissional
            </Button>
          }
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lista de profissionais</CardTitle>
          <CardDescription>
            {total} profissional(is) encontrado(s). Use a busca por nome ou
            número de registro.
          </CardDescription>
          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome ou número de registro..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPageIndex(0);
                }}
                className="pl-9"
              />
            </div>
            <DataTableViewOptions table={table} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Carregando…
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-md border">
                <DataTable
                  table={table}
                  columns={professionalsColumns}
                />
              </div>
              <ServerPagination
                pageIndex={pageIndex}
                pageSize={pageSize}
                total={total}
                onPageIndexChange={setPageIndex}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
