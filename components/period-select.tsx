"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIOD_OPTIONS } from "@/lib/period";

export function PeriodSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams(params.toString());
    sp.set("days", e.target.value);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <select
      value={value}
      onChange={onChange}
      className="input w-auto cursor-pointer"
      aria-label="Período"
    >
      {PERIOD_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
