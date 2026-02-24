"use client";

import { useEffect, useState } from "react";

import { Copy } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { SettingsAccountLayout } from "@/app/(main)/dashboard/settings/_components/settings-account-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { getMe, updateMe, uploadAvatar } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api-config";
import { getInitials } from "@/lib/utils";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { THEME_MODE_OPTIONS } from "@/lib/preferences/theme";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const accountDetailsSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").min(2, "Nome deve ter pelo menos 2 caracteres"),
});

type AccountDetailsFormValues = z.infer<typeof accountDetailsSchema>;

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
];

const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "America/São Paulo" },
  { value: "America/New_York", label: "America/New York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "UTC", label: "UTC" },
];

const STACK_TRACE_OPTIONS = [
  { value: "most_recent", label: "Chamada mais recente por último" },
  { value: "oldest_first", label: "Chamada mais antiga primeiro" },
];

const DEFAULT_ISSUE_OPTIONS = [
  { value: "recommended", label: "Recomendado" },
  { value: "newest", label: "Mais recente" },
  { value: "oldest", label: "Mais antigo" },
];

type AvatarType = "initials" | "upload" | "gravatar";

const ACCEPT_IMAGE = "image/jpeg,image/png,image/gif,image/webp";
const MAX_AVATAR_MB = 5;

export default function AccountDetailsPage() {
  const [avatarType, setAvatarType] = useState<AvatarType>("initials");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [use24hClock, setUse24hClock] = useState(false);
  const [stackTraceOrder, setStackTraceOrder] = useState("most_recent");
  const [defaultIssueEvent, setDefaultIssueEvent] = useState("recommended");

  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const queryClient = useQueryClient();

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (me?.name !== undefined) {
      form.reset({ name: me.name ?? "" });
    }
  }, [me?.name, form]);

  const handleCopyUserId = () => {
    const id = me?.user_id ?? "";
    void navigator.clipboard.writeText(id);
    toast.success("User ID copiado.");
  };

  const handleSaveProfile = async (data: AccountDetailsFormValues) => {
    try {
      await updateMe({ name: data.name });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Conta atualizada.");
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    }
  };

  const handleThemeChange = (value: string) => {
    setThemeMode(value as "light" | "dark" | "system");
    persistPreference("theme_mode", value);
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

  const handleSaveAvatar = async () => {
    if (avatarType === "upload" && avatarFile) {
      try {
        await uploadAvatar(avatarFile);
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        setAvatarFile(null);
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview);
          setAvatarPreview(null);
        }
        toast.success("Avatar atualizado.");
      } catch {
        toast.error("Não foi possível enviar a foto. Tente novamente.");
      }
      return;
    }
    toast.success("Avatar atualizado.");
  };

  const avatarSrc =
    avatarPreview ??
    (me?.avatar_url
      ? me.avatar_url.startsWith("http")
        ? me.avatar_url
        : `${API_BASE_URL}${me.avatar_url}`
      : undefined);

  return (
    <SettingsAccountLayout
      pageTitle="Dados da conta"
      breadcrumbCurrent="Dados da conta"
    >
      <div className="space-y-8">
        <SettingsSection title="Dados da conta">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSaveProfile)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Seu nome"
                        className="h-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>ID do usuário</Label>
                <InputGroup>
                  <InputGroupInput
                    readOnly
                    value={me?.user_id ?? (meLoading ? "..." : "")}
                    className="bg-muted/50"
                    aria-readonly="true"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyUserId}
                      aria-label="Copiar ID do usuário"
                    >
                      <Copy className="size-4" />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <Button type="submit" disabled={meLoading}>
                Salvar
              </Button>
            </form>
          </Form>
        </SettingsSection>

        <SettingsSection title="Preferências">
          <div className="space-y-6">
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Tema</Label>
              <Select value={themeMode} onValueChange={handleThemeChange}>
                <SelectTrigger className="h-9 w-full @md/field-group:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-9 w-full @md/field-group:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Fuso horário</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="h-9 w-full @md/field-group:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-row items-center justify-between gap-4">
              <Label htmlFor="24h-clock">Usar relógio de 24 horas</Label>
              <Switch
                id="24h-clock"
                checked={use24hClock}
                onCheckedChange={setUse24hClock}
              />
            </div>
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Ordem do stack trace</Label>
              <Select value={stackTraceOrder} onValueChange={setStackTraceOrder}>
                <SelectTrigger className="h-9 w-full @md/field-group:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STACK_TRACE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Evento de issue padrão</Label>
              <Select value={defaultIssueEvent} onValueChange={setDefaultIssueEvent}>
                <SelectTrigger className="h-9 w-full @md/field-group:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_ISSUE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Avatar">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <Avatar className="size-20 shrink-0">
              <AvatarImage src={avatarSrc} alt={me?.name ?? ""} />
              <AvatarFallback className="text-lg">
                {getInitials(me?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col gap-4">
              <RadioGroup
                value={avatarType}
                onValueChange={(v) => setAvatarType(v as AvatarType)}
                aria-label="Avatar type"
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="initials" id="avatar-initials" />
                  <Label htmlFor="avatar-initials" className="font-normal cursor-pointer">
                    Usar iniciais
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="upload" id="avatar-upload" />
                  <Label htmlFor="avatar-upload" className="font-normal cursor-pointer">
                    Enviar foto
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="gravatar" id="avatar-gravatar" />
                  <Label htmlFor="avatar-gravatar" className="font-normal cursor-pointer">
                    Usar Gravatar
                  </Label>
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
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveAvatar}
                disabled={avatarType === "upload" && !avatarFile}
              >
                Salvar avatar
              </Button>
            </div>
          </div>
        </SettingsSection>
      </div>
    </SettingsAccountLayout>
  );
}
