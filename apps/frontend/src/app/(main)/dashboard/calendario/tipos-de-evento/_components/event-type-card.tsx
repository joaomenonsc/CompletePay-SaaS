"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  deleteEventType,
  toggleEventType,
} from "@/lib/api/calendar";
import type { EventType } from "@/types/calendar";
import { toast } from "sonner";

export interface EventTypeCardProps {
  eventType: EventType;
}

export function EventTypeCard({ eventType }: EventTypeCardProps) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => toggleEventType(eventType.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      toast.success(data.is_active ? "Tipo ativado" : "Tipo desativado");
    },
    onError: () => toast.error("Erro ao alterar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEventType(eventType.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      toast.success("Tipo de evento excluído");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="bg-muted rounded-md p-2"
            style={eventType.color ? { backgroundColor: `${eventType.color}20` } : undefined}
          >
            <Calendar className="text-muted-foreground size-4" />
          </div>
          <div>
            <p className="font-medium">{eventType.title}</p>
            <p className="text-muted-foreground text-xs">/{eventType.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={eventType.isActive}
            onCheckedChange={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/calendario/tipos-de-evento/${eventType.id}/editar`}>
                  <Pencil className="mr-2 size-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm("Excluir este tipo de evento?")) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 size-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {eventType.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{eventType.description}</p>
        )}
        <p className="text-muted-foreground mt-2 text-xs">{eventType.durationMinutes} min</p>
      </CardContent>
    </Card>
  );
}
