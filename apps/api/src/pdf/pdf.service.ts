import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { PrismaService } from '../common/prisma.service';
import { renderPaperHtml } from './templates';

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
          include: { question: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!paper) throw new Error('Paper not found');

    const data = {
      schoolName: process.env.SCHOOL_NAME || undefined,
      paperName: paper.name,
      subjectName: paper.subject.name,
      examBoardName: paper.subject.examBoard.name,
      componentName: paper.component?.name,
      classLabel: paper.classLabel ?? undefined,
      examDate: paper.examDate?.toISOString().slice(0, 10),
      durationMin: paper.durationMin,
      totalMarks: paper.totalMarksActual,
      questions: paper.questions.map(pq => {
        const content = (pq.overrideContent ?? pq.snapshotContent) as any;
        const answer = (pq.overrideAnswer ?? pq.snapshotAnswer) as any;
        const options = pq.snapshotOptions as any;
        return {
          sortOrder: pq.sortOrder,
          questionType: pq.question.questionType,
          marks: pq.marks,
          content,
          options,
          answer,
        };
      }),
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
