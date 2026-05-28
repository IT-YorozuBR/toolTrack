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
      className="whitespace-nowrap rounded-md bg-orange-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-orange-700"
    >
      Registrar
    </button>
  );
}
