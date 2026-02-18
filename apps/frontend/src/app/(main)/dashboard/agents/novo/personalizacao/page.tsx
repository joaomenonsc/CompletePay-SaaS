"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ToneOfVoice } from "@/store/wizard-store";
import { useWizardStore } from "@/store/wizard-store";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  description: z.string().optional(),
  model: z.string().min(1, "Selecione um modelo."),
  tone: z.enum(["formal", "profissional", "casual", "tecnico"]),
  welcomeMessage: z.string().optional(),
  systemInstructions: z.string().min(10, "Instruções com pelo menos 10 caracteres."),
});

type FormValues = z.infer<typeof schema>;

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
];

const TONE_OPTIONS: { value: ToneOfVoice; label: string; desc: string }[] = [
  {
    value: "formal",
    label: "Formal",
    desc: 'Linguagem corporativa, tratamento por "senhor"',
  },
  {
    value: "profissional",
    label: "Profissional",
    desc: "Equilibrado, cordial sem ser informal",
  },
  {
    value: "casual",
    label: "Casual",
    desc: "Descontraído, amigável, usa giros e emoticons",
  },
  {
    value: "tecnico",
    label: "Técnico",
    desc: "Preciso, usa terminologia técnica",
  },
];

const DEFAULT_WELCOME = "Olá! Sou o assistente virtual da {{company_name}}. Como posso ajudar?";
const DEFAULT_INSTRUCTIONS = `- Você é o atendente virtual da {{company_name}}.
- Responda de forma clara e objetiva.
- Se não souber a resposta, consulte a knowledge base.
- Nunca invente informações.
- Sempre ofereça a opção de falar com um humano.`;

export default function WizardPersonalizacaoPage() {
  const router = useRouter();
  const { draft, setPersonalization } = useWizardStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: draft.name || "Atendente Virtual",
      description: draft.description || "",
      model: draft.model || "",
      tone: draft.tone || "profissional",
      welcomeMessage: draft.welcomeMessage || DEFAULT_WELCOME,
      systemInstructions: draft.systemInstructions || DEFAULT_INSTRUCTIONS,
    },
  });

  const onSubmit = (data: FormValues) => {
    setPersonalization({
      name: data.name,
      description: data.description,
      model: data.model,
      tone: data.tone,
      welcomeMessage: data.welcomeMessage,
      systemInstructions: data.systemInstructions,
    });
    router.push("/dashboard/agents/novo/review");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Personalize seu agente</h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Agente *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Atendente Virtual" {...field} />
                </FormControl>
                <FormDescription>O nome que identifica o agente no seu dashboard</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <FormLabel>Avatar</FormLabel>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="size-10 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm">
                  <Upload className="size-4" />
                  Fazer upload
                </Button>
                <Button type="button" variant="ghost" size="sm">
                  Usar padrão
                </Button>
              </div>
            </div>
            <FormDescription className="mt-1">Formatos: PNG, JPG. Max 2MB.</FormDescription>
          </div>

          <FormField
            control={form.control}
            name="tone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tom de Voz *</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="grid gap-3">
                    {TONE_OPTIONS.map((opt) => (
                      <div key={opt.value} className="flex items-start space-x-3 rounded-md border p-3">
                        <RadioGroupItem value={opt.value} id={opt.value} />
                        <label htmlFor={opt.value} className="cursor-pointer text-sm leading-none">
                          <span className="font-medium">{opt.label}</span>
                          <span className="mt-0.5 block text-muted-foreground">{opt.desc}</span>
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="welcomeMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mensagem de Boas-Vindas</FormLabel>
                <FormControl>
                  <Textarea placeholder={DEFAULT_WELCOME} className="min-h-20 resize-y" {...field} />
                </FormControl>
                <FormDescription>Use {"{{company_name}}"} para inserir o nome da empresa</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="systemInstructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instruções Iniciais</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={DEFAULT_INSTRUCTIONS}
                    className="min-h-40 resize-y font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Pré-preenchido pelo template. Edite conforme necessário.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo de IA</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 border-t pt-6">
            <Button type="button" variant="outline" asChild>
              <Link prefetch={false} href="/dashboard/agents/novo/template">
                Voltar
              </Link>
            </Button>
            <Button type="submit">Próximo →</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
