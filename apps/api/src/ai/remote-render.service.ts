import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const PDF_WORKER_URL = process.env.PDF_WORKER_URL || '';

/**
 * HTTP client for diagram-rendering endpoints exposed by the Python
 * pdf-worker microservice. Used for diagram types whose libraries only
 * exist in Python (schemdraw for circuits today; RDKit for chemistry
 * later). Anything that can be rendered in pure TypeScript stays in
 * SvgDiagramService — this service is for cross-language deps only.
 */
@Injectable()
export class RemoteRenderService {
  private readonly logger = new Logger('RemoteRender');

  /** Render an electrical circuit via schemdraw on the pdf-worker.
   *  Returns the SVG body as a string. */
  async renderCircuit(elements: Array<{
    type: string;
    label?: string;
    direction?: 'right' | 'left' | 'up' | 'down';
    length?: number;
    flip?: boolean;
    reverse?: boolean;
  }>): Promise<string> {
    if (!PDF_WORKER_URL) {
      throw new ServiceUnavailableException('PDF_WORKER_URL not configured');
    }
    if (!elements?.length) {
      throw new BadRequestException('circuit has no elements');
    }
    const url = `${PDF_WORKER_URL.replace(/\/$/, '')}/render_circuit`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ elements }),
      });
    } catch (e: any) {
      throw new ServiceUnavailableException(`pdf-worker network error: ${String(e?.message ?? e).slice(0, 200)}`);
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ServiceUnavailableException(
        `pdf-worker /render_circuit ${resp.status}: ${text.slice(0, 300)}`,
      );
    }
    const body = await resp.json() as { svg?: string };
    if (!body.svg) {
      throw new ServiceUnavailableException('pdf-worker returned no svg');
    }
    return body.svg;
  }
}
