"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { HeartPulse, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { fetchPatients } from "@/lib/api/crm";
import type { Patient } from "@/types/crm";

function patientDisplayName(p: Patient): string {
  return (p.social_name && p.social_name.trim() ? p.social_name : p.full_name) || "Sem nome";
}

export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const router = useRouter();

  const { data: patientResult, isLoading: patientsLoading } = useQuery({
    queryKey: ["crm-patients-search", debouncedSearch],
    queryFn: () => fetchPatients({ q: debouncedSearch, limit: 10, offset: 0 }),
    enabled: open && debouncedSearch.trim().length >= 2,
  });
  const patients = patientResult?.items ?? [];

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) setSearch("");
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  const handleSelectPatient = (id: string) => {
    setOpen(false);
    setSearch("");
    router.push(`/dashboard/crm-saude/pacientes/${id}`);
  };

  return (
    <>
      <Button
        variant="link"
        className="!px-0 font-normal text-muted-foreground hover:no-underline"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        Search
        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar pacientes por nome, CPF, telefone ou data…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {patientsLoading ? "Buscando…" : "Nenhum paciente encontrado."}
          </CommandEmpty>
          {patients.length > 0 && (
            <CommandGroup heading="Pacientes (CRM Saúde)">
              {patients.map((p) => (
                <CommandItem
                  key={p.id}
                  className="!py-1.5"
                  onSelect={() => handleSelectPatient(p.id)}
                >
                  <HeartPulse className="mr-2 size-4 text-muted-foreground" />
                  <span>{patientDisplayName(p)}</span>
                  {p.phone && (
                    <span className="ml-2 text-muted-foreground text-xs">{p.phone}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
