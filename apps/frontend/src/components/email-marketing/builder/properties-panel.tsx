"use client";

import { useEmailBuilderStore, Block, BlockStyle } from "@/stores/email-builder-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState, ReactNode } from "react";

// ── Color presets ──────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
    "#000000", "#1a1a2e", "#16213e", "#0f3460", "#2563eb",
    "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#d97706",
    "#16a34a", "#0d9488", "#ffffff", "#f8fafc", "#f1f5f9",
    "#e2e8f0",
];

// ── Collapsible section ────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-border/50 pb-3">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
                {title}
                {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
            {open && <div className="mt-1 flex flex-col gap-3">{children}</div>}
        </div>
    );
}

// ── Color picker with presets ──────────────────────────────────────────────────

function ColorPickerField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-xs">{label}</Label>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0"
                    value={value === "transparent" ? "#ffffff" : value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <Input
                    className="h-8 flex-1 text-xs"
                    value={value || ""}
                    placeholder="transparent"
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
            <div className="flex flex-wrap gap-1">
                {COLOR_PRESETS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => onChange(color)}
                        className={`size-5 rounded-sm border transition-all hover:scale-110 ${value === color ? "ring-2 ring-primary ring-offset-1" : ""}`}
                        style={{ backgroundColor: color }}
                        title={color}
                    />
                ))}
                <button
                    type="button"
                    onClick={() => onChange("transparent")}
                    className={`size-5 rounded-sm border text-[8px] transition-all hover:scale-110 ${value === "transparent" ? "ring-2 ring-primary ring-offset-1" : ""}`}
                    title="Transparente"
                    style={{ background: "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)", backgroundSize: "6px 6px", backgroundPosition: "0 0, 3px 3px" }}
                />
            </div>
        </div>
    );
}

// ── Properties Panel ───────────────────────────────────────────────────────────

export function PropertiesPanel() {
    const { blocks, selectedBlockId, updateBlockStyle, updateBlockContent, updateColumnChildStyle, updateColumnChildContent } = useEmailBuilderStore();

    // Find selected block — search both top-level and inside columns
    let selectedBlock: Block | undefined;
    let columnContext: { parentId: string; colIndex: number } | null = null;

    selectedBlock = blocks.find((b) => b.id === selectedBlockId);
    if (!selectedBlock) {
        for (const block of blocks) {
            if (block.type === "columns") {
                const content = block.content as any;
                const children: Block[][] = content.children || [];
                for (let ci = 0; ci < children.length; ci++) {
                    const found = children[ci].find((child: Block) => child.id === selectedBlockId);
                    if (found) {
                        selectedBlock = found;
                        columnContext = { parentId: block.id, colIndex: ci };
                        break;
                    }
                }
                if (selectedBlock) break;
            }
        }
    }

    if (!selectedBlock) {
        return (
            <aside className="flex w-[280px] shrink-0 flex-col items-center justify-center border-l bg-muted/10 p-6">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
                    </svg>
                </div>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                    Selecione um bloco para editar suas propriedades
                </p>
            </aside>
        );
    }

    const { type, content, style } = selectedBlock;
    const c = content as any;

    const handleStyleChange = (key: keyof BlockStyle, value: any) => {
        if (columnContext) {
            updateColumnChildStyle(columnContext.parentId, columnContext.colIndex, selectedBlock.id, { [key]: value });
        } else {
            updateBlockStyle(selectedBlock.id, { [key]: value });
        }
    };

    const handleContentChange = (key: string, value: any) => {
        if (columnContext) {
            updateColumnChildContent(columnContext.parentId, columnContext.colIndex, selectedBlock.id, { [key]: value });
        } else {
            updateBlockContent(selectedBlock.id, { [key]: value });
        }
    };

    // ── Block type label map ───────────────────────────────────────────────────
    const typeLabels: Record<string, string> = {
        heading: "Título",
        subheading: "Subtítulo",
        text: "Texto",
        list: "Lista",
        image: "Imagem",
        button: "Botão",
        divider: "Divisor",
        spacer: "Espaçador",
        social: "Redes Sociais",
        columns: "Colunas",
    };

    return (
        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l bg-background">
            {/* Header */}
            <div className="border-b px-5 py-3">
                <h3 className="text-sm font-semibold">
                    {typeLabels[type] || type}
                </h3>
                <p className="text-[11px] text-muted-foreground">Editar propriedades do bloco</p>
            </div>

            <div className="flex flex-col gap-1 p-5">
                {/* ── Content section ──────────────────────────────────────────── */}
                <Section title="Conteúdo">
                    {/* Heading */}
                    {type === "heading" && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Texto</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={c.text}
                                    onChange={(e) => handleContentChange("text", e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Nível</Label>
                                <Select
                                    value={c.level?.toString() || "2"}
                                    onValueChange={(val) => handleContentChange("level", parseInt(val))}
                                >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">H1</SelectItem>
                                        <SelectItem value="2">H2</SelectItem>
                                        <SelectItem value="3">H3</SelectItem>
                                        <SelectItem value="4">H4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    {/* Subheading */}
                    {type === "subheading" && (
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Texto</Label>
                            <Input
                                className="h-8 text-xs"
                                value={c.text}
                                onChange={(e) => handleContentChange("text", e.target.value)}
                            />
                        </div>
                    )}

                    {/* Text */}
                    {type === "text" && (
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Texto</Label>
                            <textarea
                                className="min-h-[80px] w-full rounded-md border bg-background p-2 text-xs"
                                value={c.text}
                                onChange={(e) => handleContentChange("text", e.target.value)}
                            />
                        </div>
                    )}

                    {/* List */}
                    {type === "list" && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Tipo de lista</Label>
                                <Select
                                    value={c.ordered ? "ordered" : "unordered"}
                                    onValueChange={(val) => handleContentChange("ordered", val === "ordered")}
                                >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unordered">• Marcadores</SelectItem>
                                        <SelectItem value="ordered">1. Numerada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Itens</Label>
                                {(c.items || []).map((item: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1">
                                        <Input
                                            className="h-7 flex-1 text-xs"
                                            value={item}
                                            onChange={(e) => {
                                                const newItems = [...c.items];
                                                newItems[idx] = e.target.value;
                                                handleContentChange("items", newItems);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newItems = c.items.filter((_: any, i: number) => i !== idx);
                                                handleContentChange("items", newItems);
                                            }}
                                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => handleContentChange("items", [...(c.items || []), "Novo item"])}
                                    className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <Plus className="size-3" /> Adicionar item
                                </button>
                            </div>
                        </>
                    )}

                    {/* Button */}
                    {type === "button" && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Texto do Botão</Label>
                                <Input className="h-8 text-xs" value={c.text} onChange={(e) => handleContentChange("text", e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">URL de destino</Label>
                                <Input className="h-8 text-xs" value={c.url} onChange={(e) => handleContentChange("url", e.target.value)} placeholder="https://" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Largura</Label>
                                <Select value={c.buttonWidth || "auto"} onValueChange={(val) => handleContentChange("buttonWidth", val)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Automática</SelectItem>
                                        <SelectItem value="fixed">Fixa (px)</SelectItem>
                                        <SelectItem value="full">100% (fluida)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {c.buttonWidth === "fixed" && (
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs">Largura (px)</Label>
                                    <Input className="h-8 text-xs" type="number" value={c.buttonWidthValue || 200} onChange={(e) => handleContentChange("buttonWidthValue", parseInt(e.target.value) || 200)} />
                                </div>
                            )}
                        </>
                    )}

                    {/* Image */}
                    {type === "image" && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">URL da Imagem</Label>
                                <Input className="h-8 text-xs" value={c.url} onChange={(e) => handleContentChange("url", e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Texto Alt</Label>
                                <Input className="h-8 text-xs" value={c.alt} onChange={(e) => handleContentChange("alt", e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Largura</Label>
                                <Input className="h-8 text-xs" value={c.width || "100%"} onChange={(e) => handleContentChange("width", e.target.value)} placeholder="ex: 100%, 300px" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Link da Imagem (opcional)</Label>
                                <Input className="h-8 text-xs" value={c.linkUrl || ""} onChange={(e) => handleContentChange("linkUrl", e.target.value)} placeholder="https://" />
                            </div>
                        </>
                    )}

                    {/* Divider */}
                    {type === "divider" && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Espessura ({c.lineHeight || 1}px)</Label>
                                <Slider
                                    defaultValue={[c.lineHeight || 1]}
                                    max={10}
                                    min={1}
                                    step={1}
                                    onValueChange={([val]) => handleContentChange("lineHeight", val)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Estilo da Linha</Label>
                                <Select value={c.lineStyle || "solid"} onValueChange={(val) => handleContentChange("lineStyle", val)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="solid">Sólida</SelectItem>
                                        <SelectItem value="dashed">Tracejada</SelectItem>
                                        <SelectItem value="dotted">Pontilhada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <ColorPickerField label="Cor da Linha" value={c.lineColor || "#e2e8f0"} onChange={(v) => handleContentChange("lineColor", v)} />
                        </>
                    )}

                    {/* Spacer */}
                    {type === "spacer" && (
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Altura ({c.height || 32}px)</Label>
                            <Slider
                                defaultValue={[c.height || 32]}
                                max={100}
                                min={8}
                                step={4}
                                onValueChange={([val]) => handleContentChange("height", val)}
                            />
                        </div>
                    )}

                    {/* Social */}
                    {type === "social" && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Tamanho dos Ícones ({c.iconSize || 24}px)</Label>
                                <Slider
                                    defaultValue={[c.iconSize || 24]}
                                    max={48}
                                    min={16}
                                    step={4}
                                    onValueChange={([val]) => handleContentChange("iconSize", val)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Links Sociais</Label>
                                {(c.links || []).map((link: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1">
                                        <Select
                                            value={link.platform}
                                            onValueChange={(val) => {
                                                const newLinks = [...c.links];
                                                newLinks[idx] = { ...newLinks[idx], platform: val };
                                                handleContentChange("links", newLinks);
                                            }}
                                        >
                                            <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="facebook">Facebook</SelectItem>
                                                <SelectItem value="instagram">Instagram</SelectItem>
                                                <SelectItem value="linkedin">LinkedIn</SelectItem>
                                                <SelectItem value="twitter">Twitter/X</SelectItem>
                                                <SelectItem value="youtube">YouTube</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            className="h-7 flex-1 text-xs"
                                            value={link.url}
                                            onChange={(e) => {
                                                const newLinks = [...c.links];
                                                newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                                                handleContentChange("links", newLinks);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newLinks = c.links.filter((_: any, i: number) => i !== idx);
                                                handleContentChange("links", newLinks);
                                            }}
                                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => handleContentChange("links", [...(c.links || []), { platform: "facebook", url: "https://facebook.com" }])}
                                    className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <Plus className="size-3" /> Adicionar rede
                                </button>
                            </div>
                        </>
                    )}

                    {/* Columns */}
                    {type === "columns" && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Número de Colunas</Label>
                                <Select value={(c.columns || 2).toString()} onValueChange={(val) => handleContentChange("columns", parseInt(val))}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2">2 Colunas</SelectItem>
                                        <SelectItem value="3">3 Colunas</SelectItem>
                                        <SelectItem value="4">4 Colunas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Espaçamento ({c.gap || 16}px)</Label>
                                <Slider
                                    defaultValue={[c.gap || 16]}
                                    max={40}
                                    min={0}
                                    step={4}
                                    onValueChange={([val]) => handleContentChange("gap", val)}
                                />
                            </div>
                        </>
                    )}
                </Section>

                {/* ── Typography section ───────────────────────────────────────── */}
                {["heading", "subheading", "text", "button"].includes(type) && (
                    <Section title="Tipografia">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Tamanho da fonte ({style.fontSize}px)</Label>
                            <Slider
                                defaultValue={[style.fontSize || 16]}
                                max={48}
                                min={10}
                                step={1}
                                onValueChange={([val]) => handleStyleChange("fontSize", val)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Peso da fonte</Label>
                            <Select value={(style.fontWeight || 400).toString()} onValueChange={(val) => handleStyleChange("fontWeight", parseInt(val))}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="300">Leve (300)</SelectItem>
                                    <SelectItem value="400">Normal (400)</SelectItem>
                                    <SelectItem value="500">Médio (500)</SelectItem>
                                    <SelectItem value="600">Semibold (600)</SelectItem>
                                    <SelectItem value="700">Bold (700)</SelectItem>
                                    <SelectItem value="800">Extra Bold (800)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Alinhamento</Label>
                            <Select
                                value={style.textAlign || "left"}
                                onValueChange={(val) => handleStyleChange("textAlign", val)}
                            >
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Esquerda</SelectItem>
                                    <SelectItem value="center">Centro</SelectItem>
                                    <SelectItem value="right">Direita</SelectItem>
                                    <SelectItem value="justify">Justificado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <ColorPickerField
                            label="Cor do Texto"
                            value={style.textColor || "#1a1a2e"}
                            onChange={(v) => handleStyleChange("textColor", v)}
                        />
                    </Section>
                )}

                {/* ── Colors section (for non-text blocks) ────────────────────── */}
                {!["heading", "subheading", "text", "button"].includes(type) && type !== "spacer" && (
                    <Section title="Cores">
                        <ColorPickerField
                            label="Cor de Fundo"
                            value={style.backgroundColor || "transparent"}
                            onChange={(v) => handleStyleChange("backgroundColor", v)}
                        />
                        {["image", "social"].includes(type) && (
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs">Alinhamento</Label>
                                <Select
                                    value={style.textAlign || "center"}
                                    onValueChange={(val) => handleStyleChange("textAlign", val)}
                                >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="left">Esquerda</SelectItem>
                                        <SelectItem value="center">Centro</SelectItem>
                                        <SelectItem value="right">Direita</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </Section>
                )}

                {/* ── Background (for text-like blocks) ───────────────────────── */}
                {["heading", "subheading", "text", "button"].includes(type) && (
                    <Section title="Fundo" defaultOpen={false}>
                        <ColorPickerField
                            label="Cor de Fundo"
                            value={style.backgroundColor || "transparent"}
                            onChange={(v) => handleStyleChange("backgroundColor", v)}
                        />
                    </Section>
                )}

                {/* ── Border section ──────────────────────────────────────────── */}
                {type !== "divider" && type !== "spacer" && (
                    <Section title="Bordas" defaultOpen={false}>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Espessura ({style.borderWidth || 0}px)</Label>
                            <Slider
                                defaultValue={[style.borderWidth || 0]}
                                max={8}
                                min={0}
                                step={1}
                                onValueChange={([val]) => {
                                    handleStyleChange("borderWidth", val);
                                    if (val > 0 && style.borderStyle === "none") {
                                        handleStyleChange("borderStyle", "solid");
                                    }
                                }}
                            />
                        </div>
                        {(style.borderWidth || 0) > 0 && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs">Estilo</Label>
                                    <Select value={style.borderStyle || "solid"} onValueChange={(val) => handleStyleChange("borderStyle", val)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="solid">Sólida</SelectItem>
                                            <SelectItem value="dashed">Tracejada</SelectItem>
                                            <SelectItem value="dotted">Pontilhada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <ColorPickerField
                                    label="Cor da Borda"
                                    value={style.borderColor || "#e2e8f0"}
                                    onChange={(v) => handleStyleChange("borderColor", v)}
                                />
                            </>
                        )}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Arredondamento ({style.borderRadius || 0}px)</Label>
                            <Slider
                                defaultValue={[style.borderRadius || 0]}
                                max={50}
                                min={0}
                                step={1}
                                onValueChange={([val]) => handleStyleChange("borderRadius", val)}
                            />
                        </div>
                    </Section>
                )}

                {/* ── Spacing section ─────────────────────────────────────────── */}
                <Section title="Espaçamento" defaultOpen={false}>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Padding Topo</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                value={style.paddingTop}
                                onChange={(e) => handleStyleChange("paddingTop", parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Padding Baixo</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                value={style.paddingBottom}
                                onChange={(e) => handleStyleChange("paddingBottom", parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Padding Esq.</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                value={style.paddingLeft}
                                onChange={(e) => handleStyleChange("paddingLeft", parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Padding Dir.</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                value={style.paddingRight}
                                onChange={(e) => handleStyleChange("paddingRight", parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <Separator className="my-1" />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Margem Topo</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                value={style.marginTop || 0}
                                onChange={(e) => handleStyleChange("marginTop", parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Margem Baixo</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                value={style.marginBottom || 0}
                                onChange={(e) => handleStyleChange("marginBottom", parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </Section>
            </div>
        </aside>
    );
}
