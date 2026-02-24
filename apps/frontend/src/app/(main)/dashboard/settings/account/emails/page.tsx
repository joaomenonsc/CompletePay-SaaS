"use client";

import { useState } from "react";

import { Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SettingsAccountLayout } from "@/app/(main)/dashboard/settings/_components/settings-account-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { getMe } from "@/lib/api/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import Link from "next/link";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

const addEmailSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

type AddEmailFormValues = z.infer<typeof addEmailSchema>;

export default function EmailsPage() {
  const [secondaryEmails] = useState<string[]>([]);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  const form = useForm<AddEmailFormValues>({
    resolver: zodResolver(addEmailSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: AddEmailFormValues) => {
    // TODO: POST /api/users/me/emails
    toast.success(`E-mail de verificação enviado para ${data.email}`);
    form.reset();
  };

  return (
    <SettingsAccountLayout
      pageTitle="Endereços de e-mail"
      breadcrumbCurrent="E-mails"
    >
      <div className="space-y-8">
        <SettingsSection title="Endereços de e-mail">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">
              {meLoading ? "..." : me?.email ?? "—"}
            </span>
            <Badge variant="secondary">Principal</Badge>
          </div>
        </SettingsSection>

        <SettingsSection title="Adicionar e-mails secundários">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <InputGroup>
                        <InputGroupInput
                          type="email"
                          placeholder="email@domain.com"
                          className="h-9"
                          {...field}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            type="submit"
                            size="sm"
                            disabled={form.formState.isSubmitting}
                          >
                            Adicionar
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </SettingsSection>

        <Alert>
          <Info className="size-4" />
          <AlertTitle>Emails secundários</AlertTitle>
          <AlertDescription>
            São usados para recuperação de conta e preferências de notificação.
            Não concedem acesso de login. Gerencie notificações em{" "}
            <Link
              href="/dashboard/settings/account/notifications"
              className="font-medium underline underline-offset-4 hover:text-primary"
            >
              Notificações
            </Link>
            .
          </AlertDescription>
        </Alert>

        {secondaryEmails.length > 0 && (
          <SettingsSection title="E-mails secundários">
            <ul className="space-y-2">
              {secondaryEmails.map((email) => (
                <li
                  key={email}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  {email}
                  <Button type="button" variant="ghost" size="sm">
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          </SettingsSection>
        )}
      </div>
    </SettingsAccountLayout>
  );
}
