"use client";

import { Calendar } from "lucide-react";

/**
 * Perfil da organização (página de entrada do calendário público).
 * O guia (Secao 3.1) prevê esta rota; a API pública expõe perfil por org + user.
 * Aqui orientamos o visitante a usar o link do host para agendar.
 */
export default function CalendarioOrgPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <Calendar className="text-muted-foreground size-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Agendamentos</h1>
        <p className="text-muted-foreground text-sm">
          Para agendar uma reunião ou atendimento, use o link que o seu host
          compartilhou com você. Esse link leva diretamente à página de
          agendamento com os horários disponíveis.
        </p>
      </div>
    </div>
  );
}
