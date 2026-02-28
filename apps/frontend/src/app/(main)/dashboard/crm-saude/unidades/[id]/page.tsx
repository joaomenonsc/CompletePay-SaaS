"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createRoom,
  deleteRoom,
  fetchConvenios,
  fetchRooms,
  fetchUnit,
  updateRoom,
  updateUnit,
} from "@/lib/api/crm";
import type { Room } from "@/types/crm";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

const UNITS_QUERY_KEY = ["crm-units"] as const;

export default function UnidadeDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const { data: unit, isLoading: unitLoading } = useQuery({
    queryKey: [...UNITS_QUERY_KEY, id],
    queryFn: () => fetchUnit(id),
    enabled: !!id,
  });
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: [...UNITS_QUERY_KEY, id, "rooms"],
    queryFn: () => fetchRooms(id),
    enabled: !!id,
  });
  const { data: convenios = [] } = useQuery({
    queryKey: ["crm-convenios"],
    queryFn: fetchConvenios,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [timezone, setTimezone] = useState("");
  const [defaultSlotMinutes, setDefaultSlotMinutes] = useState<string>("");
  const [minAdvanceMinutes, setMinAdvanceMinutes] = useState<string>("");
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<string>("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [convenioIds, setConvenioIds] = useState<string[]>([]);

  useEffect(() => {
    if (!unit) return;
    setName(unit.name);
    setIsActive(unit.is_active);
    setTimezone(unit.timezone ?? "");
    setDefaultSlotMinutes(unit.default_slot_minutes != null ? String(unit.default_slot_minutes) : "");
    setMinAdvanceMinutes(unit.min_advance_minutes != null ? String(unit.min_advance_minutes) : "");
    setMaxAdvanceDays(unit.max_advance_days != null ? String(unit.max_advance_days) : "");
    setCancellationPolicy(unit.cancellation_policy ?? "");
    setConvenioIds(unit.convenio_ids ?? []);
  }, [unit]);

  const updateUnitMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateUnit>[1]) => updateUnit(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...UNITS_QUERY_KEY, id] });
      toast.success("Unidade atualizada");
      setEditOpen(false);
    },
    onError: (err: Error) => toast.error(err?.message ?? "Erro ao atualizar"),
  });

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUnitMutation.mutate({
      name: name.trim(),
      is_active: isActive,
      timezone: timezone.trim() || undefined,
      default_slot_minutes: defaultSlotMinutes ? parseInt(defaultSlotMinutes, 10) : undefined,
      min_advance_minutes: minAdvanceMinutes ? parseInt(minAdvanceMinutes, 10) : undefined,
      max_advance_days: maxAdvanceDays ? parseInt(maxAdvanceDays, 10) : undefined,
      cancellation_policy: cancellationPolicy.trim() || undefined,
      convenio_ids: convenioIds.length ? convenioIds : undefined,
    });
  };

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("");
  const [roomEquipmentNotes, setRoomEquipmentNotes] = useState("");
  const [roomActive, setRoomActive] = useState(true);

  const createRoomMutation = useMutation({
    mutationFn: (body: { name: string; capacity?: number | null; equipment_notes?: string | null; is_active?: boolean }) =>
      createRoom(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...UNITS_QUERY_KEY, id, "rooms"] });
      toast.success("Sala cadastrada");
      setRoomDialogOpen(false);
      setRoomName("");
      setRoomCapacity("");
      setRoomEquipmentNotes("");
      setRoomActive(true);
    },
    onError: (err: Error) => toast.error(err?.message ?? "Erro ao criar sala"),
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({
      roomId,
      body,
    }: {
      roomId: string;
      body: { name?: string; capacity?: number | null; equipment_notes?: string | null; is_active?: boolean };
    }) => updateRoom(id, roomId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...UNITS_QUERY_KEY, id, "rooms"] });
      toast.success("Sala atualizada");
      setRoomDialogOpen(false);
      setEditingRoom(null);
      setRoomName("");
      setRoomCapacity("");
      setRoomEquipmentNotes("");
    },
    onError: (err: Error) => toast.error(err?.message ?? "Erro ao atualizar"),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (roomId: string) => deleteRoom(id, roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...UNITS_QUERY_KEY, id, "rooms"] });
      toast.success("Sala removida");
    },
    onError: (err: Error) => toast.error(err?.message ?? "Erro ao remover"),
  });

  const openNewRoom = () => {
    setEditingRoom(null);
    setRoomName("");
    setRoomCapacity("");
    setRoomEquipmentNotes("");
    setRoomActive(true);
    setRoomDialogOpen(true);
  };

  const openEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomName(room.name);
    setRoomCapacity(room.capacity != null ? String(room.capacity) : "");
    setRoomEquipmentNotes(room.equipment_notes ?? "");
    setRoomActive(room.is_active);
    setRoomDialogOpen(true);
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      toast.error("Informe o nome da sala");
      return;
    }
    const payload = {
      name: roomName.trim(),
      capacity: roomCapacity ? parseInt(roomCapacity, 10) : undefined,
      equipment_notes: roomEquipmentNotes.trim() || undefined,
      is_active: roomActive,
    };
    if (editingRoom) {
      updateRoomMutation.mutate({ roomId: editingRoom.id, body: payload });
    } else {
      createRoomMutation.mutate(payload);
    }
  };

  if (unitLoading || !unit) {
    return (
      <main className="space-y-6" role="main">
        <p className="text-muted-foreground">Carregando unidade…</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm-saude/unidades">Voltar</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="space-y-6" role="main" aria-label={`Unidade ${unit.name}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/crm-saude/unidades" aria-label="Voltar">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{unit.name}</h1>
            <Badge variant={unit.is_active ? "secondary" : "outline"}>
              {unit.is_active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 size-4" />
          Editar unidade
        </Button>
      </header>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar unidade</DialogTitle>
            <DialogDescription>
              Dados da unidade e configuração operacional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveUnit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="unit-name">Nome *</Label>
                <Input
                  id="unit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="unit-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4 rounded border"
                />
                <Label htmlFor="unit-active">Unidade ativa</Label>
              </div>
              <div>
                <Label htmlFor="unit-timezone">Fuso horário</Label>
                <Input
                  id="unit-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/Sao_Paulo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Slot padrão (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={defaultSlotMinutes}
                    onChange={(e) => setDefaultSlotMinutes(e.target.value)}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label>Antecedência mín. (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minAdvanceMinutes}
                    onChange={(e) => setMinAdvanceMinutes(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Antecedência máx. (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={maxAdvanceDays}
                    onChange={(e) => setMaxAdvanceDays(e.target.value)}
                    placeholder="90"
                  />
                </div>
              </div>
              <div>
                <Label>Política de cancelamento</Label>
                <Textarea
                  value={cancellationPolicy}
                  onChange={(e) => setCancellationPolicy(e.target.value)}
                  placeholder="Ex.: Cancelar com 24h de antecedência"
                  rows={2}
                />
              </div>
              {convenios.length > 0 && (
                <div>
                  <Label>Convênios aceitos nesta unidade</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {convenios.map((c) => (
                      <label key={c.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={convenioIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConvenioIds((prev) => [...prev, c.id]);
                            } else {
                              setConvenioIds((prev) => prev.filter((x) => x !== c.id));
                            }
                          }}
                          className="size-4 rounded border"
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateUnitMutation.isPending}>
                {updateUnitMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Salas</CardTitle>
              <CardDescription>
                Salas de atendimento desta unidade.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openNewRoom}>
              <Plus className="mr-2 size-4" />
              Nova sala
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {roomsLoading ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Carregando salas…</p>
          ) : rooms.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhuma sala. Clique em &quot;Nova sala&quot; para cadastrar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Capacidade</TableHead>
                  <TableHead>Equipamentos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>{room.capacity ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {room.equipment_notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={room.is_active ? "secondary" : "outline"}>
                        {room.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditRoom(room)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover a sala "${room.name}"?`)) {
                              deleteRoomMutation.mutate(room.id);
                            }
                          }}
                          aria-label="Remover"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Editar sala" : "Nova sala"}</DialogTitle>
            <DialogDescription>
              Nome, capacidade e observações de equipamentos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRoom}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="room-name">Nome *</Label>
                <Input
                  id="room-name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Ex.: Consultório 1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="room-capacity">Capacidade</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  min={1}
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="room-equipment">Equipamentos / observações</Label>
                <Textarea
                  id="room-equipment"
                  value={roomEquipmentNotes}
                  onChange={(e) => setRoomEquipmentNotes(e.target.value)}
                  placeholder="Ex.: Computador, impressora"
                  rows={2}
                />
              </div>
              {editingRoom && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="room-active"
                    checked={roomActive}
                    onChange={(e) => setRoomActive(e.target.checked)}
                    className="size-4 rounded border"
                  />
                  <Label htmlFor="room-active">Sala ativa</Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoomDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createRoomMutation.isPending || updateRoomMutation.isPending}
              >
                {editingRoom
                  ? updateRoomMutation.isPending
                    ? "Salvando…"
                    : "Salvar"
                  : createRoomMutation.isPending
                    ? "Cadastrando…"
                    : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
