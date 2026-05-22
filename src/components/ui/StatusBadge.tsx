import { cn } from "@/lib/utils";
import type { MaintenanceStatus } from "@/lib/calculations/strokes";

const config: Record<MaintenanceStatus, { label: string; className: string }> = {
  OK: { label: "OK", className: "bg-green-100 text-green-800 border-green-200" },
  ATENCAO: { label: "Atenção", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  PROGRAMAR_PREVENTIVA: { label: "Programar Preventiva", className: "bg-orange-100 text-orange-800 border-orange-200" },
  VENCIDO: { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" },
  ERRO_CADASTRO: { label: "Erro de Cadastro", className: "bg-gray-100 text-gray-800 border-gray-200" },
};

export function StatusBadge({ status }: { status: MaintenanceStatus }) {
  const { label, className } = config[status];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", className)}>
      {label}
    </span>
  );
}
