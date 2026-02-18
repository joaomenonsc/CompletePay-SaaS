"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChart3,
  Bell,
  Building2,
  CircleUser,
  Link2,
  Mail,
  Megaphone,
  Plug,
  Shield,
  ShieldCheck,
  Users,
  FolderKanban,
  FileText,
  Lock,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const ACCOUNT_NAV_ITEMS = [
  { title: "Dados da conta", href: "/dashboard/settings/account/details", icon: CircleUser },
  { title: "Identidades", href: "/dashboard/settings/account/identities", icon: Link2 },
  { title: "Endereços de e-mail", href: "/dashboard/settings/account/emails", icon: Mail },
  { title: "Notificações", href: "/dashboard/settings/account/notifications", icon: Bell },
  { title: "Assinaturas", href: "/dashboard/settings/account/subscriptions", icon: Megaphone },
  { title: "Segurança", href: "/dashboard/settings/account/security", icon: Shield },
] as const;

function orgHref(orgSlug: string, path: string) {
  return `/dashboard/settings/org/${encodeURIComponent(orgSlug)}${path}`;
}

const ORG_NAV_PATHS = [
  { title: "Configurações da organização", path: "/settings", icon: Building2 },
  { title: "Membros", path: "/members", icon: Users },
  { title: "Times", path: "/teams", icon: Users },
  { title: "Projetos", path: "/projects", icon: FolderKanban },
  { title: "Integrações", path: "/integrations", icon: Plug },
  { title: "Autenticação (SSO)", path: "/auth", icon: Lock },
  { title: "Registro de auditoria", path: "/audit-log", icon: FileText },
  { title: "Segurança e privacidade", path: "/security", icon: ShieldCheck },
  { title: "Uso e estatísticas", path: "/stats", icon: BarChart3 },
] as const;

interface SettingsNavProps {
  orgSlug?: string;
  orgDisplayName?: string;
}

export function SettingsNav({ orgSlug, orgDisplayName }: SettingsNavProps) {
  const pathname = usePathname();

  const renderLink = (
    href: string,
    title: string,
    Icon: React.ComponentType<{ className?: string }>,
    isActive: boolean,
  ) => (
    <Link
      key={href}
      href={href}
      prefetch={false}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{title}</span>
    </Link>
  );

  return (
    <nav aria-label="Settings navigation" className="flex shrink-0 flex-col gap-1">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:block md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max flex-col gap-0.5 py-2 md:py-0">
          <span className="text-muted-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-widest">
            Conta
          </span>
          {ACCOUNT_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return renderLink(item.href, item.title, item.icon, isActive);
          })}
          {orgSlug && (
            <>
              <Separator className="my-2" />
              <span className="text-muted-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-widest">
                {orgDisplayName ?? orgSlug}
              </span>
              {ORG_NAV_PATHS.map((item) => {
                const href = orgHref(orgSlug, item.path);
                const isActive = pathname === href;
                return renderLink(href, item.title, item.icon, isActive);
              })}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
