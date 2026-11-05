import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BASE, type PassageSentenceAudio } from '../../lib/api';
import { normalizeSentence, splitSentenceRanges } from '../../lib/sentences';
import { Highlighter, SentenceSpeaker, type Highlight, type SentenceControl } from './Highlighter';

type Playable = { key: string; text: string; url: string };
type Player = { items: Playable[]; current: string | null; play(item: Playable): void };
const AudioContext = createContext<Player | null>(null);

/** One media element for the whole reading page. play() runs IN the click handler,
 * before awaiting anything, so the first tap retains iOS user activation.
 */
export function SentenceAudioProvider({ passages, children }: { passages: PassageSentenceAudio[]; children: ReactNode }) {
  const items = useMemo(() => passages.flatMap((p) => p.paragraphs.flat()
    .map((s, index) => ({ ...s, index }))
    .filter((s) => s.audioUrl != null)
    .map((s) => ({ key: `${p.passage}\u0000${s.index}`, text: s.text, url: BASE + s.audioUrl! }))), [passages]);
  const media = useRef<HTMLAudioElement>(null);
  const currentRef = useRef<Playable | null>(null);
  const request = useRef(0);
  const active = useRef(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [loop, setLoop] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  function play(item: Playable, restart = true) {
    const audio = media.current;
    if (!audio) return;
    const id = ++request.current;
    active.current = true;
    const changed = currentRef.current?.key !== item.key;
    currentRef.current = item;
    setCurrent(item.key);
    setError(false); setLoading(true);
    if (changed || !audio.getAttribute('src')) audio.src = item.url;
    audio.playbackRate = slow ? 0.75 : 1;
    audio.loop = loop;
    try {
      // Assigning currentTime before new-source metadata arrives can throw in
      // older Safari. A new src already starts at zero.
      if (!changed && (restart || audio.ended) && audio.readyState > 0) audio.currentTime = 0;
      audio.play()?.catch(() => {
        if (request.current !== id) return;
        active.current = false; setError(true); setPlaying(false); setLoading(false);
      });
    } catch { active.current = false; setError(true); setPlaying(false); setLoading(false); }
  }

  useEffect(() => {
    const audio = media.current;
    return () => { request.current++; active.current = false; audio?.pause(); };
  }, []);
  useEffect(() => {
    request.current++;
    active.current = false;
    media.current?.pause();
    currentRef.current = null;
    setCurrent(null); setPlaying(false); setLoading(false); setError(false);
  }, [items]);

  const toggle = 'min-h-12 rounded-control px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';
  return (
    <AudioContext.Provider value={{ items, current, play }}>
      {items.length > 0 && (
        <div className="bg-surface px-4 py-2" data-testid="sentence-player">
          <div className="mx-auto flex max-w-prose flex-wrap items-center gap-2 text-ink">
            <button type="button" className={`${toggle} bg-fill`} onClick={() => {
              if (playing || loading) {
                request.current++; active.current = false; media.current?.pause(); setPlaying(false); setLoading(false);
              } else play(currentRef.current ?? items[0], false);
            }}>{playing || loading ? '暂停' : '播放'}</button>
            <button type="button" aria-pressed={continuous} className={`${toggle} ${continuous ? 'bg-accent-soft text-accent' : 'text-ink-2'}`}
              onClick={() => setContinuous((v) => !v)}>往下连读</button>
            <button type="button" aria-label="慢速" aria-pressed={slow} className={`${toggle} ${slow ? 'bg-accent-soft text-accent' : 'text-ink-2'}`}
              onClick={() => { setSlow(!slow); if (media.current) media.current.playbackRate = slow ? 1 : 0.75; }}>{slow ? '0.75×' : '1×'}</button>
            <button type="button" aria-pressed={loop} className={`${toggle} ${loop ? 'bg-accent-soft text-accent' : 'text-ink-2'}`}
              onClick={() => { setLoop(!loop); if (media.current) media.current.loop = !loop; }}>单句循环</button>
            {loading && <span role="status" className="text-sm text-ink-2">正在载入声音…</span>}
            {error && <span role="alert" className="text-sm text-danger">这句暂时播放不了，请再点一次。</span>}
          </div>
          <audio ref={media} preload="none" onPlaying={() => {
            if (!active.current) { media.current?.pause(); return; }
            setPlaying(true); setLoading(false);
          }}
            onPause={() => setPlaying(false)} onError={() => { request.current++; active.current = false; setError(true); setPlaying(false); setLoading(false); }}
            onEnded={() => {
              setPlaying(false); setLoading(false);
              if (!active.current) return;
              if (loop && currentRef.current) { play(currentRef.current); return; }
              if (!continuous || !currentRef.current) { active.current = false; return; }
              const index = items.indexOf(currentRef.current);
              const next = items[index + 1];
              if (next && next.key.split('\u0000')[0] === currentRef.current.key.split('\u0000')[0]) play(next);
              else active.current = false;
            }} />
        </div>
      )}
      {children}
    </AudioContext.Provider>
  );
}

function useSentenceControls(passage: string, body: string, precedingBody = '') {
  const player = useContext(AudioContext);
  return useMemo<SentenceControl[]>(() => {
    if (!player) return [];
    const available = new Map<string, Playable[]>();
    for (const item of player.items.filter((s) => s.key.startsWith(passage + '\u0000'))) {
      const text = normalizeSentence(item.text);
      available.set(text, [...(available.get(text) ?? []), item]);
    }
    for (const s of splitSentenceRanges(precedingBody)) available.get(normalizeSentence(s.text))?.shift();
    return splitSentenceRanges(body).flatMap((s, index) => {
      const item = available.get(normalizeSentence(s.text))?.shift();
      return item ? [{ start: s.start, end: s.end, active: item.key === player.current,
        label: `朗读第 ${index + 1} 句`, onPlay: () => player.play(item) }] : [];
    });
  }, [player, passage, body, precedingBody]);
}

/** Original body stays untouched: saved highlight offsets remain valid. */
export function SentencePassage({ passage, body, precedingBody = '', ...props }: {
  passage: string; body: string; highlights: Highlight[]; onChange(next: Highlight[]): void;
  precedingBody?: string;
  onWordTap?: (word: string, range: Range) => void; testId?: string; className?: string; style?: React.CSSProperties;
}) {
  const controls = useSentenceControls(passage, body, precedingBody);
  return <Highlighter body={body} {...props} sentenceControls={controls} />;
}

/** Cloze text only: its existing input boxes stay at exactly the same positions.
 * Full-sentence boundaries are computed before slicing around [BLANK] markers.
 */
export function SentenceAudioSegment({ passage, body, start, text }: { passage: string; body: string; start: number; text: string }) {
  const controls = useSentenceControls(passage, body);
  const end = start + text.length;
  const boundaries = [...new Set([start, end, ...controls.flatMap((s) => [s.start, s.end]).filter((n) => n > start && n < end)])].sort((a, b) => a - b);
  return <>{boundaries.slice(0, -1).map((lo, i) => {
    const hi = boundaries[i + 1];
    const active = controls.some((s) => s.active && s.start <= lo && s.end >= hi);
    const ending = controls.find((s) => s.end === hi);
    return <span key={lo}><span data-sentence-active={active || undefined} className={active ? 'rounded bg-accent-soft text-accent' : undefined}>
      {body.slice(lo, hi)}
    </span>{ending && <SentenceSpeaker control={ending} />}</span>;
  })}</>;
}
