"use client";

import * as React from "react";

import type { Row } from "@tanstack/react-table";

import type { ConversationRow } from "./columns";

type Handlers = {
  onOpenDetail: (row: Row<ConversationRow>) => void;
  onExportCsv: (row: Row<ConversationRow>) => void;
};

const ConversationActionsContext = React.createContext<Handlers | null>(null);

export function ConversationActionsProvider({
  children,
  onOpenDetail,
  onExportCsv,
}: {
  children: React.ReactNode;
  onOpenDetail: (row: Row<ConversationRow>) => void;
  onExportCsv: (row: Row<ConversationRow>) => void;
}) {
  const value = React.useMemo(() => ({ onOpenDetail, onExportCsv }), [onOpenDetail, onExportCsv]);
  return <ConversationActionsContext.Provider value={value}>{children}</ConversationActionsContext.Provider>;
}

export function useConversationActions() {
  return React.useContext(ConversationActionsContext);
}
