import {
  BarChart3,
  Building2,
  Calendar,
  CircleUser,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  HeartPulse,
  LayoutDashboard,
  Link2,
  type LucideIcon,
  Mail,
  MessageSquare,
  Send,
  Settings,
  Users,
  UserCog,
  Workflow,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Recursos",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        title: "Agentes",
        url: "/dashboard/chat",
        icon: MessageSquare,
      },
      {
        title: "Configurações",
        url: "/dashboard/settings",
        icon: Settings,
        subItems: [
          { title: "Minha Conta", url: "/dashboard/settings/account/details", icon: CircleUser },
          { title: "Organização", url: "/dashboard/settings/org", icon: Building2 },
        ],
      },
      {
        title: "Uso e Pagamento",
        url: "/dashboard/usage",
        icon: CreditCard,
      },
    ],
  },
  {
    id: 2,
    label: "Pages",
    items: [
      {
        title: "CRM Saúde",
        url: "/dashboard/crm-saude",
        icon: HeartPulse,
        isNew: true,
        subItems: [
          { title: "Dashboard", url: "/dashboard/crm-saude", icon: LayoutDashboard },
          { title: "Pacientes", url: "/dashboard/crm-saude/pacientes", icon: Users },
          { title: "Profissionais", url: "/dashboard/crm-saude/profissionais", icon: UserCog },
          { title: "Unidades", url: "/dashboard/crm-saude/unidades", icon: Building2 },
          { title: "Agendamentos", url: "/dashboard/crm-saude/agendamentos", icon: Calendar },
          { title: "Lista de espera", url: "/dashboard/crm-saude/lista-espera", icon: Clock },
          { title: "Atendimentos", url: "/dashboard/crm-saude/atendimentos", icon: ClipboardList },
          { title: "Financeiro", url: "/dashboard/crm-saude/financeiro", icon: DollarSign },
        ],
      },
      {
        title: "Email Marketing",
        url: "/dashboard/email-marketing",
        icon: Mail,
        isNew: true,
        subItems: [
          { title: "Dashboard", url: "/dashboard/email-marketing", icon: LayoutDashboard },
          { title: "Campanhas", url: "/dashboard/email-marketing/campanhas", icon: Send },
          { title: "Templates", url: "/dashboard/email-marketing/templates", icon: FileText },
          { title: "Listas", url: "/dashboard/email-marketing/listas", icon: Users },
          { title: "Domínios", url: "/dashboard/email-marketing/dominios", icon: Globe },
        ],
      },

      {
        title: "Calendário",
        url: "/dashboard/calendario",
        icon: Calendar,
        subItems: [
          { title: "Tipos de evento", url: "/dashboard/calendario/tipos-de-evento", icon: Link2 },
          { title: "Reservas", url: "/dashboard/calendario/reservas", icon: Calendar },
          { title: "Disponibilidade", url: "/dashboard/calendario/disponibilidade", icon: Clock },
          { title: "Workflows", url: "/dashboard/calendario/workflows", icon: Calendar },
          { title: "Insights", url: "/dashboard/calendario/insights", icon: BarChart3 },
        ],
      },
      {
        title: "Automações",
        url: "/dashboard/automations",
        icon: Workflow,
        isNew: true,
        subItems: [
          { title: "Dashboard", url: "/dashboard/automations", icon: LayoutDashboard },
          { title: "Workflows", url: "/dashboard/automations/workflows", icon: Workflow },
        ],
      },
    ],
  },
];
