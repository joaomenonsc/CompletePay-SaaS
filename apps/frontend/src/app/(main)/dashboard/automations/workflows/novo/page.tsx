"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkflow } from "@/hooks/use-automations";

export default function NewWorkflowPage() {
    const router = useRouter();
    const createWorkflow = useCreateWorkflow();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const handleCreate = () => {
        if (!name.trim()) return;
        createWorkflow.mutate(
            { name: name.trim(), description: description.trim() || undefined },
            {
                onSuccess: (wf) => {
                    router.push(`/dashboard/automations/workflows/${wf.id}`);
                },
            }
        );
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>Novo Workflow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                            id="name"
                            placeholder="Ex: Boas-vindas ao paciente"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={255}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            placeholder="Descreva o que este workflow faz..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!name.trim() || createWorkflow.isPending}
                        >
                            {createWorkflow.isPending ? "Criando..." : "Criar e Abrir Builder"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
