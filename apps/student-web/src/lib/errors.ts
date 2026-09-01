/**
 * 服务端错误码 → 学生看得懂的话。
 *
 * 一条规矩：**不出现依赖旧触发条件的说法**。旧端的登录失败写的是
 * 「姓名或密码不对。还没注册？打开 App 时会引导注册」—— 后半句在新端
 * 是假的（新端不弹卡，注册入口在登录页上），照抄会把学生指向一个不
 * 存在的流程。
 */
import { ApiError, NetworkError } from './api';

function minutesFrom(sec: unknown): number {
  const n = typeof sec === 'number' ? sec : 900;
  return Math.max(1, Math.ceil(n / 60));
}

export function loginErrorText(e: unknown): string {
  if (e instanceof NetworkError) return '连不上服务器 —— 检查一下网络，然后再试一次。';
  if (!(e instanceof ApiError)) return '出了点问题，再试一次。';
  switch (e.body.code) {
    case 'pin_locked':
      return `连续输错太多次，已经锁住了 —— ${minutesFrom(e.body.retryAfterSec)} 分钟后再试。`;
    case 'invalid_credentials':
      return '姓名或密码不对。第一次用的话，点下面的「还没注册？」。';
    case 'student_not_found':
      return '花名册里没有这个名字 —— 确认一下有没有打错，或者找老师。';
    case 'name_required':
      return '请填姓名。';
    default:
      return e.status === 401
        ? '姓名或密码不对。第一次用的话，点下面的「还没注册？」。'
        : '出了点问题，再试一次。';
  }
}

export function registerErrorText(e: unknown): string {
  if (e instanceof NetworkError) return '连不上服务器 —— 检查一下网络，然后再试一次。';
  if (!(e instanceof ApiError)) return '出了点问题，再试一次。';
  switch (e.body.code) {
    case 'already_registered':
      return '这个名字已经注册过了 —— 直接去登录。忘了密码就找老师重置。';
    case 'student_not_found':
      return '花名册里没有这个名字 —— 确认一下有没有打错，或者找老师。';
    case 'password_too_weak':
    case 'pin_too_weak':
      return '这个密码太好猜了，换一个。';
    case 'password_too_short':
    case 'pin_too_short':
      return '密码太短了。';
    case 'name_required':
      return '请填姓名。';
    default:
      return '出了点问题，再试一次。';
  }
}

/**
 * S12O —— 自助注册的错误。
 *
 * 和上面那个 `registerErrorText` 分开写，因为**同一个词在两条路上说的
 * 不是一件事**：老的 `student_not_found` 是「花名册里没有你」，而自助
 * 注册根本不查花名册。混用会让学生按着一句不适用的话去找老师。
 */
export function selfRegisterErrorText(e: unknown): string {
  if (e instanceof NetworkError) return '连不上服务器 —— 检查一下网络，然后再试一次。';
  if (!(e instanceof ApiError)) return '出了点问题，再试一次。';
  switch (e.body.code) {
    case 'class_not_available':
      return '这个班现在不能注册 —— 请重新选择，或者问老师。';
    case 'class_not_open':
      return '这个班还没开课 —— 找老师问一下。';
    case 'level_not_offered':
      return '这个班没有开这一档 —— 换一档试试。';
    case 'level_not_allowed':
      return '请从上面三档里挑一档。';
    case 'name_taken_in_class':
      return '这个班里已经有这个名字了 —— 如果那是你，直接去登录；不是的话找老师。';
    case 'pin_must_be_6_digits':
      return '密码要正好 6 位数字。';
    case 'pin_too_weak':
      return '这个密码太好猜了（别用顺子或者六个一样的），换一个。';
    case 'name_required':
      return '请填姓名。';
    case 'rate_limited':
      return '试得太快了 —— 等一分钟再来。';
    default:
      return '出了点问题，再试一次。';
  }
}

/** S12O —— 改难度失败时说人话。 */
export function levelChangeErrorText(e: unknown): string {
  if (e instanceof NetworkError) return '连不上服务器 —— 检查一下网络，然后再试一次。';
  if (!(e instanceof ApiError)) return '没改成，再试一次。';
  switch (e.body.code) {
    case 'level_not_offered':
      return '这个班没有开这一档 —— 换一档，或者找老师。';
    case 'level_not_allowed':
      return '只能在上面三档里挑。';
    case 'class_not_open':
      return '你现在不在任何一个开课的班里 —— 找老师。';
    default:
      return '没改成，再试一次。';
  }
}

export function changePasswordErrorText(e: unknown): string {
  if (e instanceof NetworkError) return '连不上服务器 —— 检查一下网络，然后再试一次。';
  if (!(e instanceof ApiError)) return '出了点问题，再试一次。';
  switch (e.body.code) {
    case 'invalid_credentials':
      return '当前密码不对。';
    case 'pin_locked':
      return `连续输错太多次，已经锁住了 —— ${minutesFrom(e.body.retryAfterSec)} 分钟后再试。`;
    case 'password_too_weak':
    case 'pin_too_weak':
      return '新密码太好猜了，换一个。';
    case 'password_too_short':
    case 'pin_too_short':
      return '新密码太短了。';
    default:
      return '出了点问题，再试一次。';
  }
}

/**
 * 教师重置之后学生会看到的那句话。
 *
 * 重置会把 `studentAuthVersion` +1，该生所有旧令牌立刻失效
 *（`token_revoked`）。学生的下一步是**重新注册**（重置清掉了密码），
 * 所以这句话要把人指向注册，而不是让他反复试密码。
 */
export const REVOKED_NOTICE =
  '你的登录已失效 —— 可能是老师重置了你的密码。重新设一次密码就好。';
