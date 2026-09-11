import { RateLimitGuard } from './rate-limit.guard';
import { AuthGuard } from './auth.guard';

/**
 * 全局守卫及其**注册顺序** —— app.module 与守卫链测试共用这一份。
 *
 * 顺序本身是契约：
 *
 *   1. RateLimitGuard —— 最先跑，匿名暴力（登录、注册）在任何认证之前就被
 *      IP 限流挡住。按用户限流的路由它自己验签取身份（见 rate-limit.guard）。
 *   2. AuthGuard      —— 非 @Public 路由的认证、令牌生命周期、handoff 与
 *      教师只读视角的范围。
 *
 * 控制器上 `@UseGuards(StudentIdentityGuard)` 之类的守卫永远排在全局守卫
 * 之后（Nest 的固定顺序）。测试从这里取顺序，而不是自己再写一遍 ——
 * 否则「测试里的顺序」和「线上的顺序」会悄悄分岔。
 */
export const GLOBAL_GUARDS = [RateLimitGuard, AuthGuard] as const;
