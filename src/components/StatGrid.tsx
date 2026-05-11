type StatGridProps = {
  items: Array<{
    label: string;
    value: string | number;
    hint?: string;
  }>;
};

export function StatGrid({ items }: StatGridProps) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <section className="stat-tile" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <small>{item.hint}</small> : null}
        </section>
      ))}
    </div>
  );
}
