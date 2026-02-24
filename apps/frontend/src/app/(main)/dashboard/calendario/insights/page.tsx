"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchInsights } from "@/lib/api/calendar";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function InsightsPage() {
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ["calendar-insights"],
    queryFn: fetchInsights,
  });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-destructive text-sm">Erro ao carregar insights.</p>
      </div>
    );
  }

  const byEventType = insights?.bookingsByEventType ?? [];
  const byWeekday = (insights?.bookingsByWeekday ?? []).map((d) => ({
    ...d,
    label: WEEKDAY_LABELS[d.day] ?? `D${d.day}`,
  }));
  const topHours = insights?.topHours ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-muted-foreground text-sm">
          Métricas e gráficos dos últimos 90 dias.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : insights ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Total de reservas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{insights.totalBookings}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Taxa de cancelamento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {(insights.cancellationRate * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Taxa de no-show</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {(insights.noShowRate * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5" />
                Reservas por tipo de evento
              </CardTitle>
              <CardDescription>Quantidade de agendamentos por tipo</CardDescription>
            </CardHeader>
            <CardContent>
              {byEventType.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byEventType} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis
                      dataKey="title"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Nenhum dado no período.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reservas por dia da semana</CardTitle>
              <CardDescription>Segunda a domingo (últimos 90 dias)</CardDescription>
            </CardHeader>
            <CardContent>
              {byWeekday.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byWeekday} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
                      {byWeekday.map((_, i) => (
                        <Cell key={i} fill={`var(--chart-${(i % 2) + 2})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Nenhum dado no período.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Horários mais usados</CardTitle>
              <CardDescription>Reservas por hora do dia (0–23)</CardDescription>
            </CardHeader>
            <CardContent>
              {topHours.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topHours} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(h) => `${h}h`}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [v, "Reservas"]} labelFormatter={(h) => `${h}h`} />
                    <Bar dataKey="count" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Nenhum dado no período.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
