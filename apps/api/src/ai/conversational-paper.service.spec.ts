import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationalPaperService } from './conversational-paper.service';
import { outboundFetch } from '../common/outbound-gate';

vi.mock('../common/outbound-gate', () => ({
  isOutboundAllowed: () => true, assertOutboundAllowed: vi.fn(), outboundFetch: vi.fn(),
}));
afterEach(() => vi.unstubAllEnvs());
describe('自动组卷不可用提示', () => {
  it('没有配置客户端时给老师中文提示，且不调用外部服务', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const svc = new ConversationalPaperService({} as never, {} as never, {} as never);
    await expect(svc.generateFromMessage({ syllabusCode: 'test', message: '演示题目' }, { id: 'teacher', role: 'teacher' }))
      .rejects.toThrow('自动组卷暂时不可用。');
    expect(outboundFetch).not.toHaveBeenCalled();
  });
});
