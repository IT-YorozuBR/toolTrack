"use client";
import { useState } from "react";

interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  label?: string;
}

export function ConfirmDeleteButton({ onConfirm, label = "Excluir" }: ConfirmDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex gap-1">
        <button
          onClick={() => { onConfirm(); setConfirming(false); }}
          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
        >
          Confirmar
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancelar
        </button>
      </span>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:underline"
    >
      {label}
    </button>
  );
}
