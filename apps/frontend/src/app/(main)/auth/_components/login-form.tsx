"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { login, resendConfirmation } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

const FormSchema = z.object({
  email: z.string().email({ message: "Digite um e-mail válido." }),
  password: z.string().min(8, { message: "A senha deve ter pelo menos 8 caracteres." }),
  remember: z.boolean().optional(),
});

export function LoginForm() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setNeedsConfirmation(false);
    try {
      const res = await login({ email: data.email, password: data.password });
      setToken(res.access_token);
      toast.success("Login realizado.");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : err instanceof Error
            ? err.message
            : "Falha ao fazer login.";
      if (status === 403 && typeof message === "string" && message.toLowerCase().includes("confirme seu email")) {
        setNeedsConfirmation(true);
      }
      toast.error(message ?? "Falha ao fazer login.");
    }
  };

  const onResendConfirmation = async () => {
    const email = form.getValues("email");
    if (!email) return;
    setResending(true);
    try {
      const res = await resendConfirmation(email);
      toast.success(res.message);
      setNeedsConfirmation(false);
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
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Link
            href="/auth/v2/esqueci-senha"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Esqueci minha senha
          </Link>
        </div>
        <FormField
          control={form.control}
          name="remember"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center">
              <FormControl>
                <Checkbox
                  id="login-remember"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="size-4"
                />
              </FormControl>
              <FormLabel htmlFor="login-remember" className="ml-1 font-medium text-muted-foreground text-sm">
                Lembrar de mim por 30 dias
              </FormLabel>
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
        {needsConfirmation && (
          <Button
            type="button"
            variant="link"
            className="text-muted-foreground text-sm"
            onClick={onResendConfirmation}
            disabled={resending}
          >
            {resending ? "Reenviando…" : "Reenviar email de confirmação"}
          </Button>
        )}
      </form>
    </Form>
  );
}
