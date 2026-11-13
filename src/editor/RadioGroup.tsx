import { useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

/**
 * Accessible single-choice group (WAI-ARIA radio group pattern): one Tab stop for the
 * whole group (roving tabindex), arrow keys move and select, Home/End jump to the ends.
 */
export function RadioGroup({
  label,
  options,
  value,
  onChange,
  showLabel = true,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  showLabel?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));

  function select(index: number) {
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, () => void> = {
      ArrowRight: () => select(index + 1),
      ArrowDown: () => select(index + 1),
      ArrowLeft: () => select(index - 1),
      ArrowUp: () => select(index - 1),
      Home: () => select(0),
      End: () => select(options.length - 1),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      move();
    }
  }

  return (
    <div className="grid gap-1.5">
      {showLabel ? <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase" aria-hidden="true">{label}</span> : null}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((option, index) => {
          const checked = index === selected;
          return (
            <Button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              size="sm"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              variant={checked ? "default" : "outline"}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
