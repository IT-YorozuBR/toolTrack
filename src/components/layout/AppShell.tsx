"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Gauge,
  Wrench,
  Package,
  FolderKanban,
  Boxes,
  CalendarDays,
  History,
  Settings,
  Activity,
  CalendarCheck,
  FileText,
  Cog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; primary?: boolean };
type NavGroup = { title?: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "Visão geral",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/controle-50k", label: "Controle 50K", icon: Gauge, primary: true },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/ferramentais", label: "Ferramentais", icon: Wrench },
      { href: "/produtos", label: "Produtos", icon: Package },
      { href: "/projetos", label: "Projetos", icon: FolderKanban },
      { href: "/bom", label: "BOM", icon: Boxes },
    ],
  },
  {
    title: "Planejamento",
    items: [
      { href: "/volumes", label: "Volumes Previstos", icon: CalendarDays },
      { href: "/historico-demanda", label: "Histórico Demanda", icon: History },
    ],
  },
  {
    title: "Ciclo 50K",
    items: [
      { href: "/manutencoes", label: "Manutenções", icon: Settings },
      { href: "/leituras", label: "Leituras de Batidas", icon: Activity },
      // { href: "/fechamento-mensal", label: "Fechamento Mensal", icon: CalendarCheck },
    ],
  },
  {
    items: [{ href: "/manual", label: "Manual", icon: FileText }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) =>
    setCollapsed((c) => ({ ...c, [title]: !c[title] }));

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-72 bg-gradient-to-b from-white via-slate-50 to-blue-50/60 border-r border-slate-200 flex flex-col shrink-0">
        {/* Identidade / topo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/30">
            <Cog className="h-6 w-6 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-slate-900 font-bold text-lg leading-tight tracking-tight">Controle 50K</h1>
            <p className="text-blue-600/80 text-xs font-medium uppercase tracking-wider mt-0.5">Prensa RV</p>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-5">
          {navGroups.map((group, groupIdx) => {
            const isCollapsed = group.title ? !!collapsed[group.title] : false;
            return (
              <div key={group.title ?? `group-${groupIdx}`}>
                {group.title && (
                  <button
                    type="button"
                    onClick={() => toggle(group.title!)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-slate-800"
                    aria-expanded={!isCollapsed}
                  >
                    <span>{group.title}</span>
                    <span
                      className={cn(
                        "text-[10px] text-slate-400 transition-transform duration-200",
                        isCollapsed ? "-rotate-90" : ""
                      )}
                    >
                      ▾
                    </span>
                  </button>
                )}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-in-out",
                    isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1 pt-1.5">
                      {group.items.map((item) => {
                        const active =
                          pathname === item.href || pathname.startsWith(item.href + "/");
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            tabIndex={isCollapsed ? -1 : undefined}
                            className={cn(
                              "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                              active
                                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400/30"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-[18px] w-[18px] shrink-0 transition-colors",
                                active
                                  ? "text-white"
                                  : item.primary
                                  ? "text-blue-600 group-hover:text-blue-700"
                                  : "text-slate-400 group-hover:text-slate-600"
                              )}
                              strokeWidth={2}
                            />
                            <span className="truncate">{item.label}</span>
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

        {/* Rodapé */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200">
          <Cog className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-slate-500 text-xs leading-tight truncate">Sistema de Controle Industrial</p>
            <p className="text-slate-400 text-[10px] font-medium mt-0.5">v4.2.0</p>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
