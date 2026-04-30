import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { PrismaService } from '../common/prisma.service';
import { renderPaperHtml } from './templates';

const AI_IMAGE_STORE = process.env.AI_IMAGE_STORAGE_PATH
  || path.join(process.env.RENDER_STORAGE_PATH || os.tmpdir(), 'ai-images');

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger('PdfService');
  private browserPromise: Promise<Browser> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--font-render-hinting=medium',
        ],
      });
    }
    return this.browserPromise;
  }

  async exportPaper(paperId: string, type: 'paper' | 'answer_key' = 'paper'): Promise<Buffer> {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        subject: { include: { examBoard: true } },
        component: true,
        questions: {
          include: { question: { include: { assets: { orderBy: { sortOrder: 'asc' } } } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!paper) throw new Error('Paper not found');

    const questionsData = await Promise.all(
      paper.questions.map(async (pq) => {
        const content = (pq.overrideContent ?? pq.snapshotContent) as any;
        const answer = (pq.overrideAnswer ?? pq.snapshotAnswer) as any;
        const options = pq.snapshotOptions as any;
        const assets = await Promise.all(
          (pq.question.assets ?? []).map(async (a) => {
            // storageUrl: /api/question-assets/by-question/<qid>/<filename>
            // Puppeteer cannot fetch the JWT-protected route, so embed the
            // bytes as a base64 data URI read straight from disk. Mime
            // is dispatched by extension: .svg → image/svg+xml, else PNG.
            const m = a.storageUrl.match(/by-question\/([^/]+)\/([^/?]+)/);
            if (!m) return null;
            try {
              const filename = m[2];
              const abs = path.join(AI_IMAGE_STORE, m[1], filename);
              const buf = await fs.readFile(abs);
              const mime = filename.toLowerCase().endsWith('.svg')
                ? 'image/svg+xml'
                : 'image/png';
              return {
                dataUri: `data:${mime};base64,${buf.toString('base64')}`,
                alt: a.altText ?? '',
              };
            } catch (e) {
              this.logger.warn(`asset missing on disk: ${a.storageUrl} (${(e as Error).message})`);
              return null;
            }
          }),
        );
        return {
          sortOrder: pq.sortOrder,
          questionType: pq.question.questionType,
          marks: pq.marks,
          content,
          options,
          answer,
          assets: assets.filter((x): x is { dataUri: string; alt: string } => x !== null),
        };
      }),
    );

    const data = {
      schoolName: process.env.SCHOOL_NAME || undefined,
      paperName: paper.name,
      subjectName: paper.subject.name,
      examBoardName: paper.subject.examBoard.name,
      examBoardCode: paper.subject.examBoard.code,
      syllabusCode: paper.subject.code,
      subjectLevel: paper.subject.level,
      componentName: paper.component?.name,
      componentCode: paper.component?.code,
      classLabel: paper.classLabel ?? undefined,
      examDate: paper.examDate?.toISOString().slice(0, 10),
      durationMin: paper.durationMin,
      totalMarks: paper.totalMarksActual,
      questions: questionsData,
    };

    const html = renderPaperHtml(data, type === 'answer_key');
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: Number(process.env.PDF_TIMEOUT_MS || 30000) });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const b = await this.browserPromise.catch(() => null);
      if (b) await b.close().catch(() => {});
    }
  }
}
