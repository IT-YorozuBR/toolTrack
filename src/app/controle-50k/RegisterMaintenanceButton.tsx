"use client";
import { useRouter } from "next/navigation";

export function RegisterMaintenanceButton({
  toolId,
}: {
  toolId: string;
  toolCode?: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/manutencoes/nova?toolId=${toolId}`)}
      className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 whitespace-nowrap font-medium"
    >
      Registrar Manutenção
    </button>
  );
}
