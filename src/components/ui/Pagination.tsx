import Link from "next/link";
import { PageJumpInput } from "./PageJumpInput";

interface Props {
  currentPage: number;
  totalPages: number;
  buildPageUrl: (page: number) => string;
  // Quando false, a navegação não rola a janela para o topo (deixa quem usa
  // controlar o scroll — ex.: rolar só o container da tabela). Default: true.
  scroll?: boolean;
}

export function Pagination({ currentPage, totalPages, buildPageUrl, scroll = true }: Props) {
  if (totalPages <= 1) return null;

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  const navClass =
    "px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50";
  const disabledClass =
    "px-3 py-2 border border-gray-200 text-gray-300 rounded-lg text-sm cursor-not-allowed";

  return (
    <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100 flex-wrap">
      {isFirst ? (
        <span className={disabledClass}>« Primeira</span>
      ) : (
        <Link href={buildPageUrl(1)} scroll={scroll} className={navClass}>
          « Primeira
        </Link>
      )}

      {isFirst ? (
        <span className={disabledClass}>← Anterior</span>
      ) : (
        <Link href={buildPageUrl(currentPage - 1)} scroll={scroll} className={navClass}>
          ← Anterior
        </Link>
      )}

      <span className="flex items-center gap-2 text-sm text-gray-500">
        Página
        <PageJumpInput currentPage={currentPage} totalPages={totalPages} scroll={scroll} />
        de {totalPages}
      </span>

      {isLast ? (
        <span className={disabledClass}>Próxima →</span>
      ) : (
        <Link href={buildPageUrl(currentPage + 1)} scroll={scroll} className={navClass}>
          Próxima →
        </Link>
      )}

      {isLast ? (
        <span className={disabledClass}>Última »</span>
      ) : (
        <Link href={buildPageUrl(totalPages)} scroll={scroll} className={navClass}>
          Última »
        </Link>
      )}
    </div>
  );
}
