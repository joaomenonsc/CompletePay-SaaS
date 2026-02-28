---
paths: "apps/frontend/src/components/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: instalar novo componente shadcn, mudar padrão de formulário, novo componente compartilhado

# Components — shadcn/ui + Componentes customizados

## Estrutura

```
components/
├── ui/               # shadcn/ui (55 arquivos) — NÃO modificar diretamente
├── data-table/       # TanStack Table wrappers
└── email-marketing/  # Editor visual de email e builder de blocos
    ├── email-editor.tsx       # Componente raiz do editor
    └── builder/               # Blocos do builder
        ├── block-renderer.tsx # Renderiza bloco por tipo
        ├── canvas.tsx         # Canvas drag-and-drop do email
        ├── palette.tsx        # Paleta de blocos disponíveis
        ├── properties-panel.tsx # Painel de propriedades do bloco selecionado
        └── utils.ts           # Utilitários do builder
```

> Componentes de feature ficam em `_components/` dentro da própria rota
> (ex.: `app/(main)/dashboard/crm-saude/_components/`)

## `components/ui/` — Biblioteca shadcn/ui

**NÃO modificar** arquivos de `components/ui/` — são gerados pelo CLI shadcn.
Para customizações, criar wrapper em `_components/` da feature.

### Componentes disponíveis (55 arquivos)

**Layout / Container:**
`card`, `separator`, `scroll-area`, `resizable`, `collapsible`, `aspect-ratio`

**Tipografia / Display:**
`badge`, `alert`, `avatar`, `skeleton`, `spinner`, `empty`, `kbd`

**Formulários:**
`button`, `button-group`, `input`, `input-group`, `input-otp`, `textarea`,
`label`, `field`, `form`, `checkbox`, `radio-group`, `switch`, `select`,
`native-select`, `combobox`, `slider`

**Feedback:**
`dialog`, `alert-dialog`, `drawer`, `sheet`, `popover`, `hover-card`,
`tooltip`, `sonner` (Toaster)

**Navegação:**
`sidebar`, `navigation-menu`, `menubar`, `breadcrumb`, `tabs`,
`dropdown-menu`, `context-menu`, `command`

**Dados:**
`table`, `pagination`, `chart` (Recharts), `calendar`, `carousel`

**Outros:**
`accordion`, `toggle`, `toggle-group`, `item`, `direction`, `progress`

## Uso dos componentes UI

```typescript
// Imports sempre absolutos
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
```

## `components/data-table/` — TanStack Table

Componentes para tabelas com paginação, filtros e seleção de colunas:

```typescript
import { DataTable } from "@/components/data-table/data-table"
import { DataTableViewOptions } from "@/components/data-table/view-options"
import { ServerPagination } from "@/components/data-table/server-pagination"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"

// Uso típico em page.tsx
const table = useDataTableInstance({
  data: patients ?? [],
  columns: patientsColumns,
  getRowId: (row) => row.id,
})

return (
  <>
    <DataTableViewOptions table={table} />
    <DataTable table={table} columns={patientsColumns} />
    <ServerPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      total={data?.total ?? 0}
      onPageIndexChange={setPageIndex}
    />
  </>
)
```

## Padrão de componente de feature (_components/)

```typescript
// apps/frontend/src/app/(main)/dashboard/crm-saude/_components/PatientForm.tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useCreatePatient } from "@/hooks/use-patients"
import type { PatientCreateInput } from "@/types/crm"

const schema = z.object({
  full_name: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  phone: z.string().min(10, "Telefone inválido"),
})

interface PatientFormProps {
  onSuccess?: () => void
}

export function PatientForm({ onSuccess }: PatientFormProps) {
  const createPatient = useCreatePatient()
  const form = useForm<PatientCreateInput>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: PatientCreateInput) => {
    await createPatient.mutateAsync(data)
    onSuccess?.()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createPatient.isPending}>
          {createPatient.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </Form>
  )
}
```

## Formulários — React Hook Form + Zod

```typescript
// Schema de validação com Zod
const schema = z.object({
  campo: z.string().min(1, "Obrigatório"),
  opcional: z.string().optional(),
})

// Form instance
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { campo: "" },
})
```

## Convenções

1. Nomes de componentes: `PascalCase` — `PatientForm`, `AppointmentCard`
2. Arquivo: `kebab-case.tsx` — `patient-form.tsx`
3. Props interface: `<Nome>Props` — `interface PatientFormProps`
4. Componentes de feature ficam em `_components/` da rota, **não** em `components/`
5. Componentes compartilhados entre módulos → `components/` na raiz de src
6. Sempre `"use client"` em componentes com estado/eventos
