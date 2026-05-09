import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/** Mirrors AddAssetSchema in questions.controller.ts. Kept as a copy so the
 *  test suite doesn't have to import a Nest controller (which pulls in the
 *  full DI graph). Round-7 agent-2 H-7. */
const AddAssetSchema = z.object({
  assetType: z.enum(['image', 'diagram', 'audio']),
  storageUrl: z
    .string()
    .url()
    .max(2048)
    .refine((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, { message: 'storageUrl must be an http(s) URL (no javascript:, data:, file:, etc.)' }),
  altText: z.string().max(500).optional(),
});

describe('AddAssetSchema.storageUrl', () => {
  it('accepts https://', () => {
    const r = AddAssetSchema.safeParse({
      assetType: 'image',
      storageUrl: 'https://cdn.example.com/x.png',
    });
    expect(r.success).toBe(true);
  });

  it('accepts http://', () => {
    const r = AddAssetSchema.safeParse({
      assetType: 'image',
      storageUrl: 'http://cdn.example.com/x.png',
    });
    expect(r.success).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    const r = AddAssetSchema.safeParse({
      assetType: 'image',
      storageUrl: 'javascript:alert(1)',
    });
    expect(r.success).toBe(false);
  });

  it('rejects data: URL', () => {
    const r = AddAssetSchema.safeParse({
      assetType: 'image',
      storageUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    });
    expect(r.success).toBe(false);
  });

  it('rejects file: URL', () => {
    const r = AddAssetSchema.safeParse({
      assetType: 'image',
      storageUrl: 'file:///etc/passwd',
    });
    expect(r.success).toBe(false);
  });

  it('rejects vbscript: URL', () => {
    const r = AddAssetSchema.safeParse({
      assetType: 'image',
      storageUrl: 'vbscript:msgbox(1)',
    });
    expect(r.success).toBe(false);
  });
});
