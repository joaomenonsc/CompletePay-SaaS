import { redirect } from "next/navigation";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/agents/${id}/editor`);
}
