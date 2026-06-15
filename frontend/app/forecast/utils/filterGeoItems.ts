export type GeoItem = { id: string; name?: string; name_th?: string };

export function filterGeoItems(items: GeoItem[], query: string): GeoItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    i =>
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.name_th && i.name_th.toLowerCase().includes(q)) ||
      i.id.toLowerCase().includes(q),
  );
}
