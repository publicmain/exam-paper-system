import {
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../common/prisma.service';
import { PdfService } from '../pdf/pdf.service';

/**
 * Per-student paper watermarking.
 *
 * Mission:
 *   When a teacher prints / downloads a copy of a paper for one specific
 *   student, that copy must carry a unique mark identifying *which student*.
 *   Goal: deter leakage. If a watermarked PDF later turns up online, the
 *   token in the overlay resolves to one (paperId, studentId) pair via
 *   GET /watermark/lookup.
 *
 * Design:
 *   - We do NOT regenerate the PDF. We re-use PdfService.exportPaper(...)
 *     and overlay a watermark layer using pdf-lib. This keeps the original
 *     paper rendering pipeline untouched (B10 must not break PDF output for
 *     non-watermarked downloads, see paper.service.ts integration).
 *   - Token is 8-char Crockford base32 (no I, L, O, U), random 5 bytes
 *     truncated to 8 chars. ~40 bits of entropy — enough for the small
 *     population of school students; cheap to type if a leaked scan is
 *     hand-transcribed.
 *   - get-or-create: a (paper, student) pair always resolves to the SAME
 *     token across calls. This means if a student got a watermarked copy
 *     yesterday and asks for one again today, the same forensic trail
 *     applies. The unique index on (paperId, studentId) enforces this in
 *     the DB; if a race creates two rows we catch P2002 and re-read.
 *
 * pdf-lib dependency:
 *   pdf-lib is loaded with `require()` at runtime (not a top-level import)
 *   so the API still compiles & boots even if the dep isn't installed yet.
 *   download() throws 503 with a clear message if pdf-lib is missing — the
 *   blackbox test detects this and soft-fails. See MERGE_INSTRUCTIONS.md.
 */

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

// Crockford base32 alphabet — drops I/L/O/U to avoid confusion with 1/0/V.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateToken(): string {
  // 5 random bytes → 40 bits → 8 base32 chars exactly.
  const buf = crypto.randomBytes(5);
  let out = '';
  // Pack 5 bytes as a 40-bit integer (big-endian) and chunk into 8 5-bit groups.
  let acc = 0n;
  for (const b of buf) acc = (acc << 8n) | BigInt(b);
  for (let i = 0; i < 8; i++) {
    const idx = Number((acc >> BigInt((7 - i) * 5)) & 0x1fn);
    out += CROCKFORD[idx];
  }
  return out;
}

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger('WatermarkService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  /**
   * Get-or-create a token for (paperId, studentId).
   * Idempotent: repeated calls for the same pair return the same token.
   */
  async issueToken(paperId: string, studentId: string, _actor: ActorCtx) {
    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper) throw new NotFoundException('paper not found');
    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('student not found');
    if (student.role !== 'student') {
      // We deliberately allow watermarking only for students. Watermarking a
      // teacher's preview copy would be weird and would pollute the lookup
      // index used for forensics.
      throw new ForbiddenException('watermark target must be a student');
    }

    // Optional: surface the most recent assignment so the token is contextual.
    // Picks the newest matching open/closed assignment by class enrollment.
    const assignment = await this.prisma.paperAssignment.findFirst({
      where: {
        paperId,
        class: { enrollments: { some: { userId: studentId, role: 'student' } } },
      },
      orderBy: { assignedAt: 'desc' },
      select: { id: true },
    });

    // Fast path — existing token for this pair.
    const existing = await (this.prisma as any).watermarkToken.findUnique({
      where: { paperId_studentId: { paperId, studentId } },
    });
    if (existing) {
      return {
        token: existing.token,
        downloadUrl: this.buildDownloadUrl(existing.token),
        revokedAt: existing.revokedAt,
      };
    }

    // Create. Loop a few times if we hit a token collision (vanishingly rare
    // at 40 bits with O(1e3) tokens per school, but worth the guard).
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = generateToken();
      try {
        const row = await (this.prisma as any).watermarkToken.create({
          data: {
            paperId,
            studentId,
            assignmentId: assignment?.id ?? null,
            token,
          },
        });
        return {
          token: row.token,
          downloadUrl: this.buildDownloadUrl(row.token),
          revokedAt: null,
        };
      } catch (e: any) {
        // P2002 = unique violation. Could be (paperId, studentId) — race —
        // or `token` collision. Either way, re-read the row by pair and
        // return its token.
        if (e?.code === 'P2002') {
          const re = await (this.prisma as any).watermarkToken.findUnique({
            where: { paperId_studentId: { paperId, studentId } },
          });
          if (re) {
            return {
              token: re.token,
              downloadUrl: this.buildDownloadUrl(re.token),
              revokedAt: re.revokedAt,
            };
          }
          // pure token collision — try again
          continue;
        }
        throw e;
      }
    }
    throw new InternalServerErrorException('could not allocate watermark token');
  }

  /**
   * Resolve a token, fetch its paper PDF, overlay the watermark layer,
   * return the modified buffer. Throws 410 if token revoked.
   */
  async download(token: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await (this.prisma as any).watermarkToken.findUnique({
      where: { token },
      include: { student: true, paper: true },
    });
    if (!row) throw new NotFoundException('unknown token');
    if (row.revokedAt) throw new GoneException('token revoked');

    const original = await this.pdfService.exportPaper(row.paperId, 'paper');
    const stamped = await this.applyWatermark(original, {
      studentName: row.student.name,
      studentEmail: row.student.email,
      token: row.token,
      createdAt: row.createdAt,
    });
    const filename = `paper-${row.paperId}-${row.token}.pdf`;
    return { buffer: stamped, filename };
  }

  /**
   * Forensic lookup. Given a token (e.g. read off a leaked scan), return
   * which student it was issued to and on which paper / assignment.
   * Admin-only at the controller layer.
   */
  async lookup(token: string) {
    const row = await (this.prisma as any).watermarkToken.findUnique({
      where: { token },
      include: {
        student: { select: { id: true, name: true, email: true, role: true } },
        paper: { select: { id: true, name: true } },
        assignment: { select: { id: true, classId: true, assignedAt: true } },
      },
    });
    if (!row) throw new NotFoundException('unknown token');
    return {
      tokenId: row.id,
      token: row.token,
      paper: row.paper,
      student: row.student,
      assignment: row.assignment,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    };
  }

  /** Admin: revoke a token. Future downloads return 410 Gone. */
  async revoke(id: string) {
    const row = await (this.prisma as any).watermarkToken.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('token not found');
    if (row.revokedAt) return row;
    return (this.prisma as any).watermarkToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  // ----------------------------------------------------------------------

  private buildDownloadUrl(token: string): string {
    // Relative URL — caller composes with base domain. Mounting the
    // controller at /api/watermark via the global prefix.
    return `/api/watermark/download?token=${encodeURIComponent(token)}`;
  }

  /**
   * Overlay watermark layer on each page of the paper PDF.
   *   - Top-right: small "Confidential · {name} · {email}"
   *   - Center: faint, rotated 30°, big text "name + token"
   *   - Bottom-left: token + UTC date
   *
   * Uses pdf-lib via dynamic require so this module still loads even if the
   * dep is missing — download() reports a clear 503 in that case.
   */
  private async applyWatermark(
    input: Buffer,
    info: { studentName: string; studentEmail: string; token: string; createdAt: Date },
  ): Promise<Buffer> {
    // pdf-lib is loaded via runtime require so this file compiles even if the
    // dep isn't installed yet. We type the result as `any` for the same reason.
    let pdfLib: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      pdfLib = require('pdf-lib');
    } catch {
      this.logger.error(
        'pdf-lib not installed. Run `npm i pdf-lib` in apps/api. ' +
          'See apps/api/src/watermark/MERGE_INSTRUCTIONS.md.',
      );
      throw new InternalServerErrorException(
        'watermark dependency missing: pdf-lib not installed',
      );
    }

    const { PDFDocument, StandardFonts, rgb, degrees } = pdfLib;
    const doc = await PDFDocument.load(input);
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const dateStr = info.createdAt.toISOString().slice(0, 10);
    const topRight = `Confidential · ${info.studentName} · ${info.studentEmail}`;
    const bottomLeft = `${info.token} · ${dateStr} UTC`;
    const centerLine = `${info.studentName} · ${info.token}`;

    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();

      // Top-right banner (small, dark grey).
      const trSize = 8;
      const trWidth = helv.widthOfTextAtSize(topRight, trSize);
      page.drawText(topRight, {
        x: Math.max(8, width - trWidth - 12),
        y: height - 14,
        size: trSize,
        font: helv,
        color: rgb(0.25, 0.25, 0.25),
      });

      // Bottom-left token + date.
      page.drawText(bottomLeft, {
        x: 12,
        y: 10,
        size: 8,
        font: helvBold,
        color: rgb(0.25, 0.25, 0.25),
      });

      // Centered, rotated 30°, faint big text — survives crop / partial scan.
      const ctSize = 36;
      const ctWidth = helvBold.widthOfTextAtSize(centerLine, ctSize);
      // Rotate around center: pdf-lib rotates around (x, y) anchor. We pre-
      // shift x/y so the rotated baseline crosses near the page center.
      page.drawText(centerLine, {
        x: width / 2 - (ctWidth / 2) * Math.cos(Math.PI / 6),
        y: height / 2 - (ctWidth / 2) * Math.sin(Math.PI / 6),
        size: ctSize,
        font: helvBold,
        color: rgb(0.85, 0.85, 0.85),
        rotate: degrees(30),
        opacity: 0.35,
      });
    }

    const out = await doc.save();
    return Buffer.from(out);
  }
}
