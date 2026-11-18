#!/usr/bin/env node
/**
 * 会话当场重置 runner（独立会话执行；DSH 关停不波及本进程）
 *
 * 由 `src/session-reset.ts` 在回合收尾超上限时派发（detached + setsid）。
 * 流程：读请求 → 挂兜底守卫 → 给回合收尾 → 等日志静默 → 停 dsh → 裁剪
 * （含锚点底线）→ seq 连续性门禁 → 起 dsh → 就绪 → （重置前 goal active
 * 时）注入「继续」→ 写报告 + 记历史 + 清请求。
 *
 * **为什么住在 lib/bin 而不是 scripts/**（2026-09-10 实测事故）：DSH 通过
 * profile 的 node_modules 副本加载本引擎（`file:` 依赖复制），副本里只有
 * 包内构建产物——`scripts/` 不进副本 ⟹ 派生路径指向不存在的文件 ⟹ 静默失败
 * （请求写了、runner 没跑）。放进 `src/bin/` 后随构建落 `lib/bin/`，副本必然
 * 有它。
 *
 * 设计纪律：**任何绕过 DSH 直接写会话日志的动作，落盘前必须验证 seq 连续**
 * （DSH 读侧强制 `event.seq === events.length`，断裂会被判
 * 「complete frame contains a torn JSONL record」）。本 runner 只走
 * `pruneSessionFile`（出口经 repairPrunedTail 重编号），仍加一道独立门禁兜底。
 *
 * @module mbsf-compaction/bin/session-reset
 */
/**
 * seq 连续性门禁（与 DSH 读侧同一不变式）：逐行推进计数器，
 * 普通事件 `seq === next`、打包行 `seq0 === next` 且按成员数推进。
 * @returns 违例描述；通过返回 undefined。
 */
export declare function gateSequential(logPath: string): string | undefined;
/** runner 主流程。 */
export declare function main(): Promise<void>;
