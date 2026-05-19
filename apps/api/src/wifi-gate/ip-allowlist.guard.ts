import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface CidrRule {
  raw: string;
  network: number; // for IPv4 only — IPv6 falls back to exact-string match
  prefix: number;
  family: 'v4' | 'v6';
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

function parseRule(raw: string): CidrRule | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const [addr, prefixStr] = trimmed.split('/');
  if (addr.includes(':')) {
    // IPv6 — exact string match only (school egress is overwhelmingly v4)
    return { raw: addr, network: 0, prefix: 0, family: 'v6' };
  }
  const network = ipv4ToInt(addr);
  if (network === null) return null;
  const prefix = prefixStr ? Number(prefixStr) : 32;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  return { raw: addr, network, prefix, family: 'v4' };
}

function matches(ip: string, rule: CidrRule): boolean {
  if (rule.family === 'v6') return ip === rule.raw;
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  if (rule.prefix === 0) return true;
  const mask = rule.prefix === 32 ? 0xffffffff : (~((1 << (32 - rule.prefix)) - 1)) >>> 0;
  return (n & mask) === (rule.network & mask);
}

/** Strip "::ffff:" prefix from IPv4-mapped IPv6 (Express sometimes returns this). */
function normaliseIp(ip: string | undefined): string {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(IpAllowlistGuard.name);
  private rules: CidrRule[] = [];
  private bypassed = false;
  // 5/20 follow-up: time-bounded bypass. Set SCHOOL_IP_BYPASS_UNTIL to an
  // ISO timestamp (e.g. "2026-05-20T02:00:00Z" = 10:00 SGT) and the guard
  // returns true for every request until that moment passes. Auto-expires
  // so we can't forget to flip it back. Read at construction; one config
  // change → one deploy. If a parse fails, log loud and treat as disabled
  // (fail-secure).
  private bypassUntil: Date | null = null;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('SCHOOL_PUBLIC_IPS');
    const bypass = this.config.get<string>('SCHOOL_IP_BYPASS');
    const until = this.config.get<string>('SCHOOL_IP_BYPASS_UNTIL');
    if (bypass === 'true') {
      this.bypassed = true;
      this.logger.warn('SCHOOL_IP_BYPASS=true — IP allowlist disabled (DEV ONLY)');
      return;
    }
    if (until) {
      const parsed = new Date(until);
      if (Number.isNaN(parsed.getTime())) {
        this.logger.error(
          `SCHOOL_IP_BYPASS_UNTIL="${until}" — failed to parse as ISO timestamp; ignoring`,
        );
      } else if (parsed.getTime() <= Date.now()) {
        this.logger.warn(
          `SCHOOL_IP_BYPASS_UNTIL="${until}" — already in the past; ignoring`,
        );
      } else {
        this.bypassUntil = parsed;
        this.logger.warn(
          `SCHOOL_IP_BYPASS_UNTIL="${until}" — IP allowlist auto-bypassed until ${parsed.toISOString()}`,
        );
      }
    }
    if (!raw) {
      this.logger.error('SCHOOL_PUBLIC_IPS not set — guard fails closed (every request blocked)');
      return;
    }
    this.rules = raw
      .split(',')
      .map((s) => parseRule(s))
      .filter((r): r is CidrRule => r !== null);
    this.logger.log(`IpAllowlist loaded ${this.rules.length} rule(s)`);
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (this.bypassed) return true;
    // Time-bounded bypass — re-check on every request so the guard re-arms
    // automatically the instant the deadline passes (no service restart
    // needed). Cheap: one Date.now() vs. a cached timestamp.
    if (this.bypassUntil && Date.now() < this.bypassUntil.getTime()) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    // Express' req.ip honours the trust-proxy setting — main.ts must enable it
    // for deployments behind Railway/Cloudflare so X-Forwarded-For is read.
    const ip = normaliseIp(req.ip ?? req.socket.remoteAddress ?? '');
    if (!ip) {
      throw new ForbiddenException({ code: 'no_client_ip' });
    }
    if (this.rules.length === 0) {
      // Fail closed — better an error today than an unauthenticated scan
      // tomorrow. Operator must set SCHOOL_PUBLIC_IPS or explicitly bypass.
      throw new ForbiddenException({ code: 'allowlist_unconfigured' });
    }
    for (const r of this.rules) {
      if (matches(ip, r)) return true;
    }
    throw new ForbiddenException({ code: 'not_on_school_wifi', clientIp: ip });
  }
}
