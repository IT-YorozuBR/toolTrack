"use client";
import { useState, useRef, useEffect } from "react";
import { searchTools } from "@/lib/actions/tools";

type ToolResult = {
  id: string;
  code: string;
  description: string | null;
  currentStrokes: number;
};

interface Props {
  defaultTool?: ToolResult | null;
  onSelect: (tool: ToolResult | null) => void;
}

export function ToolCombobox({ defaultTool, onSelect }: Props) {
  const [query, setQuery] = useState(defaultTool?.code ?? "");
  const [results, setResults] = useState<ToolResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ToolResult | null>(defaultTool ?? null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // restore display to selected tool if user clicked away without picking
        if (selected) setQuery(selected.code);
        else setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected]);

  function handleChange(value: string) {
    setQuery(value);
    setSelected(null);
    onSelect(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const tools = await searchTools(value);
      setResults(tools);
      setOpen(true);
      setLoading(false);
    }, 300);
  }

  function handleSelect(tool: ToolResult) {
    setSelected(tool);
    setQuery(tool.code);
    setResults([]);
    setOpen(false);
    onSelect(tool);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Digite o código do ferramental…"
          autoComplete="off"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8
            ${selected ? "border-green-400 bg-green-50" : "border-gray-300"}`}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </span>
        )}
        {selected && !loading && (
          <button
            type="button"
            onClick={() => { setSelected(null); setQuery(""); onSelect(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {selected && (
        <p className="mt-1 text-xs text-green-700">
          {selected.description ? `${selected.description} — ` : ""}
          {selected.currentStrokes.toLocaleString("pt-BR")} batidas atuais
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((tool) => (
            <li key={tool.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(tool)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm"
              >
                <span className="font-medium text-gray-900">{tool.code}</span>
                {tool.description && (
                  <span className="text-gray-500 ml-2 text-xs">{tool.description}</span>
                )}
                <span className="block text-xs text-gray-400 mt-0.5">
                  {tool.currentStrokes.toLocaleString("pt-BR")} batidas atuais
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
          Nenhum ferramental encontrado.
        </div>
      )}
    </div>
  );
}
