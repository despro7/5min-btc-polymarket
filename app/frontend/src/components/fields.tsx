import { Description, Label, NumberField, Switch } from "@heroui/react";

export function NumField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  minValue?: number;
  maxValue?: number;
  step?: number;
  formatOptions?: Intl.NumberFormatOptions;
  isDisabled?: boolean;
}) {
  const { label, value, onChange, minValue, maxValue, step, formatOptions, isDisabled } = props;
  return (
    <NumberField
      className="w-full"
      value={value}
      onChange={onChange}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      formatOptions={formatOptions}
      isDisabled={isDisabled}
    >
      <Label className="text-xs text-[var(--muted-foreground)]">{label}</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
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
