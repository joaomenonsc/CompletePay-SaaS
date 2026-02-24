"use client";

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
    // fallback só os comuns
  }
  return Array.from(set).sort();
}

const TIMEZONES = getTimezones();

export interface TimezoneSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function TimezoneSelector({
  value,
  onValueChange,
  className,
}: TimezoneSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Fuso horário" />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONES.map((tz) => (
          <SelectItem key={tz} value={tz}>
            {tz.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
