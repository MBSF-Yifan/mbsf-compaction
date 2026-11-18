/**
 * 重启清理统一入口（2026-09-20）
 *
 * **唯一触发点 = 重启间隙**（一帆 2026-09-20 定「不要启动剪的功能，只能重启
 * 剪……最终都是重启后剪的效果才到内存里」）。本模块在 **runner 内、停 dsh
 * 之后**执行，此时是唯一全局静默窗口：
 *
 *  - 没有会话在写 ⟹ 无需 mtime 门 / 租约锁探测（那些是「启动清理」在 dsh
 *    进程内跑时才需要的活跃判据——随启动清理一并退役）
 *  - 清理后 dsh 从小日志重载 ⟹ **磁盘收益与内存收益在此合一**（启动清理剪的
 *    是磁盘，内存里的 `Session.events` 一份没少——对内存恒无效）
 *
 * 流程：剥离 stream → 剪裁日志（全库）→ 清理备份 → 官方验证（内联在剥离/
 * 剪裁里）→ 统计落盘。每一步都逐文件独立——一个文件失败不影响其它文件。
 *
 * @module mbsf-compaction/cleanup
 */
import { type Regression } from './cleanup-gates.ts';
/** 一次清理的选项（全部来自运行时配置，调用侧读好传入）。 */
export interface CleanupOptions {
    /** DSH home（`$DSH_HOME` 优先，缺省 `~/.dsh`）——会话库根。 */
    dshHome: string;
    /** 剪裁深度：**0 = 不剪裁**（只剥离）；≥3 = 至少保留最近 N 轮。 */
    turns: number;
    /** 剥离时保留最近 N 条 stream（0 = 全剥）。 */
    streamKeepCount: number;
    /** 每会话备份保留份数（**0 = 不设上限**）。 */
    backupKeep: number;
    /**
     * **只清理这些会话**（会话历史剪裁，2026-11-07）。缺省 = 全库。
     *
     * 语义：给了就只处理列表里的会话（**字面 id 匹配**，无继承），没给就是既有的
     * 全库清理——后者是设置页那个全局开关的行为，一行不改。
     * 列表为空数组 = 什么都不清（调用侧应自己先判断"有没有勾选"）。
     */
    sessionIds?: string[];
    /** 进度回调（阶段名 + 已完成 + 总数；总数未知时为 0）。 */
    onProgress?: (phase: CleanupPhase, done: number, total: number) => void;
}
/** 清理阶段（进度页显示用）。 */
export type CleanupPhase = 'strip' | 'prune' | 'backup' | 'done';
/** 一次清理的结果（写入 `cleanup-stats.json`，设置页显示）。 */
export interface CleanupResult {
    /** ISO 时刻。 */
    at: string;
    /** 触发来源——当前恒为 'restart'（唯一触发点）。 */
    trigger: 'restart';
    /** 耗时（秒，一位小数）。 */
    seconds: number;
    strip: {
        files: number;
        freedBytes: number;
        skipped: number;
    };
    prune: {
        files: number;
        freedBytes: number;
        skipped: number;
    };
    verify: {
        checked: number;
        unsupported: number;
        failed: number;
        restored: number;
        skippedNoBackup: number;
    };
    /**
     * 闸一：**独立判据**自检（2026-10-02 立，见 `cleanup-gates.ts` 头注）。
     *
     * 与 `verify` 的区别是根本性的：`verify` 走 `verifyWithOfficial`，与剪裁
     * 共享同一套「什么算可读」的假设；本字段走自带解析 ⟹ 剪裁的盲区骗不过它。
     * `audited` = 被改动文件里实际审计过的数量。
     */
    audit: {
        audited: number;
        failed: number;
        /** 失败文件与原因（截断到前 10 条，避免统计文件膨胀）。 */
        failures: {
            path: string;
            reasons: string[];
        }[];
    };
    /**
     * 闸二：健康基线比对（清理前 vs 清理后）。
     *
     * `regressions` 非空 ⟹ **有会话在本次清理中退化**，且已尝试从备份还原。
     * 这是「剪裁完所有会话都看不到」的**直接报警通道**——历史上该事故零报错。
     */
    baseline: {
        before: number;
        after: number;
        regressions: Regression[];
        restored: number;
        restoreFailed: number;
    };
    backups: {
        removed: number;
        freedBytes: number;
        remaining: number;
        remainingBytes: number;
    };
    /**
     * 逐会话剪裁记录（2026-11-07 会话历史剪裁）——设置页的「上次剪裁」读它。
     *
     * `scope: 'all'` = 全库清理（这里只列**真正被改动的**会话）；
     * `scope: 'selected'` = 按勾选清理（**勾中的每个会话都有一行**，含没剪掉的，
     * 因为「勾了却什么都没变」本身就是用户需要看到的信息）。
     */
    trim: {
        scope: 'all' | 'selected';
        sessions: {
            id: string;
            stripFiles: number;
            pruneFiles: number;
            freedBytes: number;
        }[];
    };
}
/** 清理统计文件路径（只记最近一次，新覆盖旧）。 */
export declare function cleanupStatsPath(): string;
/** 写清理统计（失败静默——统计是诊断产物，不阻断重启）。 */
export declare function writeCleanupStats(result: CleanupResult): void;
/** 读上次清理统计；无记录/损坏返回 undefined。 */
export declare function readCleanupStats(): CleanupResult | undefined;
/**
 * 执行一次完整清理（剥离 + 剪裁 + 备份清理 + 官方验证 + 统计）。
 *
 * **轮数 0 的语义**（关键）：`turns === 0` ⟹ **显式跳过剪裁**，只做剥离。
 * **不得传 `minTurns: 0` 给剪裁核心**——那是「无底线」，照样剪（见
 * `session-prune.ts` 的 `minTurns` 语义：0 = 第一个候选即采用）。
 *
 * 逐文件独立：任一文件失败只记进统计，不影响其它文件，也不阻断重启。
 */
export declare function runCleanup(options: CleanupOptions): Promise<CleanupResult>;
