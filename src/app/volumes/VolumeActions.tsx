"use client";
import { deleteProductionForecast } from "@/lib/actions/forecasts";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { useRouter } from "next/navigation";
import type { ProductionForecast } from "@prisma/client";

export function VolumeActions({ forecast }: { forecast: ProductionForecast }) {
  const router = useRouter();
  async function handleDelete() {
    await deleteProductionForecast(forecast.id);
    router.refresh();
  }
  return <ConfirmDeleteButton onConfirm={handleDelete} />;
}
