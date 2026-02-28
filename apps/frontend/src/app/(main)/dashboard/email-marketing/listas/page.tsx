"use client";

import { useState } from "react";
import {
    Filter,
    Loader2,
    Plus,
    Search,
    Trash2,
    Users,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLists, useCreateList } from "@/hooks/use-marketing";
import type { EmailList } from "@/types/marketing";

// ── Suggested segments ─────────────────────────────────────────────────────────

const SUGGESTED_SEGMENTS = [
    {
        name: "Pacientes inativos (>6 meses)",
        desc: "Pacientes sem consulta nos últimos 6 meses",
        type: "dynamic" as const,
    },
    {
        name: "Todos com consentimento",
        desc: "Pacientes com consentimento de email marketing ativo",
        type: "dynamic" as const,
    },
    {
        name: "Pacientes ativos",
        desc: "Pacientes com status ativo na clínica",
        type: "dynamic" as const,
    },
];

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ListasPage() {
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [newListDesc, setNewListDesc] = useState("");
    const [newListType, setNewListType] = useState("static");

    const { data, isLoading } = useLists({ limit: 100 });
    const createMutation = useCreateList();

    const lists = data?.items ?? [];
    const filteredLists = lists.filter((l: EmailList) =>
        l.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreateList = () => {
        if (!newListName) return;
        createMutation.mutate(
            {
                name: newListName,
                description: newListDesc || undefined,
                list_type: newListType,
            },
            {
                onSuccess: () => {
                    setDialogOpen(false);
                    setNewListName("");
                    setNewListDesc("");
                    setNewListType("static");
                },
            }
        );
    };

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Listas</h1>
                    <p className="text-sm text-muted-foreground">
                        Gerencie suas listas de contatos e segmentos de pacientes.
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 size-4" />
                            Nova lista
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar nova lista</DialogTitle>
                            <DialogDescription>
                                Crie uma lista estática ou dinâmica para segmentar seus destinatários.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Nome da lista *</Label>
                                <Input
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="Ex: Pacientes inativos"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Textarea
                                    value={newListDesc}
                                    onChange={(e) => setNewListDesc(e.target.value)}
                                    placeholder="Descrição da lista..."
                                    rows={2}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={newListType} onValueChange={setNewListType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="static">Estática</SelectItem>
                                        <SelectItem value="dynamic">Dinâmica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCreateList}
                                disabled={!newListName || createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Plus className="mr-2 size-4" />
                                )}
                                Criar lista
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar listas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Lists from API */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : filteredLists.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredLists.map((list: EmailList) => (
                        <Card key={list.id} className="transition-shadow hover:shadow-md">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                    <Badge variant="outline" className="text-xs capitalize">
                                        {list.list_type === "dynamic" ? "Dinâmica" : "Estática"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {list.subscriber_count} contatos
                                    </span>
                                </div>
                                <h3 className="mt-2 text-sm font-semibold">{list.name}</h3>
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                    {list.description || "Sem descrição"}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    Atualizado em {new Date(list.updated_at).toLocaleDateString("pt-BR")}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                                <Users className="size-6 text-muted-foreground" />
                            </div>
                            <h3 className="mt-4 text-sm font-semibold">
                                Nenhuma lista criada
                            </h3>
                            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                                Crie listas estáticas com contatos específicos ou listas dinâmicas
                                baseadas em filtros de segmentação.
                            </p>
                            <div className="mt-4 flex gap-3">
                                <Button size="sm" onClick={() => { setNewListType("static"); setDialogOpen(true); }}>
                                    <Plus className="mr-2 size-4" />
                                    Lista estática
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setNewListType("dynamic"); setDialogOpen(true); }}>
                                    <Filter className="mr-2 size-4" />
                                    Lista dinâmica
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Suggested segments */}
            <div>
                <h2 className="mb-3 text-base font-semibold">Segmentos sugeridos</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {SUGGESTED_SEGMENTS.map((segment) => (
                        <Card key={segment.name} className="cursor-pointer transition-shadow hover:shadow-md">
                            <CardContent className="p-5">
                                <Badge variant="outline" className="text-xs capitalize">
                                    {segment.type === "dynamic" ? "Dinâmica" : "Estática"}
                                </Badge>
                                <h3 className="mt-2 text-sm font-semibold">{segment.name}</h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {segment.desc}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3 w-full"
                                    onClick={() => {
                                        setNewListName(segment.name);
                                        setNewListDesc(segment.desc);
                                        setNewListType(segment.type);
                                        setDialogOpen(true);
                                    }}
                                >
                                    Criar esta lista
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </main>
    );
}
