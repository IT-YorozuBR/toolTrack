import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | number;
  description?: string;
  variant?: "default" | "ok" | "warning" | "danger" | "info";
  emoji?: string;
}

const variantStyles = {
  default: "bg-white border-gray-200",
  ok: "bg-green-50 border-green-200",
  warning: "bg-yellow-50 border-yellow-200",
  danger: "bg-red-50 border-red-200",
  info: "bg-blue-50 border-blue-200",
};

const variantValueStyles = {
  default: "text-gray-900",
  ok: "text-green-700",
  warning: "text-yellow-700",
  danger: "text-red-700",
  info: "text-blue-700",
};

export function SummaryCard({ title, value, description, variant = "default", emoji }: SummaryCardProps) {
  return (
    <div className={cn("rounded-xl border p-6 shadow-sm", variantStyles[variant])}>
      <div className="flex items-center gap-2 mb-2">
        {emoji && <span className="text-2xl">{emoji}</span>}
        <p className="text-sm font-medium text-gray-600">{title}</p>
      </div>
      <p className={cn("text-3xl font-bold", variantValueStyles[variant])}>{value}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
  );
}
