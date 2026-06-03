"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; primary?: boolean };
type NavGroup = { title?: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "Visão geral",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/controle-50k", label: "Controle 50K", primary: true },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/ferramentais", label: "Ferramentais" },
      { href: "/produtos", label: "Produtos" },
      { href: "/projetos", label: "Projetos" },
      { href: "/bom", label: "BOM" },
    ],
  },
  {
    title: "Planejamento",
    items: [
      { href: "/volumes", label: "Volumes Previstos" },
      { href: "/historico-demanda", label: "Histórico Demanda" },
    ],
  },
  {
    title: "Ciclo 50K",
    items: [
      { href: "/manutencoes", label: "Manutenções" },
      { href: "/leituras", label: "Leituras de Batidas" },
      { href: "/fechamento-mensal", label: "Fechamento Mensal" },
    ],
  },
  {
    items: [{ href: "/manual", label: "Manual" }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) =>
    setCollapsed((c) => ({ ...c, [title]: !c[title] }));

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-white font-bold text-xl">Controle 50K</h1>
          <p className="text-slate-400 text-sm mt-1">Prensa RV</p>
        </div>
        <nav className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {navGroups.map((group, groupIdx) => {
            const isCollapsed = group.title ? !!collapsed[group.title] : false;
            return (
              <div key={group.title ?? `group-${groupIdx}`}>
                {group.title && (
                  <button
                    type="button"
                    onClick={() => toggle(group.title!)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:text-white"
                    aria-expanded={!isCollapsed}
                  >
                    <span>{group.title}</span>
                    <span className={cn("text-[10px] text-slate-400 transition-transform duration-200", isCollapsed ? "-rotate-90" : "")}>▾</span>
                  </button>
                )}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-in-out",
                    isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1 pt-1">
                      {group.items.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            tabIndex={isCollapsed ? -1 : undefined}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              active
                                ? item.primary
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-700 text-white"
                                : item.primary
                                ? "text-blue-400 hover:bg-slate-800 hover:text-blue-300"
                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            )}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">Sistema de Controle Industrial</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
