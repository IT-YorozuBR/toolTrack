"use client";
import { deleteBomItem } from "@/lib/actions/bom";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { useRouter } from "next/navigation";

export function BomActions({ item }: { item: { id: string } }) {
  const router = useRouter();
  async function handleDelete() {
    await deleteBomItem(item.id);
    router.refresh();
  }
  return <ConfirmDeleteButton onConfirm={handleDelete} />;
}
