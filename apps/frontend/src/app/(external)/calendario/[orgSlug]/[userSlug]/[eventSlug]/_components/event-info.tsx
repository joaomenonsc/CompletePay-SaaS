"use client";

/**
 * Coluna esquerda da Tela 2: avatar, nome, título do evento, duração, tipo, fuso.
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 4.3
 */
import { Clock, Globe, Video } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COMMON_TIMEZONES = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "UTC",
];

function getTimezones(): string[] {
  const set = new Set(COMMON_TIMEZONES);
  try {
    const all = Intl.supportedValuesOf?.("timeZone");
    if (all) all.forEach((tz) => set.add(tz));
  } catch {
    // fallback
  }
  return Array.from(set).sort();
}

const TIMEZONES = getTimezones();

export interface EventInfoProps {
  hostName: string;
  avatarUrl: string | null;
  eventTitle: string;
  durationMinutes: number;
  locationLabel: string;
  timezone: string;
  onTimezoneChange: (value: string) => void;
}

export function EventInfo({
  hostName,
  avatarUrl,
  eventTitle,
  durationMinutes,
  locationLabel,
  timezone,
  onTimezoneChange,
}: EventInfoProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-8 border border-zinc-700">
          <AvatarImage src={avatarUrl ?? undefined} alt={hostName} />
          <AvatarFallback className="bg-zinc-700 text-xs text-zinc-200">
            {hostName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-zinc-400">{hostName}</span>
      </div>

      <h1 className="text-xl font-bold text-white">{eventTitle}</h1>

      <div className="flex flex-col gap-2 text-sm text-zinc-400">
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" />
          <span>{durationMinutes}m</span>
        </div>
        <div className="flex items-center gap-2">
          <Video className="size-4 shrink-0" />
          <span>{locationLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="size-4 shrink-0" />
          <Select value={timezone} onValueChange={onTimezoneChange}>
            <SelectTrigger className="h-auto w-auto gap-1 border-0 bg-transparent p-0 text-sm text-zinc-400 shadow-none focus:ring-0 [&>svg]:size-3 [&>svg]:text-zinc-500">
              <SelectValue placeholder="Fuso horário" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-800">
              {TIMEZONES.map((tz) => (
                <SelectItem
                  key={tz}
                  value={tz}
                  className="text-zinc-200 focus:bg-zinc-700 focus:text-white"
                >
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
