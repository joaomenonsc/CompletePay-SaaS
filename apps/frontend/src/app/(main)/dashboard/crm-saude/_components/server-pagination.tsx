"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ServerPaginationProps {
  pageIndex: number;
  pageSize: number;
  total: number;
  onPageIndexChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function ServerPagination({
  pageIndex,
  pageSize,
  total,
  onPageIndexChange,
  onPageSizeChange,
}: ServerPaginationProps) {
  const pageCount = Math.ceil(total / pageSize) || 1;
  const canPrevious = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="flex w-full items-center justify-between px-4 py-2">
      <div className="text-muted-foreground text-sm">
        {total} resultado(s) — {from} a {to}
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="font-medium text-sm">
            Por página
          </Label>
          <Select
            value={`${pageSize}`}
            onValueChange={(v) => {
              onPageSizeChange(Number(v));
              onPageIndexChange(0);
            }}
          >
            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50].map((n) => (
                <SelectItem key={n} value={`${n}`}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 font-medium text-sm">
          Página {pageIndex + 1} de {pageCount}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageIndexChange(pageIndex - 1)}
            disabled={!canPrevious}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageIndexChange(pageIndex + 1)}
            disabled={!canNext}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
