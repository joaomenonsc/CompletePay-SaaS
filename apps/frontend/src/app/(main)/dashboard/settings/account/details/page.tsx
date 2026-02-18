"use client";

import { useState } from "react";

import { Copy } from "lucide-react";

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
import { rootUser } from "@/data/users";
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

export default function AccountDetailsPage() {
  const [avatarType, setAvatarType] = useState<AvatarType>("initials");
  const [language, setLanguage] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [use24hClock, setUse24hClock] = useState(false);
  const [stackTraceOrder, setStackTraceOrder] = useState("most_recent");
  const [defaultIssueEvent, setDefaultIssueEvent] = useState("recommended");

  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: {
      name: rootUser.name,
    },
  });

  const handleCopyUserId = () => {
    void navigator.clipboard.writeText(rootUser.id);
    toast.success("User ID copiado.");
  };

  const handleSaveProfile = (data: AccountDetailsFormValues) => {
    // TODO: PUT /api/users/me
    toast.success("Conta atualizada.");
  };

  const handleThemeChange = (value: string) => {
    setThemeMode(value as "light" | "dark" | "system");
    persistPreference("theme_mode", value);
  };

  const handleSaveAvatar = () => {
    // TODO: persist avatar_type via API
    toast.success("Avatar atualizado.");
  };

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
                    value={rootUser.id}
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
              <Button type="submit">Salvar</Button>
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
              <AvatarImage src={rootUser.avatar || undefined} alt={rootUser.name} />
              <AvatarFallback className="text-lg">{getInitials(rootUser.name)}</AvatarFallback>
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
              <Button type="button" variant="secondary" onClick={handleSaveAvatar}>
                Salvar avatar
              </Button>
            </div>
          </div>
        </SettingsSection>
      </div>
    </SettingsAccountLayout>
  );
}
