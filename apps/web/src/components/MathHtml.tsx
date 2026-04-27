import { renderInline } from '../lib/latex';

export function MathHtml({ source, className }: { source: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderInline(source) }} />;
}
