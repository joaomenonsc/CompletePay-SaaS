"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMe } from "@/lib/api/auth";
import { fetchEventTypes } from "@/lib/api/calendar";
import { useCurrentOrg } from "@/app/(main)/dashboard/settings/_hooks/use-current-org";
import { EventTypeCard } from "./_components/event-type-card";

export default function TiposDeEventoPage() {
  const { orgSlug } = useCurrentOrg();
  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const { data: eventTypes, isLoading, error } = useQuery({
    queryKey: ["event-types"],
    queryFn: fetchEventTypes,
  });

  const publicCalendarUrl = useMemo(() => {
    if (typeof window === "undefined" || !orgSlug || !me?.user_id) return null;
    return `${window.location.origin}/calendario/${encodeURIComponent(orgSlug)}/${encodeURIComponent(me.user_id)}`;
  }, [orgSlug, me?.user_id]);

  const copyPublicLink = () => {
    if (!publicCalendarUrl) {
      toast.error("Link ainda não disponível");
      return;
    }
    navigator.clipboard.writeText(publicCalendarUrl);
    toast.success("Link copiado para a área de transferência");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tipos de evento</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os tipos de reunião ou atendimento que podem ser agendados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {publicCalendarUrl && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={publicCalendarUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 size-4" />
                  Ver página pública
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={copyPublicLink}>
                <Copy className="mr-2 size-4" />
                Copiar link de página pública
              </Button>
            </>
          )}
          <Button asChild>
            <Link href="/dashboard/calendario/tipos-de-evento/novo">
              <CalendarPlus className="mr-2 size-4" />
              Novo tipo
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm">Erro ao carregar tipos de evento.</p>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : eventTypes?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventTypes.map((et) => (
            <EventTypeCard key={et.id} eventType={et} />
          ))}
        </div>
      ) : (
        <div className="border-border bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-muted-foreground mb-4 text-sm">Nenhum tipo de evento ainda.</p>
          <Button asChild>
            <Link href="/dashboard/calendario/tipos-de-evento/novo">
              <CalendarPlus className="mr-2 size-4" />
              Criar primeiro tipo
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
