export type DocType = "pdf" | "txt" | "md" | "csv";

export interface KbDocument {
  id: string;
  name: string;
  type: DocType;
  sizeBytes: number;
  chunks: number | null;
  uploadedAt: string;
  status: "pronto" | "processando";
  processingPercent?: number;
}

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "processing";
}
