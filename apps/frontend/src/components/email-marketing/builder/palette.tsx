"use client";

import { useDraggable } from "@dnd-kit/core";
import { BlockType } from "@/stores/email-builder-store";
import {
    Heading2,
    Heading3,
    Type,
    Image as ImageIcon,
    Link as ButtonIcon,
    Minus,
    List,
    MoveVertical,
    Share2,
    Columns2,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { useState } from "react";

// ── Block categories ───────────────────────────────────────────────────────────

interface BlockItem {
    type: BlockType;
    label: string;
    description: string;
    icon: any;
}

interface BlockCategory {
    name: string;
    blocks: BlockItem[];
}

const BLOCK_CATEGORIES: BlockCategory[] = [
    {
        name: "Conteúdo",
        blocks: [
            { type: "heading", label: "Título", description: "Cabeçalho principal", icon: Heading2 },
            { type: "subheading", label: "Subtítulo", description: "Cabeçalho secundário", icon: Heading3 },
            { type: "text", label: "Texto", description: "Parágrafo de texto", icon: Type },
            { type: "list", label: "Lista", description: "Lista de itens", icon: List },
        ],
    },
    {
        name: "Mídia & Ação",
        blocks: [
            { type: "image", label: "Imagem", description: "Foto ou banner", icon: ImageIcon },
            { type: "button", label: "Botão", description: "Call-to-action", icon: ButtonIcon },
            { type: "social", label: "Redes Sociais", description: "Ícones sociais", icon: Share2 },
        ],
    },
    {
        name: "Layout",
        blocks: [
            { type: "divider", label: "Divisor", description: "Linha separadora", icon: Minus },
            { type: "spacer", label: "Espaçador", description: "Espaço em branco", icon: MoveVertical },
            { type: "columns", label: "Colunas", description: "Layout em colunas", icon: Columns2 },
        ],
    },
];

// ── Draggable block card ───────────────────────────────────────────────────────

function DraggableBlock({ type, label, description, icon: Icon }: BlockItem) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `palette-${type}`,
        data: {
            type: "PaletteItem",
            blockType: type,
        },
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            suppressHydrationWarning
            className={`group flex cursor-grab items-center gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:cursor-grabbing ${isDragging ? "opacity-40 scale-95" : ""
                }`}
        >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{label}</span>
                <span className="block text-[11px] text-muted-foreground leading-tight">{description}</span>
            </div>
        </div>
    );
}

// ── Collapsible category ───────────────────────────────────────────────────────

function CategorySection({ category }: { category: BlockCategory }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="mb-3">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-1.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
                {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                {category.name}
            </button>
            {open && (
                <div className="mt-1.5 grid gap-2">
                    {category.blocks.map((block) => (
                        <DraggableBlock key={block.type} {...block} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Palette sidebar ────────────────────────────────────────────────────────────

export function Palette() {
    return (
        <aside className="w-[260px] shrink-0 overflow-y-auto border-r bg-muted/20 p-4">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Blocos
            </h3>
            {BLOCK_CATEGORIES.map((category) => (
                <CategorySection key={category.name} category={category} />
            ))}
        </aside>
    );
}
