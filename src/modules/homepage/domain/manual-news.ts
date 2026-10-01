import { MAX_MANUAL_NEWS_ITEMS } from "./sections";

export type ManualNewsPickerTarget = {
  id: string;
  title: string;
  isPubliclyAvailable: boolean;
  publishedAt?: Date | string | null;
};

export type SelectedManualNewsRow = {
  id: string;
  title: string;
  isPubliclyAvailable: boolean;
  publishedAt?: Date | string | null;
};

export function addManualNewsId(
  manualNewsIds: readonly string[],
  newsId: string,
): string[] {
  if (manualNewsIds.includes(newsId)) return [...manualNewsIds];
  if (manualNewsIds.length >= MAX_MANUAL_NEWS_ITEMS) return [...manualNewsIds];
  return [...manualNewsIds, newsId];
}

export function removeManualNewsId(
  manualNewsIds: readonly string[],
  newsId: string,
): string[] {
  return manualNewsIds.filter((id) => id !== newsId);
}

export function moveManualNewsId(
  manualNewsIds: readonly string[],
  newsId: string,
  direction: "up" | "down",
): string[] {
  const index = manualNewsIds.indexOf(newsId);
  if (index < 0) return [...manualNewsIds];
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= manualNewsIds.length) return [...manualNewsIds];
  const next = [...manualNewsIds];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}

export function filterAvailableManualNewsToAdd(
  targets: readonly ManualNewsPickerTarget[],
  selectedIds: readonly string[],
): ManualNewsPickerTarget[] {
  const selected = new Set(selectedIds);
  return targets.filter(
    (target) => target.isPubliclyAvailable && !selected.has(target.id),
  );
}

export function resolveSelectedManualNewsRows(
  selectedIds: readonly string[],
  targetsById: ReadonlyMap<string, ManualNewsPickerTarget>,
): SelectedManualNewsRow[] {
  return selectedIds.map((id) => {
    const target = targetsById.get(id);
    return {
      id,
      title: target?.title?.trim() ? target.title : id,
      isPubliclyAvailable: target?.isPubliclyAvailable ?? false,
      publishedAt: target?.publishedAt ?? null,
    };
  });
}

export function canAddManualNews(manualNewsIds: readonly string[]): boolean {
  return manualNewsIds.length < MAX_MANUAL_NEWS_ITEMS;
}
