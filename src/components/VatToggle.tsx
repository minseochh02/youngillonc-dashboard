"use client";

import { useVatInclude } from "@/contexts/VatIncludeContext";

type VatToggleProps = {
  id?: string;
  className?: string;
};

export default function VatToggle({ id = "includeVat", className = "" }: VatToggleProps) {
  const { includeVat, setIncludeVat } = useVatInclude();

  return (
    <div
      className={`flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm ${className}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={includeVat}
        onChange={(e) => setIncludeVat(e.target.checked)}
        className="w-4 h-4 text-blue-600 bg-zinc-100 border-zinc-300 rounded focus:ring-blue-500"
      />
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer"
      >
        VAT 포함
      </label>
    </div>
  );
}
