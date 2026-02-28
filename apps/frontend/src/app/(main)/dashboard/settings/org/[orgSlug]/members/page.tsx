"use client";

import { useState } from "react";

import { UserPlus } from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { useOrgSlug } from "../_hooks/use-org-slug";
import {
  type OrgMember,
  fetchOrgMembers,
  getOrgRoleLabel,
  inviteOrgMember,
  ORG_ROLES,
  removeOrgMember,
  updateOrgMemberRole,
} from "@/lib/api/organizations";
import { getMe } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api-config";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

export default function OrgMembersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgSlug, orgDisplayName, org } = useOrgSlug();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);
  const [leaving, setLeaving] = useState(false);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["organizations", org?.id, "members"],
    queryFn: () => fetchOrgMembers(org!.id),
    enabled: !!org?.id,
  });

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  const currentUserId = me?.user_id ?? "";
  const orgRole = (org?.role ?? "").toLowerCase();
  const isOwner = orgRole === "owner";
  /** Proprietário ou gestor clínico podem convidar, alterar função e remover membros. */
  const isOrgAdmin = orgRole === "owner" || orgRole === "gcl";

  const handleInvite = async () => {
    if (!org?.id || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteOrgMember(org.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      await queryClient.invalidateQueries({ queryKey: ["organizations", org.id, "members"] });
      toast.success("Membro adicionado.");
      setInviteEmail("");
      setInviteRole("member");
      setInviteOpen(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      toast.error(message ?? "Não foi possível adicionar. Verifique o e-mail.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: OrgMember) => {
    if (!org?.id) return;
    try {
      await removeOrgMember(org.id, member.userId);
      await queryClient.invalidateQueries({ queryKey: ["organizations", org.id, "members"] });
      if (member.userId === currentUserId) {
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
        toast.success("Você saiu da organização.");
        router.push("/dashboard/settings/org");
      } else {
        toast.success("Membro removido.");
      }
      setRemoveTarget(null);
      setLeaving(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      toast.error(message ?? "Erro ao remover.");
    }
  };

  const handleRoleChange = async (member: OrgMember, newRole: string) => {
    if (!org?.id || newRole === member.role) return;
    try {
      await updateOrgMemberRole(org.id, member.userId, newRole);
      await queryClient.invalidateQueries({ queryKey: ["organizations", org.id, "members"] });
      toast.success("Função atualizada.");
    } catch {
      toast.error("Erro ao atualizar função.");
    }
  };

  const openRemoveDialog = (member: OrgMember, isLeave: boolean) => {
    setRemoveTarget(member);
    setLeaving(isLeave);
  };

  const avatarUrl = (m: OrgMember) =>
    m.avatarUrl
      ? m.avatarUrl.startsWith("http")
        ? m.avatarUrl
        : `${API_BASE_URL}${m.avatarUrl}`
      : undefined;

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Membros"
      breadcrumbCurrent="Membros"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar membros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-[240px]"
          />
          {isOrgAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 size-4" />
                  Convidar membros
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar membros</DialogTitle>
                  <DialogDescription>
                    Adicione um usuário existente na plataforma pelo e-mail. Ele precisará já ter uma conta.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">E-mail</label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Função</label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {getOrgRoleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                    {inviting ? "Adicionando..." : "Adicionar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center py-8">
                    Nenhum membro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={avatarUrl(member)} alt={member.name} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.name || member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name || "—"}</p>
                          <p className="text-muted-foreground text-sm">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOrgAdmin && member.userId !== currentUserId ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member, v)}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORG_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {getOrgRoleLabel(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                          {getOrgRoleLabel(member.role)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.userId === currentUserId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openRemoveDialog(member, true)}
                        >
                          Sair
                        </Button>
                      ) : isOrgAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openRemoveDialog(member, false)}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {leaving ? "Sair da organização?" : "Remover membro?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {leaving
                ? "Você perderá acesso a esta organização. É possível ser convidado novamente."
                : "O membro perderá acesso à organização."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemove(removeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving ? "Sair" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsOrgLayout>
  );
}
