"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { register as registerApi, resendConfirmation } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

const FormSchema = z
  .object({
    email: z.string().email({ message: "Digite um e-mail válido." }),
    password: z.string().min(8, { message: "A senha deve ter pelo menos 8 caracteres." }),
    confirmPassword: z.string().min(8, { message: "A confirmação da senha deve ter pelo menos 8 caracteres." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export function RegisterForm() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    try {
      const res = await registerApi({ email: data.email, password: data.password });
      setRegisteredEmail(res.email);
      toast.success(res.message);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : err instanceof Error
            ? err.message
            : "Falha ao criar conta.";
      toast.error(message ?? "Falha ao criar conta.");
    }
  };

  const onResend = async () => {
    if (!registeredEmail) return;
    setResending(true);
    try {
      const res = await resendConfirmation(registeredEmail);
      toast.success(res.message);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Falha ao reenviar.";
      toast.error(message ?? "Falha ao reenviar.");
    } finally {
      setResending(false);
    }
  };

  if (registeredEmail) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground text-sm">
          Enviamos um email de confirmação para <strong>{registeredEmail}</strong>. Acesse o link no email para
          ativar sua conta.
        </p>
        <p className="text-muted-foreground text-sm">Não recebeu? Verifique a pasta de spam.</p>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={onResend} disabled={resending}>
            {resending ? "Reenviando…" : "Reenviar email de confirmação"}
          </Button>
          <Button asChild variant="link" className="text-muted-foreground">
            <Link href="/auth/v2/login">Ir para o login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input id="email" type="email" placeholder="voce@exemplo.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input id="password" type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar senha</FormLabel>
              <FormControl>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Criando conta…" : "Cadastrar"}
        </Button>
      </form>
    </Form>
  );
}
