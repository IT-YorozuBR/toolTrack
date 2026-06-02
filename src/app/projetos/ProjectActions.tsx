"use client";
import Link from "next/link";
import { toggleProjectActive } from "@/lib/actions/projects";
import { useRouter } from "next/navigation";
import type { Project } from "@prisma/client";

export function ProjectActions({ project }: { project: Project }) {
  const router = useRouter();

  async function handleToggle() {
    await toggleProjectActive(project.id, !project.active);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/projetos/${project.id}/editar`}
        className="px-2 py-1 text-xs text-blue-600 hover:underline"
      >
        Editar
      </Link>
      <button
        onClick={handleToggle}
        className="px-2 py-1 text-xs text-gray-600 hover:underline"
      >
        {project.active ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}
