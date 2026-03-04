"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/lib/api/auth";
import { APP_CONFIG } from "@/config/app-config";

const FormSchema = z
    .object({
        password: z.string().min(8, { message: "A senha deve ter pelo menos 8 caracteres." }),
        confirmPassword: z.string().min(1, { message: "Confirme sua senha." }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "As senhas não coincidem.",
        path: ["confirmPassword"],
    });

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";
    const [status, setStatus] = useState<"form" | "success" | "error">(token ? "form" : "error");
    const [errorMessage, setErrorMessage] = useState(
        !token ? "Link inválido. Solicite um novo email de redefinição." : ""
    );

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: { password: "", confirmPassword: "" },
    });

    const onSubmit = async (data: z.infer<typeof FormSchema>) => {
        try {
            const res = await resetPassword(token, data.password);
            setStatus("success");
            toast.success(res.message);
            setTimeout(() => router.push("/auth/v2/login"), 3000);
        } catch (err: unknown) {
            const detail =
                err && typeof err === "object" && "response" in err
                    ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : null;
            setStatus("error");
            setErrorMessage(
                typeof detail === "string" ? detail : "Link inválido ou expirado. Solicite um novo email de redefinição."
            );
            toast.error(detail ?? "Falha ao redefinir senha.");
        }
    };

    if (status === "success") {
        return (
            <div className="mx-auto flex w-full flex-col items-center justify-center gap-6 sm:w-[400px]">
                <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
                    <CheckCircle2 className="size-7 text-green-500" />
                </div>
                <div className="space-y-2 text-center">
                    <h1 className="font-medium text-2xl">Senha redefinida!</h1>
                    <p className="text-muted-foreground text-sm">
                        Sua senha foi alterada com sucesso. Todas as sessões anteriores foram encerradas.
                        <br />
                        Redirecionando para o login…
                    </p>
                </div>
                <Button asChild>
                    <Link href="/auth/v2/login">Fazer login agora</Link>
                </Button>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="mx-auto flex w-full flex-col items-center justify-center gap-6 sm:w-[400px]">
                <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
                    <ShieldAlert className="size-7 text-destructive" />
                </div>
                <div className="space-y-2 text-center">
                    <h1 className="font-medium text-2xl">Link inválido</h1>
                    <p className="text-muted-foreground text-sm">{errorMessage}</p>
                </div>
                <div className="flex flex-col gap-2">
                    <Button asChild>
                        <Link href="/auth/v2/esqueci-senha">Solicitar novo link</Link>
                    </Button>
                    <Button asChild variant="ghost" className="text-muted-foreground">
                        <Link href="/auth/v2/login">
                            <ArrowLeft className="mr-1.5 size-4" />
                            Voltar para o login
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
            <div className="space-y-2 text-center">
                <h1 className="font-medium text-3xl">Nova senha</h1>
                <p className="text-muted-foreground text-sm">Escolha uma nova senha para sua conta.</p>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nova senha</FormLabel>
                                <FormControl>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="••••••••"
                                        autoComplete="new-password"
                                        autoFocus
                                        {...field}
                                    />
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
                                        id="confirm-password"
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
                        {form.formState.isSubmitting ? "Redefinindo…" : "Redefinir senha"}
                    </Button>
                </form>
            </Form>
            <div className="text-center">
                <Button asChild variant="link" className="text-muted-foreground text-sm">
                    <Link href="/auth/v2/login">
                        <ArrowLeft className="mr-1 size-3.5" />
                        Voltar para o login
                    </Link>
                </Button>
            </div>
        </div>
    );
}

export default function RedefinirSenhaPage() {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
            <Suspense
                fallback={
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
                        <h1 className="font-medium text-xl">Carregando…</h1>
                    </div>
                }
            >
                <ResetPasswordContent />
            </Suspense>

            <div className="absolute bottom-5 flex w-full justify-center px-10">
                <div className="text-sm text-muted-foreground">{APP_CONFIG.copyright}</div>
            </div>
        </div>
    );
}
