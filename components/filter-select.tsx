"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Filtro genérico que escreve um parâmetro na query string (preservando os
 * demais). Use `param` para a chave (ex: "linha", "segmento", "cliente").
 */
export function FilterSelect({
  param,
  value,
  options,
  allLabel = "Todos",
  label,
}: {
  param: string;
  value?: string;
  options: string[];
  allLabel?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams(params.toString());
    if (e.target.value) sp.set(param, e.target.value);
    else sp.delete(param);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <select
      value={value ?? ""}
      onChange={onChange}
      className="input w-auto cursor-pointer"
      aria-label={label ?? param}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
