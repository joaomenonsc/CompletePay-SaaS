import type { ReactNode } from "react";

import { WizardShell } from "./_components/wizard-shell";

export default function NovoAgenteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <WizardShell>{children}</WizardShell>
    </div>
  );
}
