"use client";

import { useState } from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UsageLayoutClient } from "../_components/usage-layout-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const redeemCodeSchema = z.object({
  code: z
    .string()
    .min(1, "O código promocional é obrigatório")
    .transform((s) => s.trim())
    .refine((s) => s.length >= 1, "O código promocional é obrigatório"),
});

type RedeemCodeFormValues = z.infer<typeof redeemCodeSchema>;

/** Mock: codes starting with SENTRY- (case-insensitive) are valid. */
function isValidPromoCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith("SENTRY-");
}

export default function RedeemCodePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RedeemCodeFormValues>({
    resolver: zodResolver(redeemCodeSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (data: RedeemCodeFormValues) => {
    const code = data.code.trim();
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    try {
      if (isValidPromoCode(code)) {
        toast.success("Código aplicado com sucesso", {
          description: "Seu código promocional foi resgatado.",
        });
        form.reset({ code: "" });
      } else {
        toast.error("Código promocional inválido", {
          description: "O código informado não é válido ou expirou.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <UsageLayoutClient
      pageTitle="Resgatar código promocional"
      breadcrumbCurrent="Resgatar código promocional"
    >
      <Card>
        <CardHeader>
          <CardTitle className="uppercase tracking-wide">Resgatar código promocional</CardTitle>
          <CardDescription>
            Recebeu um código promocional? Digite aqui para aplicar crédito à sua organização.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Código promocional <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Digite seu código promocional"
                        className="h-10"
                        autoComplete="off"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Resgatando...
                  </>
                ) : (
                  "Resgatar"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </UsageLayoutClient>
  );
}
