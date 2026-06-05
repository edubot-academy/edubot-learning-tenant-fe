export type DashboardClassValue = string | false | null | undefined;

export function cx(...classes: DashboardClassValue[]) {
  return classes.reduce<string[]>((items, item) => {
    if (item) items.push(item);
    return items;
  }, []).join(' ');
}
