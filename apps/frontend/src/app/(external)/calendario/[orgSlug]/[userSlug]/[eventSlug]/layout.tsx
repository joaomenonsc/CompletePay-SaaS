/**
 * Layout das páginas públicas de booking.
 * Força dark mode para o fundo escuro independente do tema do app.
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 2.5
 */
export default function PublicBookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark">
      <div className="min-h-screen bg-background">{children}</div>
    </div>
  );
}
