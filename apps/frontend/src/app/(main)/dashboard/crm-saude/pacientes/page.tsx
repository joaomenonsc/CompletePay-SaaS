"use client";

import { useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";
import { usePatients } from "@/hooks/use-patients";
import { useDebounce } from "@/hooks/use-debounce";
import { Plus, Search } from "lucide-react";

import { NewPatientDialog } from "../_components/new-patient-dialog";
import { patientsColumns } from "../_components/patients-columns";
import { ServerPagination } from "../_components/server-pagination";

const DEFAULT_PAGE_SIZE = 20;

export default function PacientesPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = usePatients({
    limit: pageSize,
    offset: pageIndex * pageSize,
    q: debouncedSearch || undefined,
  });

  const patients = data?.items ?? [];
  const total = data?.total ?? 0;

  const table = useDataTableInstance({
    data: patients,
    columns: patientsColumns,
    getRowId: (row) => row.id,
    enableRowSelection: false,
    defaultPageSize: pageSize,
    defaultPageIndex: 0,
  });

  return (
    <main className="space-y-6" role="main" aria-label="Pacientes">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pacientes</h1>
          <p className="text-muted-foreground text-sm">
            Cadastro e busca de pacientes.
          </p>
        </div>
        <NewPatientDialog trigger={<Button><Plus className="mr-2 size-4" />Novo paciente</Button>} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lista de pacientes</CardTitle>
          <CardDescription>
            {total} paciente(s) encontrado(s). Use a busca para filtrar por nome.
          </CardDescription>
          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome..."
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
            <p className="text-muted-foreground py-8 text-center text-sm">Carregando…</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-md border">
                <DataTable table={table} columns={patientsColumns} />
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
