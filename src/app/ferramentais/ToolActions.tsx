"use client";
import Link from "next/link";
import { toggleToolActive } from "@/lib/actions/tools";
import { useRouter } from "next/navigation";
import type { Tool } from "@prisma/client";

export function ToolActions({ tool }: { tool: Tool }) {
  const router = useRouter();

  async function handleToggle() {
    await toggleToolActive(tool.id, !tool.active);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/ferramentais/${tool.id}/editar`}
        className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
      >
        Editar
      </Link>
      <button
        onClick={handleToggle}
        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:underline"
      >
        {tool.active ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}
