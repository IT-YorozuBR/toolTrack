"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", emoji: "📊" },
  { href: "/ferramentais", label: "Ferramentais", emoji: "🔧" },
  { href: "/produtos", label: "Produtos", emoji: "📦" },
  { href: "/bom", label: "BOM", emoji: "📋" },
  { href: "/volumes", label: "Volumes Previstos", emoji: "📈" },
  { href: "/controle-50k", label: "Controle 50K", emoji: "⚠️", primary: true },
  { href: "/manutencoes", label: "Manutenções", emoji: "🛠️" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-white font-bold text-xl">Controle 50K</h1>
          <p className="text-slate-400 text-sm mt-1">Prensa RV</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
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
                <span>{item.emoji}</span>
                {item.label}
              </Link>
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
