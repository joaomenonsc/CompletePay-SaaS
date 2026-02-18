"use client";

import { useState } from "react";

import { UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { useOrgSlug } from "../_hooks/use-org-slug";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MOCK_MY_TEAMS = [
  { id: "1", name: "Engineering", slug: "engineering", memberCount: 5, myRole: "member", projectCount: 3 },
  { id: "2", name: "Product", slug: "product", memberCount: 3, myRole: "owner", projectCount: 2 },
];

const MOCK_OTHER_TEAMS = [
  { id: "3", name: "Design", slug: "design", memberCount: 4, projectCount: 2 },
];

export default function OrgTeamsPage() {
  const { orgSlug, orgDisplayName } = useOrgSlug();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [teamName, setTeamName] = useState("");

  const filteredMy = MOCK_MY_TEAMS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredOther = MOCK_OTHER_TEAMS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreateTeam = () => {
    toast.success("Time criado.");
    setTeamName("");
    setCreateOpen(false);
  };

  const handleLeave = () => {
    toast.success("Você saiu do time.");
    setLeaveOpen(false);
  };

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Times"
      breadcrumbCurrent="Times"
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar times..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-[240px]"
          />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 size-4" />
                Criar time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar time</DialogTitle>
                <DialogDescription>Crie um novo time na organização.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    placeholder="Engineering"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateTeam} disabled={!teamName.trim()}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <SettingsSection title="Seus times">
          {filteredMy.length === 0 ? (
            <p className="text-muted-foreground text-sm">Você não participa de nenhum time ainda.</p>
          ) : (
            <ul className="space-y-3">
              {filteredMy.map((team) => (
                <li
                  key={team.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">#{team.slug}</Badge>
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {team.memberCount} membros · {team.projectCount} projetos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{team.myRole === "owner" ? "Proprietário" : "Membro"}</span>
                    <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                      <Button variant="ghost" size="sm">Sair</Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Sair do time?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Você deixará de ser membro do time {team.name}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleLeave}>Sair</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>

        <SettingsSection title="Outros times">
          {filteredOther.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum outro time disponível.</p>
          ) : (
            <ul className="space-y-3">
              {filteredOther.map((team) => (
                <li
                  key={team.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{team.slug}</Badge>
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {team.memberCount} membros · {team.projectCount} projetos
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => toast.info("Em breve.")}>
                    Solicitar entrada
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      </div>
    </SettingsOrgLayout>
  );
}
