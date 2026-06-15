"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  currentPage: number;
  totalPages: number;
  // Repassa o comportamento de scroll do <Pagination> (controle-50k usa false).
  scroll?: boolean;
}

// Campo para digitar diretamente a página de destino. Navega preservando os
// filtros atuais (só troca o parâmetro `page`).
export function PageJumpInput({ currentPage, totalPages, scroll = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(String(currentPage));

  // Mantém o campo em sincronia quando a página muda por outra via (botões, etc.).
  useEffect(() => {
    setValue(String(currentPage));
  }, [currentPage]);

  function go() {
    const parsed = parseInt(value, 10);
    const target = Math.min(
      totalPages,
      Math.max(1, Number.isNaN(parsed) ? currentPage : parsed)
    );
    setValue(String(target));
    if (target === currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    router.push(`${pathname}?${params.toString()}`, { scroll });
  }

  return (
    <input
      type="number"
      min={1}
      max={totalPages}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") go();
      }}
      onBlur={go}
      aria-label="Ir para a página"
      className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}
