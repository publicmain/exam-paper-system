/** Shared badge date boundary; independent of unreleased growth/report modules. */
export const SGT_OFFSET_MS = 8 * 3600_000;
export function sgtKey(date: Date): string {
  return new Date(date.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}
