import data from './data/official-wordlists.generated.json';

export type OfficialListName = 'ngsl' | 'nawl';

export interface OfficialWord {
  list: OfficialListName;
  rank: number;
  headword: string;
  phonetic: string;
  pos: string;
  definition: string;
}

interface WordListPayload {
  schemaVersion: number;
  license: string;
  attribution: string;
  sourceUrl: string;
  lists: Record<OfficialListName, { version: string; source: string; words: OfficialWord[] }>;
}

const payload = data as WordListPayload;

export const OFFICIAL_WORDLIST_META = Object.freeze({
  schemaVersion: payload.schemaVersion,
  license: payload.license,
  attribution: payload.attribution,
  sourceUrl: payload.sourceUrl,
});

export function officialList(name: OfficialListName): readonly OfficialWord[] {
  return payload.lists[name].words;
}

export function officialListVersion(name: OfficialListName): string {
  return payload.lists[name].version;
}

export function officialWordAt(name: OfficialListName, rank: number): OfficialWord | null {
  const list = officialList(name);
  if (!Number.isInteger(rank) || rank < 1 || rank > list.length) return null;
  const candidate = list[rank - 1];
  return candidate?.rank === rank ? candidate : list.find((word) => word.rank === rank) ?? null;
}

export function searchOfficialWords(query: string, limit = 20): OfficialWord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return (['ngsl', 'nawl'] as const)
    .flatMap((name) => officialList(name))
    .filter((word) => word.headword.includes(needle))
    .sort((a, b) => {
      const exact = Number(b.headword === needle) - Number(a.headword === needle);
      return exact || a.rank - b.rank || a.headword.localeCompare(b.headword);
    })
    .slice(0, safeLimit);
}
