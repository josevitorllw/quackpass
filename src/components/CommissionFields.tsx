import type { DiscountType } from "@prisma/client";

/** Campos de comissão: valor + tipo (% da venda ou R$ por ingresso). */
export function CommissionFields({
  type,
  value,
  placeholder = "Ex.: 10",
  label = "Comissão",
  prefix = "commission",
  defaultType = "PERCENT",
}: {
  type?: DiscountType | null;
  value?: number | null;
  placeholder?: string;
  label?: string;
  prefix?: string;
  defaultType?: DiscountType;
}) {
  const display = value == null || value === 0 ? "" : type === "FIXED" ? (value / 100).toFixed(2).replace(".", ",") : String(value / 100).replace(".", ",");
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid grid-cols-[1fr_130px] gap-2">
        <input name={`${prefix}Value`} className="input" placeholder={placeholder} inputMode="decimal" defaultValue={display} />
        <select name={`${prefix}Type`} className="input" defaultValue={type ?? defaultType}>
          <option value="PERCENT">% da venda</option>
          <option value="FIXED">R$ por pessoa</option>
        </select>
      </div>
    </div>
  );
}
