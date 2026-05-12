type StatGridProps = {
  items: Array<{
    label: string;
    value: string | number;
    hint?: string;
  }>;
};

export function StatGrid({ items }: StatGridProps) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <section className="stat-tile premium-stat-tile" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <small>{item.hint}</small> : null}
        </section>
      ))}
    </div>
  );
}
