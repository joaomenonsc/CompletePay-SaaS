import { z } from "zod";

/** Schema zod para formulario de paciente (cadastro basico). */
export const patientFormSchema = z.object({
  full_name: z.string().min(3, "Nome completo deve ter pelo menos 3 caracteres"),
  social_name: z.string().optional(),
  birth_date: z.string().min(1, "Data de nascimento é obrigatória"),
  phone: z.string().min(8, "Telefone é obrigatório"),
  cpf: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  sex: z.enum(["M", "F", "I", "O"]).optional().nullable(),
  origin: z.string().optional(),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;
