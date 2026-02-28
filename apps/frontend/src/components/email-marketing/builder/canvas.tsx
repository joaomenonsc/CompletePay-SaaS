"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Block, ColumnsContent, useEmailBuilderStore } from "@/stores/email-builder-store";
import { BlockRenderer } from "./block-renderer";
import { Trash2, Copy, GripVertical, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { CSSProperties } from "react";

// ── Inline block toolbar ───────────────────────────────────────────────────────

function BlockToolbar({ block, index, total }: { block: Block; index: number; total: number }) {
    const { removeBlock, duplicateBlock, moveBlock } = useEmailBuilderStore();

    return (
        <div
            className="absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background px-1 py-0.5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => index > 0 && moveBlock(index, index - 1)}
                disabled={index === 0}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                title="Mover para cima"
            >
                <ChevronUp className="size-3.5" />
            </button>
            <button
                type="button"
                onClick={() => index < total - 1 && moveBlock(index, index + 1)}
                disabled={index === total - 1}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                title="Mover para baixo"
            >
                <ChevronDown className="size-3.5" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <button
                type="button"
                onClick={() => duplicateBlock(block.id)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Duplicar bloco"
            >
                <Copy className="size-3.5" />
            </button>
            <button
                type="button"
                onClick={() => removeBlock(block.id)}
                className="flex size-7 items-center justify-center rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Remover bloco"
            >
                <Trash2 className="size-3.5" />
            </button>
        </div>
    );
}

// ── Droppable Column Cell ──────────────────────────────────────────────────────

function ColumnCell({ parentId, colIndex, children }: { parentId: string; colIndex: number; children: Block[] }) {
    const droppableId = `column-cell-${parentId}-${colIndex}`;
    const { setNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: {
            type: "ColumnCell",
            parentId,
            colIndex,
        },
    });

    const { selectedBlockId, selectBlock, removeBlockFromColumn } = useEmailBuilderStore();

    return (
        <div
            ref={setNodeRef}
            className={`min-h-[60px] rounded-md border-2 transition-all duration-200 ${isOver
                ? "border-primary bg-primary/5 border-solid"
                : children.length === 0
                    ? "border-dashed border-muted-foreground/20"
                    : "border-dashed border-transparent hover:border-muted-foreground/15"
                }`}
        >
            {children.length === 0 ? (
                <div className="flex h-full min-h-[60px] flex-col items-center justify-center gap-1">
                    <Plus className="size-4 text-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/40">
                        {isOver ? "Soltar aqui" : `Coluna ${colIndex + 1}`}
                    </span>
                </div>
            ) : (
                <div className="p-1.5">
                    {children.map((child) => {
                        const isChildSelected = selectedBlockId === child.id;
                        return (
                            <div
                                key={child.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    selectBlock(child.id);
                                }}
                                className={`group/child relative mb-1 cursor-pointer rounded transition-all ${isChildSelected
                                    ? "ring-2 ring-primary ring-offset-1"
                                    : "hover:ring-1 hover:ring-muted-foreground/20"
                                    }`}
                            >
                                <BlockRenderer block={child} />
                                {/* Delete button for child block */}
                                {isChildSelected && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeBlockFromColumn(parentId, colIndex, child.id);
                                        }}
                                        className="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm hover:bg-destructive/90"
                                        title="Remover"
                                    >
                                        <Trash2 className="size-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {/* Drop indicator at end of column */}
                    {isOver && (
                        <div className="mt-1 flex h-6 items-center justify-center rounded border border-dashed border-primary/50 bg-primary/5">
                            <span className="text-[10px] text-primary font-medium">Soltar aqui</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Interactive Columns Block ──────────────────────────────────────────────────

function ColumnsCanvasBlock({ block }: { block: Block }) {
    const content = block.content as ColumnsContent;
    const colCount = content.columns || 2;
    const children = content.children || [];

    const containerStyle: CSSProperties = {
        display: "grid",
        gridTemplateColumns: `repeat(${colCount}, 1fr)`,
        gap: `${content.gap || 16}px`,
        paddingTop: `${block.style.paddingTop}px`,
        paddingBottom: `${block.style.paddingBottom}px`,
        paddingLeft: `${block.style.paddingLeft}px`,
        paddingRight: `${block.style.paddingRight}px`,
        width: "100%",
    };

    return (
        <div style={containerStyle}>
            {Array.from({ length: colCount }).map((_, idx) => (
                <ColumnCell
                    key={idx}
                    parentId={block.id}
                    colIndex={idx}
                    children={children[idx] || []}
                />
            ))}
        </div>
    );
}

// ── Sortable block ─────────────────────────────────────────────────────────────

function SortableBlock({ block, index, total }: { block: Block; index: number; total: number }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: block.id,
        data: {
            type: "CanvasBlock",
            block,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const { selectedBlockId, selectBlock } = useEmailBuilderStore();
    const isSelected = selectedBlockId === block.id;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                selectBlock(block.id);
            }}
            className={`group relative mb-1 w-full cursor-pointer rounded-md transition-all duration-200 ${isSelected
                ? "ring-2 ring-primary ring-offset-2"
                : "hover:ring-1 hover:ring-muted-foreground/30"
                } ${isDragging ? "opacity-30 scale-[0.98]" : ""}`}
        >
            {/* Drag handle */}
            <div
                {...listeners}
                className={`absolute -left-8 top-1/2 -translate-y-1/2 flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground/40 transition-all active:cursor-grabbing ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
            >
                <GripVertical className="size-4" />
            </div>

            {/* Block toolbar — shown only when selected */}
            {isSelected && <BlockToolbar block={block} index={index} total={total} />}

            {/* Block content — use special renderer for columns */}
            <div className="relative w-full">
                {block.type === "columns" ? (
                    <ColumnsCanvasBlock block={block} />
                ) : (
                    <BlockRenderer block={block} />
                )}
            </div>
        </div>
    );
}

// ── Canvas ─────────────────────────────────────────────────────────────────────

export function Canvas() {
    const { blocks, selectBlock } = useEmailBuilderStore();
    const { setNodeRef, isOver } = useDroppable({
        id: "canvas-droppable",
    });

    return (
        <main
            className="flex-1 overflow-y-auto bg-muted/50 p-8"
            style={{
                backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
            }}
            onClick={() => selectBlock(null)}
        >
            <div className="mx-auto flex max-w-[620px] flex-col rounded-xl bg-card p-8 shadow-md ring-1 ring-border">
                {blocks.length === 0 ? (
                    <div
                        ref={setNodeRef}
                        className={`flex min-h-[350px] flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-300 ${isOver
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : "border-muted-foreground/20"
                            }`}
                    >
                        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            Arraste blocos da paleta para começar
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/60">
                            Ou clique em um bloco na paleta esquerda
                        </p>
                    </div>
                ) : (
                    <div
                        ref={setNodeRef}
                        className={`min-h-[350px] rounded-lg border-2 transition-all duration-300 ${isOver ? "border-primary bg-primary/5 border-dashed" : "border-transparent"
                            }`}
                    >
                        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                            {blocks.map((block, index) => (
                                <SortableBlock key={block.id} block={block} index={index} total={blocks.length} />
                            ))}
                        </SortableContext>

                        {/* Drop zone at the bottom */}
                        <div className={`mt-2 flex h-10 w-full items-center justify-center rounded-md border-2 border-dashed transition-all ${isOver ? "border-primary/40 bg-primary/5" : "border-transparent hover:border-muted-foreground/20"
                            }`}>
                            {isOver && (
                                <span className="text-xs text-primary font-medium">Soltar aqui</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
