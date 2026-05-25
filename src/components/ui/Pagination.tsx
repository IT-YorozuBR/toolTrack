import Link from "next/link";

interface Props {
  currentPage: number;
  totalPages: number;
  buildPageUrl: (page: number) => string;
}

export function Pagination({ currentPage, totalPages, buildPageUrl }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-4 border-t border-gray-100">
      {currentPage > 1 ? (
        <Link
          href={buildPageUrl(currentPage - 1)}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="px-4 py-2 border border-gray-200 text-gray-300 rounded-lg text-sm cursor-not-allowed">
          ← Anterior
        </span>
      )}

      <span className="text-sm text-gray-500">
        Página {currentPage} de {totalPages}
      </span>

      {currentPage < totalPages ? (
        <Link
          href={buildPageUrl(currentPage + 1)}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
        >
          Próxima →
        </Link>
      ) : (
        <span className="px-4 py-2 border border-gray-200 text-gray-300 rounded-lg text-sm cursor-not-allowed">
          Próxima →
        </span>
      )}
    </div>
  );
}
