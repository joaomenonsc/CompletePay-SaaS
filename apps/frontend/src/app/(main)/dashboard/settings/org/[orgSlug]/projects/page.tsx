"use client";

import { useState } from "react";

import { FolderPlus, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { useOrgSlug } from "../_hooks/use-org-slug";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MOCK_PROJECTS = [
  { id: "1", name: "CompletePay Web", slug: "completepay-web", color: "#6366f1", favorite: true },
  { id: "2", name: "API Gateway", slug: "api-gateway", color: "#22c55e", favorite: false },
];

export default function OrgProjectsPage() {
  const { orgSlug, orgDisplayName } = useOrgSlug();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");

  const filtered = MOCK_PROJECTS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = () => {
    toast.success("Projeto criado.");
    setProjectName("");
    setProjectDesc("");
    setCreateOpen(false);
  };

  const toggleFavorite = (id: string) => {
    toast.success("Favorito atualizado.");
  };

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Projetos"
      breadcrumbCurrent="Projetos"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar projetos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-[240px]"
          />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <FolderPlus className="mr-2 size-4" />
                Criar projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar projeto</DialogTitle>
                <DialogDescription>Adicione um novo projeto à organização.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    placeholder="Meu projeto"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Descrição (opcional)</label>
                  <Textarea
                    placeholder="Breve descrição"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!projectName.trim()}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <ul className="space-y-2">
          {filtered.map((project) => (
            <li
              key={project.id}
              className="flex items-center gap-4 rounded-md border p-4"
            >
              <div
                className="size-8 shrink-0 rounded-md"
                style={{ backgroundColor: project.color }}
              />
              <a
                href="#"
                className="min-w-0 flex-1 font-medium hover:underline truncate"
              >
                {project.name}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => toggleFavorite(project.id)}
                aria-label={project.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <Star
                  className={cn("size-4", project.favorite && "fill-current")}
                />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </SettingsOrgLayout>
  );
}
