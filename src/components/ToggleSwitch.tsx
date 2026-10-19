interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${checked ? "toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
      <style>{`
        .toggle {
          position: relative;
          width: 38px;
          height: 22px;
          border-radius: 0;
          border: none;
          clip-path: var(--poly-clip-hex);
          background: var(--bg-surface-hover);
          padding: 0;
          flex-shrink: 0;
          transition: background 160ms ease, border-color 160ms ease;
        }
        .toggle--on {
          background: var(--ember-gradient);
        }
        .toggle:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .toggle-knob {
          position: absolute;
          top: 3px;
          left: 6px;
          width: 16px;
          height: 16px;
          border-radius: 0;
          clip-path: circle(50%);
          background: var(--ink-muted);
          transition: transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), background 160ms ease;
        }
        .toggle--on .toggle-knob {
          transform: translateX(10px);
          background: var(--ink-on-ember);
        }
      `}</style>
    </button>
  );
}
