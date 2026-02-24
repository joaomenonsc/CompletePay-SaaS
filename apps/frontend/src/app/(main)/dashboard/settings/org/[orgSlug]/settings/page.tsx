"use client";

import { useState } from "react";

import { Copy } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { useOrgSlug } from "../_hooks/use-org-slug";
import { updateOrganization, uploadOrganizationAvatar } from "@/lib/api/organizations";
import { API_BASE_URL } from "@/lib/api-config";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const slugSchema = z
  .string()
  .min(3, "Mínimo 3 caracteres")
  .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens");

const generalSchema = z.object({
  slug: slugSchema,
  displayName: z.string().min(1, "Obrigatório"),
});

type GeneralFormValues = z.infer<typeof generalSchema>;

type AvatarType = "initials" | "upload" | "url";

const ACCEPT_IMAGE = "image/jpeg,image/png,image/gif,image/webp";
const MAX_AVATAR_MB = 5;

export default function OrgSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgSlug, orgDisplayName, org } = useOrgSlug();
  const [earlyAdopter, setEarlyAdopter] = useState(false);
  const [aiFeatures, setAiFeatures] = useState(false);
  const [codeCoverage, setCodeCoverage] = useState(false);
  const [avatarType, setAvatarType] = useState<AvatarType>("initials");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrlValue, setAvatarUrlValue] = useState("");
  const [defaultRole, setDefaultRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const form = useForm<GeneralFormValues>({
    resolver: zodResolver(generalSchema),
    values: org
      ? { slug: org.slug, displayName: org.name }
      : undefined,
    defaultValues: {
      slug: orgSlug,
      displayName: orgDisplayName,
    },
  });

  const onSaveGeneral = async (data: GeneralFormValues) => {
    if (!org?.id) {
      toast.error("Organização não encontrada.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateOrganization(org.id, {
        name: data.displayName,
        slug: data.slug,
      });
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Configurações salvas.");
      if (updated.slug !== orgSlug) {
        router.replace(
          `/dashboard/settings/org/${encodeURIComponent(updated.slug)}/settings`
        );
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      toast.error(message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      toast.error(`A imagem deve ter no máximo ${MAX_AVATAR_MB}MB.`);
      return;
    }
    if (!ACCEPT_IMAGE.split(",").some((t) => file.type === t.trim())) {
      toast.error("Use JPEG, PNG, GIF ou WebP.");
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSaveAvatar = async () => {
    if (!org?.id) {
      toast.error("Organização não encontrada.");
      return;
    }
    setSavingAvatar(true);
    try {
      if (avatarType === "initials") {
        await updateOrganization(org.id, { avatarUrl: null });
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
        toast.success("Avatar atualizado.");
        return;
      }
      if (avatarType === "upload" && avatarFile) {
        await uploadOrganizationAvatar(org.id, avatarFile);
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
        setAvatarFile(null);
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview);
          setAvatarPreview(null);
        }
        toast.success("Avatar atualizado.");
        return;
      }
      if (avatarType === "url" && avatarUrlValue.trim()) {
        const url = avatarUrlValue.trim();
        await updateOrganization(org.id, { avatarUrl: url });
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
        toast.success("Avatar atualizado.");
        return;
      }
      toast.error("Selecione uma opção e preencha o campo necessário.");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      toast.error(message ?? "Erro ao salvar o avatar. Tente novamente.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const orgAvatarSrc =
    avatarPreview ??
    (org?.avatarUrl
      ? org.avatarUrl.startsWith("http")
        ? org.avatarUrl
        : `${API_BASE_URL}${org.avatarUrl}`
      : undefined);
  const saveAvatarDisabled =
    (avatarType === "upload" && !avatarFile) ||
    (avatarType === "url" && !avatarUrlValue.trim());

  const handleCopyOrgId = () => {
    const id = org?.id ?? "";
    if (id) {
      void navigator.clipboard.writeText(id);
      toast.success("ID da organização copiado.");
    }
  };

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Configurações da organização"
      breadcrumbCurrent="Configurações da organização"
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Geral</CardTitle>
            <CardDescription>Identidade e preferências da organização.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSaveGeneral)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug da organização</FormLabel>
                      <FormControl>
                        <Input className="h-9" placeholder="minha-org" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de exibição</FormLabel>
                      <FormControl>
                        <Input className="h-9" placeholder="Minha Organização" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <Label>ID da organização</Label>
                  <InputGroup>
                    <InputGroupInput
                      readOnly
                      value={org?.id ?? ""}
                      className="bg-muted/50 font-mono text-sm"
                      aria-readonly="true"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyOrgId}
                        aria-label="Copiar ID da organização"
                      >
                        <Copy className="size-4" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="early-adopter">Early adopter</Label>
                    <Switch id="early-adopter" checked={earlyAdopter} onCheckedChange={setEarlyAdopter} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ai-features">Recursos de IA</Label>
                    <Switch id="ai-features" checked={aiFeatures} onCheckedChange={setAiFeatures} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="code-coverage">Cobertura de código</Label>
                    <Switch id="code-coverage" checked={codeCoverage} onCheckedChange={setCodeCoverage} />
                  </div>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Associação</CardTitle>
            <CardDescription>Função padrão e permissões.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Função padrão</Label>
              <Select value={defaultRole} onValueChange={setDefaultRole}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Proprietário</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="open-membership">Associação aberta</Label>
              <Switch id="open-membership" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
            <CardDescription>Imagem ou iniciais exibidas para a organização.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <Avatar className="size-20 shrink-0">
                <AvatarImage src={orgAvatarSrc} alt={orgDisplayName} />
                <AvatarFallback className="text-lg">{getInitials(orgDisplayName)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-4">
                <RadioGroup
                  value={avatarType}
                  onValueChange={(v) => setAvatarType(v as AvatarType)}
                  aria-label="Tipo de avatar"
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="initials" id="org-avatar-initials" />
                    <Label htmlFor="org-avatar-initials" className="font-normal cursor-pointer">Usar iniciais</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="upload" id="org-avatar-upload" />
                    <Label htmlFor="org-avatar-upload" className="font-normal cursor-pointer">Enviar arquivo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="url" id="org-avatar-url" />
                    <Label htmlFor="org-avatar-url" className="font-normal cursor-pointer">URL</Label>
                  </div>
                </RadioGroup>
                {avatarType === "upload" && (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept={ACCEPT_IMAGE}
                      onChange={handleAvatarFileChange}
                      className="cursor-pointer"
                    />
                    <p className="text-muted-foreground text-xs">
                      JPEG, PNG, GIF ou WebP. Máximo {MAX_AVATAR_MB}MB.
                    </p>
                  </div>
                )}
                {avatarType === "url" && (
                  <Input
                    type="url"
                    placeholder="https://exemplo.com/logo.png"
                    value={avatarUrlValue}
                    onChange={(e) => setAvatarUrlValue(e.target.value)}
                    className="h-9"
                  />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onSaveAvatar}
                  disabled={saveAvatarDisabled || savingAvatar}
                >
                  {savingAvatar ? "Salvando..." : "Salvar avatar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Remover organização</CardTitle>
            <CardDescription>
              Esta ação é irreversível. Todos os dados da organização serão perdidos.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="destructive" disabled title="Disponível em breve">
              Remover organização
            </Button>
          </CardFooter>
        </Card>
      </div>
    </SettingsOrgLayout>
  );
}
