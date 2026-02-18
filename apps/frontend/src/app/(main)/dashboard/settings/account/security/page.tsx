"use client";

import { useState } from "react";

import { KeyRound, LogOut, Shield, Smartphone } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsAccountLayout } from "@/app/(main)/dashboard/settings/_components/settings-account-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres."),
    verifyPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.verifyPassword, {
    message: "As senhas não coincidem.",
    path: ["verifyPassword"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function SecurityPage() {
  const [revokeLoading, setRevokeLoading] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", verifyPassword: "" },
  });

  const onSubmit = (_data: ChangePasswordFormValues) => {
    // TODO: PUT /api/users/me/password
    toast.success("Senha alterada com sucesso.");
    form.reset();
  };

  const handleRevokeAll = () => {
    setRevokeLoading(true);
    // TODO: POST /api/users/me/sessions/revoke-all
    setTimeout(() => {
      setRevokeLoading(false);
      toast.success("Todas as sessões foram encerradas.");
    }, 500);
  };

  const handleAdd2FA = () => {
    toast.info("Esta funcionalidade estará disponível em breve.");
  };

  return (
    <SettingsAccountLayout
      pageTitle="Segurança"
      breadcrumbCurrent="Segurança"
    >
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="session-history">Histórico de sessões</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-8">
          <SettingsSection title="Senha">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="h-9"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="verifyPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="h-9"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  Alterar senha
                </Button>
              </form>
            </Form>
          </SettingsSection>

          <SettingsSection title="Sessões">
            <p className="text-muted-foreground mb-4 text-sm">
              Se você acredita que sua conta foi comprometida, encerre todas as
              sessões e altere sua senha.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <LogOut className="mr-2 size-4" />
                  Sair de todos os dispositivos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
<AlertDialogTitle>Encerrar todas as sessões?</AlertDialogTitle>
              <AlertDialogDescription>
                Você será deslogado neste dispositivo e em todos os outros.
                Será necessário fazer login novamente.
              </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRevokeAll}
                    disabled={revokeLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {revokeLoading ? "Encerrando…" : "Encerrar todas as sessões"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SettingsSection>

          <SettingsSection title="Autenticação de dois fatores">
            <p className="text-muted-foreground mb-4 text-sm">
              A autenticação de dois fatores adiciona uma camada extra de
              segurança à sua conta.
            </p>
            <p className="text-muted-foreground mb-4 text-xs font-medium">
              Status: Não habilitado
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-md border p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Smartphone className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">App autenticador</p>
                  <p className="text-muted-foreground text-sm">
                    Use um app como Google Authenticator ou Authy.
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={handleAdd2FA}>
                  Adicionar
                </Button>
              </div>
              <div className="flex items-start gap-4 rounded-md border p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <KeyRound className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Passkey / Biometria</p>
                  <p className="text-muted-foreground text-sm">
                    Use sua digital ou reconhecimento facial.
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={handleAdd2FA}>
                  Adicionar
                </Button>
              </div>
              <div className="flex items-start gap-4 rounded-md border p-4 opacity-75">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Shield className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Códigos de recuperação</p>
                  <p className="text-muted-foreground text-sm">
                    Códigos de uso único para recuperação de conta.
                  </p>
                  <span className="text-muted-foreground mt-1 inline-block text-xs">
                    requer 2FA
                  </span>
                </div>
                <Button type="button" variant="secondary" size="sm" disabled>
                  Adicionar
                </Button>
              </div>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="session-history">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground text-sm">
              O histórico de sessões estará disponível em breve.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </SettingsAccountLayout>
  );
}
