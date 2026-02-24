"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicProfile } from "@/lib/api/calendar-public";
import type { PublicProfile } from "@/types/calendar";

function ProfileContent({
  profile,
  orgSlug,
  userSlug,
}: {
  profile: PublicProfile;
  orgSlug: string;
  userSlug: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Avatar className="h-24 w-24">
          <AvatarImage
            src={profile.orgAvatarUrl ?? profile.avatarUrl ?? undefined}
            alt={profile.orgName}
          />
          <AvatarFallback className="text-2xl">
            {profile.orgName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{profile.orgName}</h1>
          <p className="text-muted-foreground text-sm">
            {profile.hostName}
          </p>
        </div>
        {profile.bio && (
          <p className="text-muted-foreground max-w-md text-sm">{profile.bio}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-5" />
            Tipos de evento
          </CardTitle>
          <CardDescription>Escolha um tipo para agendar</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {profile.eventTypes.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Nenhum tipo de evento disponível no momento.
            </p>
          ) : (
            profile.eventTypes.map((et) => (
              <Link
                key={et.slug}
                href={`/calendario/${encodeURIComponent(orgSlug)}/${encodeURIComponent(userSlug)}/${et.slug}`}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{et.title}</p>
                  {et.description && (
                    <p className="text-muted-foreground text-sm">{et.description}</p>
                  )}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {et.durationMinutes} min
                  </p>
                </div>
                <User className="text-muted-foreground size-5" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CalendarioHostPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const userSlug = params.userSlug as string;

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["calendar-public-profile", orgSlug, userSlug],
    queryFn: () => fetchPublicProfile(orgSlug, userSlug),
    enabled: Boolean(orgSlug && userSlug),
  });

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-destructive">Não foi possível carregar o perfil. Tente novamente.</p>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return <ProfileContent profile={profile} orgSlug={orgSlug} userSlug={userSlug} />;
}
