import { z } from "zod";

const CATEGORIES = [
  "MED",
  "ENF",
  "PSI",
  "FIS",
  "NUT",
  "DEN",
  "FAR",
  "FNO",
  "TER",
  "OUT",
] as const;
const COUNCILS = [
  "CRM",
  "COREN",
  "CRP",
  "CREFITO",
  "CRN",
  "CRO",
  "CRF",
  "CREFONO",
  "OUTRO",
] as const;

const STATUSES = ["ativo", "inativo", "ferias", "licenca"] as const;
const EMPLOYMENT_TYPES = ["CLT", "PJ", "autonomo", "parceiro"] as const;
const MODALITIES = ["presencial", "remoto", "hibrido"] as const;

function cpfDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

function cpfCheckDigitsValid(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (digits === digits[0].repeat(11)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(digits[i], 10) * (10 - i);
  const d1 = (s * 10) % 11 % 10;
  if (parseInt(digits[9], 10) !== d1) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(digits[i], 10) * (11 - i);
  const d2 = (s * 10) % 11 % 10;
  return parseInt(digits[10], 10) === d2;
}

const cpfOptional = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v || !v.trim()) return true;
      const d = cpfDigits(v);
      if (d.length !== 11) return false;
      return cpfCheckDigitsValid(d);
    },
    { message: "CPF inválido" }
  );

export const professionalFormSchema = z.object({
  full_name: z.string().min(3, "Nome completo deve ter pelo menos 3 caracteres"),
  social_name: z.string().optional(),
  cpf: cpfOptional,
  category: z.enum(CATEGORIES, {
    required_error: "Selecione a categoria profissional",
  }),
  council: z.enum(COUNCILS, {
    required_error: "Selecione o conselho",
  }),
  registration_number: z
    .string()
    .min(1, "Número de registro é obrigatório")
    .max(20),
  council_uf: z.string().length(2, "UF deve ter 2 caracteres"),
  rqe: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  city: z.string().optional(),
  uf: z.string().max(2).optional(),
  status: z.enum(STATUSES).optional(),
  user_id: z.string().max(36).optional().nullable(),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional().nullable(),
  modality: z.enum(MODALITIES).optional().nullable(),
  unit_ids: z.array(z.string()).optional().default([]),
});

export const professionalEditFormSchema = professionalFormSchema.extend({
  status: z.enum(STATUSES, {
    required_error: "Selecione o status",
  }),
});

export type ProfessionalFormValues = z.infer<typeof professionalFormSchema>;
export type ProfessionalEditFormValues = z.infer<typeof professionalEditFormSchema>;
