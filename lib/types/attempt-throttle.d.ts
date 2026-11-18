/** idle 折叠：认领 (agent, surface 末节点 seq) —— 已认领过则返回 false（跳过）。 */
export declare function claimIdleThrottle(agent: object, seq: number): boolean;
/** 已认领的 idle 位置（只读——调用方原有的「未前进则跳过」判断）。 */
export declare function idleThrottleOf(agent: object): number;
/** 回合收尾兜底：认领 (agent, surface 末节点 seq) —— 同一状态位置只压一次。 */
export declare function claimTurnStopAttempt(agent: object, seq: number): boolean;
/** user-message 折叠：认领 (agent, 回合号) —— 同一回合只压一次。 */
export declare function claimUserTurnFold(agent: object, turn: number): boolean;
/** 已折叠的回合号（只读——调用方原有的 `!== turn` 判断）。 */
export declare function userTurnFoldedOf(agent: object): number | undefined;
/** 测试用：清空认领表（仅测试调用，生产路径不调用）。 */
export declare function _resetAttemptThrottleForTest(): void;
