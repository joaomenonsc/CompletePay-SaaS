"use client";

import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Palette } from "./builder/palette";
import { Canvas } from "./builder/canvas";
import { PropertiesPanel } from "./builder/properties-panel";
import { BlockType, useEmailBuilderStore, Block } from "@/stores/email-builder-store";
import { generateHtmlFromBlocks, deserializeBlocks } from "./builder/utils";
import { BlockRenderer } from "./builder/block-renderer";
import { Undo2, Redo2 } from "lucide-react";

interface EmailEditorProps {
    /** JSON string of blocks (from API), or HTML string for legacy */
    content?: string;
    onChange?: (html: string, json: string) => void;
    placeholder?: string;
    editable?: boolean;
    className?: string;
}

export function EmailEditor({ content, onChange, editable = true, className = "" }: EmailEditorProps) {
    const { blocks, addBlock, moveBlock, selectBlock, setBlocks, undo, redo, past, future, addBlockToColumn } = useEmailBuilderStore();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activePaletteType, setActivePaletteType] = useState<BlockType | null>(null);
    const [initialized, setInitialized] = useState(false);

    // Initialize blocks from saved content (JSON)
    useEffect(() => {
        if (content && !initialized) {
            try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setBlocks(parsed);
                }
            } catch {
                // Legacy HTML content — ignore, start fresh
            }
            setInitialized(true);
        }
    }, [content, initialized, setBlocks]);

    // Notify parent when blocks change
    useEffect(() => {
        if (onChange && blocks.length > 0) {
            onChange(generateHtmlFromBlocks(blocks), JSON.stringify(blocks));
        }
    }, [blocks, onChange]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);

        if (active.data.current?.type === "PaletteItem") {
            setActivePaletteType(active.data.current.blockType as BlockType);
        } else {
            setActivePaletteType(null);
            selectBlock(active.id as string);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActivePaletteType(null);

        if (!over) return;

        // Dropping from Palette to Canvas
        if (active.data.current?.type === "PaletteItem") {
            const blockType = active.data.current.blockType as BlockType;

            // Dropping into a column cell
            if (over.data.current?.type === "ColumnCell") {
                const parentId = over.data.current.parentId as string;
                const colIndex = over.data.current.colIndex as number;
                addBlockToColumn(parentId, colIndex, blockType);
                return;
            }

            if (over.id === "canvas-droppable") {
                addBlock(blockType);
            } else if (over.data.current?.type === "CanvasBlock") {
                const overIndex = blocks.findIndex((b) => b.id === over.id);
                const insertIndex = overIndex >= 0 ? overIndex + 1 : blocks.length;
                addBlock(blockType, insertIndex);
            }
            return;
        }

        // Reordering inside Canvas
        if (active.id !== over.id) {
            const oldIndex = blocks.findIndex((item) => item.id === active.id);
            const newIndex = blocks.findIndex((item) => item.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                moveBlock(oldIndex, newIndex);
            }
        }
    };

    if (!editable) {
        return (
            <div className={`p-4 ${className}`} dangerouslySetInnerHTML={{ __html: content || "" }} />
        );
    }

    const activeBlock = activeId && blocks.find(b => b.id === activeId);

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className={`flex h-full w-full overflow-hidden rounded-xl border bg-background text-foreground shadow-sm ${className}`}>
                <Palette />

                <div className="flex flex-1 flex-col">
                    {/* Undo/Redo toolbar */}
                    <div className="flex items-center gap-1 border-b bg-muted/20 px-4 py-1.5">
                        <button
                            type="button"
                            onClick={undo}
                            disabled={past.length === 0}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                            title="Desfazer (Ctrl+Z)"
                        >
                            <Undo2 className="size-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={redo}
                            disabled={future.length === 0}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                            title="Refazer (Ctrl+Shift+Z)"
                        >
                            <Redo2 className="size-3.5" />
                        </button>
                        <span className="ml-2 text-[11px] text-muted-foreground">
                            {blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}
                        </span>
                    </div>

                    <Canvas />
                </div>

                <PropertiesPanel />
            </div>

            <DragOverlay>
                {activePaletteType ? (
                    <div className="flex w-52 cursor-grabbing items-center gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-xl">
                        <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </div>
                        <span className="text-sm font-medium capitalize">{activePaletteType}</span>
                    </div>
                ) : activeBlock ? (
                    <div className="pointer-events-none w-full max-w-[500px] rounded-md border-2 border-primary bg-background shadow-2xl opacity-90">
                        <BlockRenderer block={activeBlock} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// Keep backwards-compatible exports
export function useEmailEditor() {
    return { editor: null, insertVariable: (char: string) => { } };
}

export function EditorToolbar() {
    return null;
}
