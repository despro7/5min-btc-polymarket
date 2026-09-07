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

  const btn =
    "flex items-center justify-center w-9 self-stretch text-[var(--foreground)] transition-colors hover:bg-[var(--color-default-200)] disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="w-full">
      <label className="block text-xs text-[var(--muted-foreground)] mb-1.5">{label}</label>
      <div
        className={`flex items-stretch h-9 rounded-lg border border-[var(--color-default-300)] bg-[var(--color-default-100)] overflow-hidden focus-within:border-[var(--color-accent)] ${
          isDisabled ? "opacity-50" : ""
        }`}
      >
        <button
          type="button"
          aria-label="Decrease"
          disabled={isDisabled || atMin}
          onClick={() => commit(value - step)}
          className={`${btn} border-r border-[var(--color-default-300)]`}
        >
          <DynamicIcon name="minus" size={15} strokeWidth={2} className="shrink-0" />
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
          className="w-full min-w-0 bg-transparent text-center text-sm font-medium tabular-nums outline-none"
        />
        <button
          type="button"
          aria-label="Increase"
          disabled={isDisabled || atMax}
          onClick={() => commit(value + step)}
          className={`${btn} border-l border-[var(--color-default-300)]`}
        >
          <DynamicIcon name="plus" size={15} strokeWidth={2} className="shrink-0" />
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
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>
        <Label>{label}</Label>
        {description ? <Description>{description}</Description> : null}
      </Switch.Content>
    </Switch>
  );
}
