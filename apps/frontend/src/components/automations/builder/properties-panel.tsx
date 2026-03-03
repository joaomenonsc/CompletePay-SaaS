"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getNodeMeta } from "./builder-utils";
import type { WorkflowNode } from "@/types/automations";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertiesPanelProps {
    node: WorkflowNode | null;
    onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
    onClose: () => void;
}

export default function PropertiesPanel({ node, onConfigChange, onClose }: PropertiesPanelProps) {
    if (!node) return null;

    const meta = getNodeMeta(node.type);
    const config = node.data.config;

    const update = (key: string, value: unknown) => {
        onConfigChange(node.id, { ...config, [key]: value });
    };

    return (
        <div className="w-72 border-l bg-muted/30 overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {meta?.icon && (
                        <div className={`rounded-md p-1 ${meta.color} text-white`}>
                            <meta.icon className="h-3.5 w-3.5" />
                        </div>
                    )}
                    <h3 className="text-sm font-semibold">{meta?.label ?? node.type}</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Fields */}
            <div className="p-3 space-y-4 flex-1 overflow-y-auto">
                {node.type === "HttpRequest" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Método</Label>
                            <Select value={String(config.method ?? "GET")} onValueChange={(v) => update("method", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">URL *</Label>
                            <Input
                                value={String(config.url ?? "")}
                                onChange={(e) => update("url", e.target.value)}
                                placeholder="https://api.exemplo.com/endpoint"
                                className="text-xs"
                            />
                        </div>
                    </>
                )}

                {node.type === "SendEmail" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Para *</Label>
                            <Input
                                value={String(config.to ?? "")}
                                onChange={(e) => update("to", e.target.value)}
                                placeholder="email@exemplo.com ou {{vars.email}}"
                                className="text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Assunto *</Label>
                            <Input
                                value={String(config.subject ?? "")}
                                onChange={(e) => update("subject", e.target.value)}
                                placeholder="Assunto do email"
                                className="text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Corpo</Label>
                            <Textarea
                                value={String(config.body ?? "")}
                                onChange={(e) => update("body", e.target.value)}
                                placeholder="Conteúdo do email..."
                                rows={4}
                                className="text-xs"
                            />
                        </div>
                    </>
                )}

                {node.type === "CreateCRMTask" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Tipo de recurso</Label>
                            <Select value={String(config.resource_type ?? "note")} onValueChange={(v) => update("resource_type", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="note">Nota</SelectItem>
                                    <SelectItem value="task">Tarefa</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Patient ID</Label>
                            <Input
                                value={String(config.patient_id ?? "")}
                                onChange={(e) => update("patient_id", e.target.value)}
                                placeholder="{{trigger.payload.patient_id}}"
                                className="text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Conteúdo</Label>
                            <Textarea
                                value={String(config.content ?? "")}
                                onChange={(e) => update("content", e.target.value)}
                                rows={3}
                                className="text-xs"
                            />
                        </div>
                    </>
                )}

                {node.type === "IfCondition" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Lado esquerdo *</Label>
                            <Input
                                value={String(config.left ?? "")}
                                onChange={(e) => update("left", e.target.value)}
                                placeholder="{{trigger.payload.status}}"
                                className="text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Operador</Label>
                            <Select value={String(config.operator ?? "eq")} onValueChange={(v) => update("operator", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="eq">= Igual</SelectItem>
                                    <SelectItem value="neq">≠ Diferente</SelectItem>
                                    <SelectItem value="gt">&gt; Maior</SelectItem>
                                    <SelectItem value="lt">&lt; Menor</SelectItem>
                                    <SelectItem value="gte">≥ Maior ou igual</SelectItem>
                                    <SelectItem value="lte">≤ Menor ou igual</SelectItem>
                                    <SelectItem value="contains">Contém</SelectItem>
                                    <SelectItem value="exists">Existe</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Lado direito</Label>
                            <Input
                                value={String(config.right ?? "")}
                                onChange={(e) => update("right", e.target.value)}
                                placeholder="active"
                                className="text-xs"
                            />
                        </div>
                    </>
                )}

                {node.type === "Delay" && (
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1.5">
                            <Label className="text-xs">Duração</Label>
                            <Input
                                type="number"
                                value={String(config.duration ?? 5)}
                                onChange={(e) => update("duration", Number(e.target.value))}
                                min={1}
                                max={55}
                                className="text-xs"
                            />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <Label className="text-xs">Unidade</Label>
                            <Select value={String(config.unit ?? "seconds")} onValueChange={(v) => update("unit", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="seconds">Segundos</SelectItem>
                                    <SelectItem value="minutes">Minutos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {node.type === "SetVariable" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Nome da variável *</Label>
                            <Input
                                value={String(config.key ?? "")}
                                onChange={(e) => update("key", e.target.value)}
                                placeholder="nome_da_variavel"
                                className="text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Valor</Label>
                            <Input
                                value={String(config.value ?? "")}
                                onChange={(e) => update("value", e.target.value)}
                                placeholder="{{trigger.payload.email}}"
                                className="text-xs"
                            />
                        </div>
                    </>
                )}

                {node.type === "Transform" && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Mapeamento (JSON)</Label>
                        <Textarea
                            value={JSON.stringify(config.mapping ?? {}, null, 2)}
                            onChange={(e) => {
                                try {
                                    const parsed = JSON.parse(e.target.value);
                                    update("mapping", parsed);
                                } catch { /* ignore invalid JSON while typing */ }
                            }}
                            rows={5}
                            className="font-mono text-xs"
                            placeholder='{"novo_campo": "{{trigger.payload.campo}}"}'
                        />
                    </div>
                )}

                {/* ── Data Transformation Nodes ── */}

                {node.type === "CodeScript" && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Código *</Label>
                        <Textarea
                            value={String(config.code ?? "result = data")}
                            onChange={(e) => update("code", e.target.value)}
                            rows={8}
                            className="font-mono text-xs"
                            placeholder={'# Acesse dados via: data, trigger, nodes\n# Atribua resultado a: result\nresult = {"total": len(data)}'}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Variáveis: <code>data</code> (vars), <code>trigger</code>, <code>nodes</code>. Atribua a <code>result</code>.
                        </p>
                    </div>
                )}

                {node.type === "FilterItems" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Variável fonte</Label>
                            <Input value={String(config.source ?? "items")} onChange={(e) => update("source", e.target.value)} className="text-xs" placeholder="items" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Campo *</Label>
                            <Input value={String(config.field ?? "")} onChange={(e) => update("field", e.target.value)} className="text-xs" placeholder="status" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Operador</Label>
                            <Select value={String(config.operator ?? "eq")} onValueChange={(v) => update("operator", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="eq">= Igual</SelectItem>
                                    <SelectItem value="neq">≠ Diferente</SelectItem>
                                    <SelectItem value="contains">Contém</SelectItem>
                                    <SelectItem value="exists">Existe</SelectItem>
                                    <SelectItem value="gt">&gt; Maior</SelectItem>
                                    <SelectItem value="lt">&lt; Menor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Valor</Label>
                            <Input value={String(config.value ?? "")} onChange={(e) => update("value", e.target.value)} className="text-xs" placeholder="active" />
                        </div>
                    </>
                )}

                {node.type === "SortItems" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Variável fonte</Label>
                            <Input value={String(config.source ?? "items")} onChange={(e) => update("source", e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Campo *</Label>
                            <Input value={String(config.field ?? "")} onChange={(e) => update("field", e.target.value)} className="text-xs" placeholder="name" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Ordem</Label>
                            <Select value={String(config.order ?? "asc")} onValueChange={(v) => update("order", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="asc">↑ Crescente</SelectItem>
                                    <SelectItem value="desc">↓ Decrescente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}

                {node.type === "RemoveDuplicates" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Variável fonte</Label>
                            <Input value={String(config.source ?? "items")} onChange={(e) => update("source", e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Campo de comparação</Label>
                            <Input value={String(config.field ?? "")} onChange={(e) => update("field", e.target.value)} className="text-xs" placeholder="email" />
                        </div>
                    </>
                )}

                {node.type === "SplitBatches" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Variável fonte</Label>
                            <Input value={String(config.source ?? "items")} onChange={(e) => update("source", e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Tamanho do lote</Label>
                            <Input type="number" value={String(config.batch_size ?? 10)} onChange={(e) => update("batch_size", Number(e.target.value))} min={1} max={1000} className="text-xs" />
                        </div>
                    </>
                )}

                {node.type === "MergeData" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Fonte A</Label>
                            <Input value={String(config.source_a ?? "items_a")} onChange={(e) => update("source_a", e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Fonte B</Label>
                            <Input value={String(config.source_b ?? "items_b")} onChange={(e) => update("source_b", e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Modo</Label>
                            <Select value={String(config.mode ?? "append")} onValueChange={(v) => update("mode", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="append">Concatenar</SelectItem>
                                    <SelectItem value="merge_by_key">Mesclar por chave</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {config.mode === "merge_by_key" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs">Chave de mesclagem</Label>
                                <Input value={String(config.merge_key ?? "id")} onChange={(e) => update("merge_key", e.target.value)} className="text-xs" placeholder="id" />
                            </div>
                        )}
                    </>
                )}

                {node.type === "DateTimeFormat" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Ação</Label>
                            <Select value={String(config.action ?? "format")} onValueChange={(v) => update("action", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="format">Formatar data</SelectItem>
                                    <SelectItem value="now">Data/hora atual</SelectItem>
                                    <SelectItem value="add_days">Adicionar dias</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {config.action !== "now" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs">Valor de entrada *</Label>
                                <Input value={String(config.input_field ?? "")} onChange={(e) => update("input_field", e.target.value)} className="text-xs" placeholder="{{vars.data}}" />
                            </div>
                        )}
                        {config.action === "add_days" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs">Dias</Label>
                                <Input type="number" value={String(config.days ?? 0)} onChange={(e) => update("days", Number(e.target.value))} className="text-xs" />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs">Formato de saída</Label>
                            <Input value={String(config.output_format ?? "%d/%m/%Y %H:%M")} onChange={(e) => update("output_format", e.target.value)} className="text-xs" placeholder="%d/%m/%Y %H:%M" />
                        </div>
                    </>
                )}

                {node.type === "RenameKeys" && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Variável fonte</Label>
                            <Input value={String(config.source ?? "items")} onChange={(e) => update("source", e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Mapeamento *</Label>
                            <Textarea
                                value={JSON.stringify(config.mappings ?? {}, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        update("mappings", parsed);
                                    } catch { /* ignore while typing */ }
                                }}
                                rows={4}
                                className="font-mono text-xs"
                                placeholder='{"nome_antigo": "nome_novo"}'
                            />
                        </div>
                    </>
                )}

                {(node.type === "ManualTrigger" || node.type === "WebhookTrigger") && (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                        Este node não requer configuração adicional.
                    </p>
                )}
            </div>

            {/* Metadata */}
            <div className="p-3 border-t text-[10px] text-muted-foreground space-y-1">
                <div>ID: <span className="font-mono">{node.id}</span></div>
                <div>Tipo: {node.type}</div>
            </div>
        </div>
    );
}
