import { create } from "zustand";

// ── Block types ────────────────────────────────────────────────────────────────

export type BlockType =
    | "heading"
    | "subheading"
    | "text"
    | "list"
    | "image"
    | "button"
    | "divider"
    | "spacer"
    | "social"
    | "columns";

// ── Block content discriminated union ──────────────────────────────────────────

export interface HeadingContent {
    text: string;
    level: 1 | 2 | 3 | 4;
}

export interface SubheadingContent {
    text: string;
}

export interface TextContent {
    text: string;
}

export interface ListContent {
    items: string[];
    ordered: boolean;
}

export interface ImageContent {
    url: string;
    alt: string;
    width: string;
    linkUrl?: string;
}

export interface ButtonContent {
    text: string;
    url: string;
    buttonWidth: "auto" | "fixed" | "full";
    buttonWidthValue?: number;
}

export interface DividerContent {
    lineHeight: number;
    lineColor: string;
    lineStyle: "solid" | "dashed" | "dotted";
}

export interface SpacerContent {
    height: number;
}

export interface SocialContent {
    links: { platform: string; url: string }[];
    iconSize: number;
}

export interface ColumnsContent {
    columns: number;
    gap: number;
    children: Block[][];
}

export type BlockContent =
    | HeadingContent
    | SubheadingContent
    | TextContent
    | ListContent
    | ImageContent
    | ButtonContent
    | DividerContent
    | SpacerContent
    | SocialContent
    | ColumnsContent;

// ── Block style ────────────────────────────────────────────────────────────────

export interface BlockStyle {
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    marginTop: number;
    marginBottom: number;
    backgroundColor: string;
    textColor: string;
    textAlign: "left" | "center" | "right" | "justify";
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
    borderStyle: "none" | "solid" | "dashed" | "dotted";
    fontSize: number;
    fontWeight: number;
}

// ── Block ──────────────────────────────────────────────────────────────────────

export interface Block {
    id: string;
    type: BlockType;
    content: BlockContent;
    style: BlockStyle;
}

// ── State ──────────────────────────────────────────────────────────────────────

interface HistoryEntry {
    blocks: Block[];
    selectedBlockId: string | null;
}

interface EmailBuilderState {
    blocks: Block[];
    selectedBlockId: string | null;

    // History (undo / redo)
    past: HistoryEntry[];
    future: HistoryEntry[];

    // Actions
    addBlock: (type: BlockType, index?: number) => void;
    removeBlock: (id: string) => void;
    duplicateBlock: (id: string) => void;
    updateBlock: (id: string, updates: Partial<Block>) => void;
    updateBlockStyle: (id: string, styleUpdates: Partial<BlockStyle>) => void;
    updateBlockContent: (id: string, contentUpdates: Partial<BlockContent>) => void;
    moveBlock: (fromIndex: number, toIndex: number) => void;
    selectBlock: (id: string | null) => void;
    setBlocks: (blocks: Block[]) => void;
    undo: () => void;
    redo: () => void;
    // Column actions
    addBlockToColumn: (parentId: string, colIndex: number, type: BlockType, index?: number) => void;
    removeBlockFromColumn: (parentId: string, colIndex: number, blockId: string) => void;
    updateColumnChild: (parentId: string, colIndex: number, blockId: string, updates: Partial<Block>) => void;
    updateColumnChildStyle: (parentId: string, colIndex: number, blockId: string, styleUpdates: Partial<BlockStyle>) => void;
    updateColumnChildContent: (parentId: string, colIndex: number, blockId: string, contentUpdates: Partial<BlockContent>) => void;
}

// ── Default content per type ───────────────────────────────────────────────────

const getDefaultContentForType = (type: BlockType): BlockContent => {
    switch (type) {
        case "heading":
            return { text: "Novo Título", level: 2 } as HeadingContent;
        case "subheading":
            return { text: "Subtítulo aqui" } as SubheadingContent;
        case "text":
            return { text: "Comece a escrever seu texto aqui..." } as TextContent;
        case "list":
            return { items: ["Item 1", "Item 2", "Item 3"], ordered: false } as ListContent;
        case "button":
            return { text: "Clique Aqui", url: "#", buttonWidth: "auto" } as ButtonContent;
        case "image":
            return { url: "https://placehold.co/600x200/e2e8f0/94a3b8?text=Sua+Imagem", alt: "Imagem", width: "100%" } as ImageContent;
        case "divider":
            return { lineHeight: 1, lineColor: "#e2e8f0", lineStyle: "solid" } as DividerContent;
        case "spacer":
            return { height: 32 } as SpacerContent;
        case "social":
            return {
                links: [
                    { platform: "facebook", url: "https://facebook.com" },
                    { platform: "instagram", url: "https://instagram.com" },
                    { platform: "linkedin", url: "https://linkedin.com" },
                ],
                iconSize: 24,
            } as SocialContent;
        case "columns":
            return { columns: 2, gap: 16, children: [[], []] } as ColumnsContent;
        default:
            return { text: "" } as TextContent;
    }
};

const getDefaultStyleForType = (type: BlockType): BlockStyle => {
    const base: BlockStyle = {
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 16,
        marginTop: 0,
        marginBottom: 0,
        backgroundColor: "transparent",
        textColor: "#1a1a2e",
        textAlign: "left",
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "#e2e8f0",
        borderStyle: "none",
        fontSize: 16,
        fontWeight: 400,
    };

    switch (type) {
        case "heading":
            return { ...base, fontSize: 28, fontWeight: 700, paddingTop: 16, paddingBottom: 8 };
        case "subheading":
            return { ...base, fontSize: 20, fontWeight: 600, paddingTop: 12, paddingBottom: 6, textColor: "#475569" };
        case "text":
            return { ...base, fontSize: 16, fontWeight: 400 };
        case "button":
            return { ...base, textAlign: "center", paddingTop: 16, paddingBottom: 16 };
        case "image":
            return { ...base, textAlign: "center", paddingTop: 8, paddingBottom: 8 };
        case "divider":
            return { ...base, paddingTop: 8, paddingBottom: 8 };
        case "spacer":
            return { ...base, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };
        case "social":
            return { ...base, textAlign: "center" };
        default:
            return base;
    }
};

// ── Helper: push current state to history ──────────────────────────────────────

const MAX_HISTORY = 50;

const pushHistory = (state: EmailBuilderState): Pick<EmailBuilderState, "past" | "future"> => ({
    past: [...state.past.slice(-(MAX_HISTORY - 1)), { blocks: state.blocks, selectedBlockId: state.selectedBlockId }],
    future: [],
});

// ── Store ──────────────────────────────────────────────────────────────────────

export const useEmailBuilderStore = create<EmailBuilderState>((set, get) => ({
    blocks: [],
    selectedBlockId: null,
    past: [],
    future: [],

    addBlock: (type, index) => {
        const newBlock: Block = {
            id: crypto.randomUUID(),
            type,
            content: getDefaultContentForType(type),
            style: getDefaultStyleForType(type),
        };

        set((state) => {
            const history = pushHistory(state);
            const newBlocks = [...state.blocks];
            if (index !== undefined && index >= 0) {
                newBlocks.splice(index, 0, newBlock);
            } else {
                newBlocks.push(newBlock);
            }
            return { ...history, blocks: newBlocks, selectedBlockId: newBlock.id };
        });
    },

    removeBlock: (id) => {
        set((state) => {
            const history = pushHistory(state);
            return {
                ...history,
                blocks: state.blocks.filter((b) => b.id !== id),
                selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
            };
        });
    },

    duplicateBlock: (id) => {
        set((state) => {
            const history = pushHistory(state);
            const blockIndex = state.blocks.findIndex((b) => b.id === id);
            if (blockIndex === -1) return state;

            const original = state.blocks[blockIndex];
            const clone: Block = {
                ...structuredClone(original),
                id: crypto.randomUUID(),
            };

            const newBlocks = [...state.blocks];
            newBlocks.splice(blockIndex + 1, 0, clone);
            return { ...history, blocks: newBlocks, selectedBlockId: clone.id };
        });
    },

    updateBlock: (id, updates) => {
        set((state) => ({
            blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        }));
    },

    updateBlockStyle: (id, styleUpdates) => {
        set((state) => ({
            blocks: state.blocks.map((b) =>
                b.id === id ? { ...b, style: { ...b.style, ...styleUpdates } } : b
            ),
        }));
    },

    updateBlockContent: (id, contentUpdates) => {
        set((state) => ({
            blocks: state.blocks.map((b) =>
                b.id === id ? { ...b, content: { ...b.content, ...contentUpdates } } : b
            ),
        }));
    },

    moveBlock: (fromIndex, toIndex) => {
        set((state) => {
            const history = pushHistory(state);
            const newBlocks = [...state.blocks];
            const [movedBlock] = newBlocks.splice(fromIndex, 1);
            newBlocks.splice(toIndex, 0, movedBlock);
            return { ...history, blocks: newBlocks };
        });
    },

    selectBlock: (id) => {
        set({ selectedBlockId: id });
    },

    setBlocks: (blocks) => {
        set((state) => {
            const history = pushHistory(state);
            return { ...history, blocks };
        });
    },

    undo: () => {
        set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            return {
                past: state.past.slice(0, -1),
                future: [{ blocks: state.blocks, selectedBlockId: state.selectedBlockId }, ...state.future],
                blocks: previous.blocks,
                selectedBlockId: previous.selectedBlockId,
            };
        });
    },

    redo: () => {
        set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            return {
                past: [...state.past, { blocks: state.blocks, selectedBlockId: state.selectedBlockId }],
                future: state.future.slice(1),
                blocks: next.blocks,
                selectedBlockId: next.selectedBlockId,
            };
        });
    },

    // ── Column actions ─────────────────────────────────────────────────────

    addBlockToColumn: (parentId, colIndex, type, index) => {
        const newBlock: Block = {
            id: crypto.randomUUID(),
            type,
            content: getDefaultContentForType(type),
            style: getDefaultStyleForType(type),
        };

        set((state) => {
            const history = pushHistory(state);
            const blocks = state.blocks.map((b) => {
                if (b.id !== parentId || b.type !== "columns") return b;
                const content = b.content as ColumnsContent;
                const newChildren = content.children.map((col, ci) => {
                    if (ci !== colIndex) return col;
                    const updated = [...col];
                    if (index !== undefined && index >= 0) {
                        updated.splice(index, 0, newBlock);
                    } else {
                        updated.push(newBlock);
                    }
                    return updated;
                });
                return { ...b, content: { ...content, children: newChildren } };
            });
            return { ...history, blocks, selectedBlockId: newBlock.id };
        });
    },

    removeBlockFromColumn: (parentId, colIndex, blockId) => {
        set((state) => {
            const history = pushHistory(state);
            const blocks = state.blocks.map((b) => {
                if (b.id !== parentId || b.type !== "columns") return b;
                const content = b.content as ColumnsContent;
                const newChildren = content.children.map((col, ci) => {
                    if (ci !== colIndex) return col;
                    return col.filter((child) => child.id !== blockId);
                });
                return { ...b, content: { ...content, children: newChildren } };
            });
            return {
                ...history,
                blocks,
                selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
            };
        });
    },

    updateColumnChild: (parentId, colIndex, blockId, updates) => {
        set((state) => ({
            blocks: state.blocks.map((b) => {
                if (b.id !== parentId || b.type !== "columns") return b;
                const content = b.content as ColumnsContent;
                const newChildren = content.children.map((col, ci) => {
                    if (ci !== colIndex) return col;
                    return col.map((child) => (child.id === blockId ? { ...child, ...updates } : child));
                });
                return { ...b, content: { ...content, children: newChildren } };
            }),
        }));
    },

    updateColumnChildStyle: (parentId, colIndex, blockId, styleUpdates) => {
        set((state) => ({
            blocks: state.blocks.map((b) => {
                if (b.id !== parentId || b.type !== "columns") return b;
                const content = b.content as ColumnsContent;
                const newChildren = content.children.map((col, ci) => {
                    if (ci !== colIndex) return col;
                    return col.map((child) =>
                        child.id === blockId ? { ...child, style: { ...child.style, ...styleUpdates } } : child
                    );
                });
                return { ...b, content: { ...content, children: newChildren } };
            }),
        }));
    },

    updateColumnChildContent: (parentId, colIndex, blockId, contentUpdates) => {
        set((state) => ({
            blocks: state.blocks.map((b) => {
                if (b.id !== parentId || b.type !== "columns") return b;
                const content = b.content as ColumnsContent;
                const newChildren = content.children.map((col, ci) => {
                    if (ci !== colIndex) return col;
                    return col.map((child) =>
                        child.id === blockId
                            ? { ...child, content: { ...child.content, ...contentUpdates } }
                            : child
                    );
                });
                return { ...b, content: { ...content, children: newChildren } };
            }),
        }));
    },
}));
