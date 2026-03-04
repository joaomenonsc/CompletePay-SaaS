"use client";

import Link from "next/link";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/api/auth";
import { APP_CONFIG } from "@/config/app-config";

const FormSchema = z.object({
    email: z.string().email({ message: "Digite um e-mail válido." }),
});

export default function EsqueciSenhaPage() {
    const [submitted, setSubmitted] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState("");

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: { email: "" },
    });

    const onSubmit = async (data: z.infer<typeof FormSchema>) => {
        try {
            const res = await forgotPassword(data.email);
            setSubmittedEmail(data.email);
            setSubmitted(true);
            toast.success(res.message);
        } catch (err: unknown) {
            const message =
                err && typeof err === "object" && "response" in err
                    ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : "Falha ao enviar. Tente novamente.";
            toast.error(message ?? "Falha ao enviar.");
        }
    };

    if (submitted) {
        return (
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                        <Mail className="size-7 text-primary" />
                    </div>
                    <h1 className="font-medium text-2xl">Verifique seu e-mail</h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Enviamos um link de redefinição de senha para{" "}
                        <span className="font-medium text-foreground">{submittedEmail}</span>.
                        <br />
                        Verifique sua caixa de entrada e spam.
                    </p>
                    <p className="text-muted-foreground/60 text-xs">O link expira em 30 minutos.</p>
                </div>
                <div className="flex flex-col gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSubmitted(false);
                            form.reset();
                        }}
                    >
                        Enviar para outro e-mail
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
        <>
            <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
                <div className="space-y-2 text-center">
                    <h1 className="font-medium text-3xl">Esqueci minha senha</h1>
                    <p className="text-muted-foreground text-sm">
                        Digite seu e-mail e enviaremos um link para redefinir sua senha.
                    </p>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>E-mail</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="forgot-email"
                                            type="email"
                                            placeholder="voce@exemplo.com"
                                            autoComplete="email"
                                            autoFocus
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Enviando…" : "Enviar link de redefinição"}
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

            <div className="absolute bottom-5 flex w-full justify-center px-10">
                <div className="text-sm text-muted-foreground">{APP_CONFIG.copyright}</div>
            </div>
        </>
    );
}
