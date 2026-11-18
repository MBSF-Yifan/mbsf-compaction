/**
 * 0.1.5 会话日志格式适配层（v3）——**薄壳**，实现已迁至 `session-format-catalog-compat.ts`。
 *
 * 保留本模块是为了不动调用方（session-prune / session-health / tests 的 import 面），
 * 语义与旧实现一致；差异只有一处：catalog 从「写死内联的 0.1.5」改为
 * 「运行时探测宿主版本，取能力更强的那份」（详见 compat 模块头注释）。
 *
 * ── 历史背景（旧实现原文，保留作档案）──────────────────────────────────
 * DSH-0.1.1 的 `decodeStorageRecord` / `packChunkRuns`（`@deepseek-ai/dsh-session`）
 * 在 0.1.5 全树消失，存储格式整体换代到 v3（文件名 `session.v3.jsonl`）。
 * 0.1.5 的公开口是 `sessionFormatCatalog`：
 *
 *   读：readHeader(头对象)                        // 状态机；v0 返回 migration-required
 *        → createRestore(头对象, {recovery,validation})   // 不能跳步（物理头须过 codec 校验）
 *        → decodeRow(row) × N                      // ⚠️ 返回 void —— 单趟收集器，不产出事件
 *        → finish()                                // → { header, inheritedEventCount, events }
 *
 *   写：encodeEvent(event) × N                     // 逐事件产行
 *        + encodeHeader(header, inheritedEventCount)
 *
 * 实测（2026-09-13，真日志 session.jsonl.zstd）：v0 头经 readHeader 返回
 * `migration-required`，回传 header 已是迁好的 v3 头 ⟹ 历史日志自动迁移。
 * 实测（2026-09-26，App 0.1.7）：同一份代码在 0.1.7 宿主下经探测拿到 v4 catalog，
 * v3/v4 两种日志都能读（见 compat 模块头的两版本对照表）。
 *
 * @module mbsf-compaction/session-format-v3
 */
import { catalogProbeReport, verifierProbeReport } from './session-format-catalog-compat.ts';
/** 一次读的产物：事件序列 + 迁好的头 + 继承前缀长度（回写时要用）。 */
export interface LogArtifact {
    header: Record<string, unknown>;
    inheritedEventCount: number;
    events: unknown[];
}
/** 一个已打开的日志读口（单趟收集：喂完全部行才出事件）。 */
export interface LogReader {
    /** 喂入全部物理行 → 返回 artifact；任一行非法即 null。 */
    decodeAll(rows: readonly unknown[]): LogArtifact | null;
    /** 本次读实际用的 catalog 名（'historical' | 'host'；诊断用）。 */
    readonly via?: string;
}
/** 头对象是否被（宿主/历史）catalog 接受（current / migration-required 都算可读）。 */
export declare function openLogReader(headerObj: Record<string, unknown>): LogReader | null;
/** 事件数组 → 宿主兼容行（每事件一行）+ 迁好的头行文本。 */
export declare function encodeLogRows(headerObj: Record<string, unknown>, events: readonly unknown[], inheritedEventCount?: number): {
    headerLine: string;
    rows: unknown[];
} | null;
/** 诊断：本次进程实际用到的 catalog 来源与版本（CLI=3 / App=4）。 */
export { catalogProbeReport };
/** 诊断：官方验证器 / 会话库实际解析到哪一棵树、认多少种事件类型
 *  （2026-10-02「剪裁会话历史不生效」的可观测化——该失效**不报错**，
 *  只在 `cleanup-stats.json` 留一行 `skipped`，必须靠这个口发现）。 */
export { verifierProbeReport };
