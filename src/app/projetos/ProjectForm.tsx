"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject, updateProject } from "@/lib/actions/projects";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Project } from "@prisma/client";

export function ProjectForm({ project }: { project?: Project }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const data = {
      name: (formData.get("name") as string).trim(),
      description: (formData.get("description") as string).trim() || undefined,
    };

    const result = project
      ? await updateProject(project.id, data)
      : await createProject(data);

    if (result.success) {
      router.push("/projetos");
      router.refresh();
    } else {
      setError(result.error ?? "Erro desconhecido.");
    }
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
          <input
            name="name"
            defaultValue={project?.name}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Projeto Civic 2025"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <input
            name="description"
            defaultValue={project?.description ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descrição opcional"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <SubmitButton>{project ? "Salvar Alterações" : "Cadastrar Projeto"}</SubmitButton>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
