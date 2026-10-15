import Link from "next/link";

export function ViewToggle({ current }: { current: "list" | "tree" | "agenda" }) {
  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-5">
      <Link href="/manutencoes" className={tabClass(current === "list")}>
        Lista
      </Link>
      <Link href="/manutencoes?view=tree" className={tabClass(current === "tree")}>
        Árvore por projeto
      </Link>
      <Link href="/manutencoes?view=agenda" className={tabClass(current === "agenda")}>
        Agendamento do mês
      </Link>
    </div>
  );
}
