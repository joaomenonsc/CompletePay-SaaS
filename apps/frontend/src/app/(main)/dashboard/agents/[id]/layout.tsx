import type { ReactNode } from "react";

import { AgentLayoutClient } from "./_components/agent-layout-client";

export default async function AgentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgentLayoutClient id={id}>{children}</AgentLayoutClient>;
}
