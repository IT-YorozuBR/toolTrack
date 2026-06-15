"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Alterna a tela cheia (Fullscreen API) do cartão da tabela. Em tela cheia, libera
// a altura do scroll interno para ocupar toda a viewport (sem o teto de 100vh-18rem).
export function FullscreenButton({
  targetId,
  scrollId,
}: {
  targetId: string;
  scrollId: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchParams = useSearchParams();
  const page = searchParams.get("page") ?? "1";

  // Ao trocar de página (navegação suave da paginação), o scroll interno mantém a
  // posição — volta ao topo da tabela para a página nova começar do início.
  useEffect(() => {
    document.getElementById(scrollId)?.scrollTo({ top: 0 });
  }, [page, scrollId]);

  useEffect(() => {
    function onChange() {
      const active = document.fullscreenElement?.id === targetId;
      setIsFullscreen(active);
      // Em tela cheia, o cartão vira uma coluna flex ocupando toda a viewport:
      // a área de scroll flexiona e a paginação fica fixa embaixo, sempre visível.
      const card = document.getElementById(targetId);
      if (card) {
        card.style.display = active ? "flex" : "";
        card.style.flexDirection = active ? "column" : "";
        card.style.height = active ? "100vh" : "";
      }
      const scroll = document.getElementById(scrollId);
      if (scroll) {
        scroll.style.flex = active ? "1 1 auto" : "";
        scroll.style.minHeight = active ? "0" : "";
        scroll.style.maxHeight = active ? "none" : "";
      }
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [targetId, scrollId]);

  function toggle() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.getElementById(targetId)?.requestFullscreen();
    }
  }

  return (
    <button
      onClick={toggle}
      title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
    >
      {isFullscreen ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
          Sair da tela cheia
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
          Tela cheia
        </>
      )}
    </button>
  );
}
