import { describe, it, expect, beforeEach } from 'vitest';
import { checkSsrfSafe } from './wechat-notify.service';

describe('checkSsrfSafe (Round-7 H38)', () => {
  beforeEach(() => {
    delete process.env.WECHAT_NOTIFY_HOSTS;
  });

  it('accepts WeChat Work webhook host', () => {
    expect(checkSsrfSafe('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc')).toBeNull();
  });

  it('accepts DingTalk webhook host', () => {
    expect(checkSsrfSafe('https://oapi.dingtalk.com/robot/send?access_token=xyz')).toBeNull();
  });

  it('rejects http://localhost', () => {
    expect(checkSsrfSafe('http://localhost:8080/foo')).toContain('private/loopback');
  });

  it('rejects 127.0.0.1', () => {
    expect(checkSsrfSafe('http://127.0.0.1/foo')).toContain('private/loopback');
  });

  it('rejects AWS metadata service', () => {
    expect(checkSsrfSafe('http://169.254.169.254/latest/meta-data/')).toContain('private/loopback');
  });

  it('rejects 10.0.0.5 (private range)', () => {
    expect(checkSsrfSafe('http://10.0.0.5/foo')).toContain('private/loopback');
  });

  it('rejects 172.16.0.1 (private range)', () => {
    expect(checkSsrfSafe('http://172.16.0.1/foo')).toContain('private/loopback');
  });

  it('rejects 192.168.1.1 (home range)', () => {
    expect(checkSsrfSafe('http://192.168.1.1/foo')).toContain('private/loopback');
  });

  it('rejects file:// urls', () => {
    expect(checkSsrfSafe('file:///etc/passwd')).toContain('disallowed protocol');
  });

  it('rejects host not in allowlist (e.g. attacker.com)', () => {
    expect(checkSsrfSafe('https://attacker.com/x')).toContain('not in allowlist');
  });

  it('honours WECHAT_NOTIFY_HOSTS env override', () => {
    process.env.WECHAT_NOTIFY_HOSTS = 'webhook.school.local,internal.example.com';
    expect(checkSsrfSafe('https://webhook.school.local/foo')).toBeNull();
    expect(checkSsrfSafe('https://oapi.dingtalk.com/robot/send')).toContain('not in allowlist');
  });

  it('rejects malformed URLs', () => {
    expect(checkSsrfSafe('not a url')).toBe('invalid url');
  });
});
