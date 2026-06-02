"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  basePath: string;
  initialValue: string;
  placeholder?: string;
  total: number;
  label: string;
  extraParams?: Record<string, string>;
}

export function SearchInput({ basePath, initialValue, placeholder, total, label, extraParams }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  const extraParamsStr = extraParams ? JSON.stringify(extraParams) : "";

  useEffect(() => {
    const t = setTimeout(() => {
      const extra = extraParamsStr ? (JSON.parse(extraParamsStr) as Record<string, string>) : {};
      const params = new URLSearchParams(extra);
      if (value.trim()) params.set("search", value.trim());
      params.set("page", "1");
      router.push(`${basePath}?${params.toString()}`);
    }, 400);
    return () => clearTimeout(t);
  }, [value, basePath, router, extraParamsStr]);

  return (
    <div className="flex items-center gap-4 mb-4">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "Buscar…"}
        className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-400 shrink-0">
        {total} {label}
      </span>
    </div>
  );
}
