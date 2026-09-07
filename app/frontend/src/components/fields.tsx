import { useEffect, useState } from "react";
import { Description, Label, Switch } from "@heroui/react";
import { DynamicIcon } from "lucide-react/dynamic";

function round(v: number, decimals = 6): number {
  const f = 10 ** decimals;
  return Math.round((v + Number.EPSILON) * f) / f;
}

/** Bordered controlled number stepper (−  value  +). Built from free components. */
export function NumField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  minValue?: number;
  maxValue?: number;
  step?: number;
  isDisabled?: boolean;
}) {
  const { label, value, onChange, minValue, maxValue, step = 1, isDisabled } = props;
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (v: number): number => {
    let out = v;
    if (minValue !== undefined) out = Math.max(minValue, out);
    if (maxValue !== undefined) out = Math.min(maxValue, out);
    return round(out);
  };

  const commit = (v: number) => onChange(clamp(v));
  const atMin = minValue !== undefined && value <= minValue;
  const atMax = maxValue !== undefined && value >= maxValue;

  const circle =
    "shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--surface)] disabled:hover:text-[var(--foreground)]";

  return (
    <div className="w-full">
      <label className="block text-xs text-[var(--muted)] mb-1.5 truncate">{label}</label>
      <div className={`flex items-center gap-1 rounded-full bg-[var(--surface-tertiary)] p-1 ${isDisabled ? "opacity-50" : ""}`}>
        <button type="button" aria-label="Decrease" disabled={isDisabled || atMin} onClick={() => commit(value - step)} className={circle}>
          <DynamicIcon name="minus" size={14} strokeWidth={2.25} className="shrink-0" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          disabled={isDisabled}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) commit(v);
          }}
          onBlur={() => setText(String(value))}
          className="w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
        />
        <button type="button" aria-label="Increase" disabled={isDisabled || atMax} onClick={() => commit(value + step)} className={circle}>
          <DynamicIcon name="plus" size={14} strokeWidth={2.25} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function LabeledSwitch(props: {
  label: string;
  description?: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
  isDisabled?: boolean;
}) {
  const { label, description, isSelected, onChange, isDisabled } = props;
  return (
    <Switch isSelected={isSelected} onChange={onChange} isDisabled={isDisabled}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{label}</Label>
      </Switch.Content>
      {description ? <Description>{description}</Description> : null}
    </Switch>
  );
}
