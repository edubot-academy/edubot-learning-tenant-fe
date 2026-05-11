export type CountFilterItem<T extends string> = {
  key: T;
  label: string;
  count: number;
  active: boolean;
};

type CountFilterRowProps<T extends string> = {
  items: ReadonlyArray<CountFilterItem<T>>;
  onSelect: (key: T) => void;
  className: string;
  ariaLabel: string;
};

export function CountFilterRow<T extends string>({
  items,
  onSelect,
  className,
  ariaLabel,
}: CountFilterRowProps<T>) {
  return (
    <section className={className} role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          type="button"
          key={item.key}
          className={item.active ? 'active' : ''}
          aria-pressed={item.active}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
          <strong>{item.count}</strong>
        </button>
      ))}
    </section>
  );
}
