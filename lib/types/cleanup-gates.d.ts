/**
 * 清理双闸（2026-10-02 立）——「剪裁完所有会话都看不到」的结构性防线。
 *
 * ## 为什么需要（事故复盘）
 *
 * 2026-10-02 21:55 那次清理把 9 个会话剪成了**读不出内容**的产物：
 * 剪裁把 `compaction/start` + `compaction/summary` 全部丢弃（原件 4 个 → 产物 0 个），
 * App 读侧因此拿不到任何可渲染的表面。**整个过程零报错**——
 * `cleanup-stats.json` 里 `failed: 0, restored: 0`，看起来一切正常。
 *
 * 三个教训：
 *  1. **同一个验证器不能既当运动员又当裁判**。当时的 `officialVerify` 用的是
 *     `verifyWithOfficial`，它与剪裁共享同一套「什么算可读」的假设 ⟹ 剪裁漏掉的
 *     东西它也不检查。**自检必须用独立判据**（本模块的 `auditSessionFile`）。
 *  2. **「没报错」≠「没坏」**。丢事件是**静默**的，只在用户打开会话时暴露。
 *     ⟹ 必须主动比对**清理前 / 清理后**的可读性基线。
 *  3. **体积不是成功指标**。释放 138MB 那次恰恰是坏得最狠的一次。
 *     ⟹ 判据必须是**内容完整性**（关键事件类型是否还在），不是字节数。
 *
 * ## 闸一：剪裁后自检（`auditSessionFile`）
 *
 * 对**被改动过的每个文件**跑独立判据：
 *  · 结构：zstd 帧可逐帧解、首帧是独立 header（一行）、无 torn tail；
 *  · 内容：关键事件类型（`compaction/start`、`compaction/summary`）若**改前有**
 *    则**改后必须仍有**——这条直接命中本次事故；
 *  · seq：连续无断口。
 *
 * ## 闸二：健康基线（`captureBaseline` / `compareBaseline`）
 *
 * 清理**前**记录全库每个会话的可读性 + 关键事件计数；清理**后**再测一遍，
 * 逐个对比。任何文件从「可读」变「不可读」、或关键事件数下降 ⟹
 * **报警 + 自动从备份还原**（备份恒开，还原路径已存在）。
 *
 * 两道闸都**不依赖** `verifyWithOfficial`：本模块自带解析，避免与剪裁共享盲区。
 */
/** 单文件审计结果。 */
export interface FileAudit {
    /** 文件绝对路径。 */
    path: string;
    /** 结构 + 内容是否全部通过。 */
    ok: boolean;
    /** 不通过的原因（ok=true 时缺省）。 */
    reasons: string[];
    /** 逻辑事件条数。 */
    events: number;
    /** zstd 帧数。 */
    frames: number;
    /** 关键事件计数（类型 → 条数）——基线比对用。 */
    critical: Record<string, number>;
    /** 全部事件类型计数——诊断用。 */
    types: Record<string, number>;
    /** 警告（不判死）——需基线比对确认的形态线索。 */
    warnings?: string[];
    /**
     * 回合饱满度（2026-11-02 立——「结构合法但语义被抽空」的独立判据）。
     *
     * 事故形态：剪裁把 `assistant/message` 全部丢弃、只留 `user/message`，
     * 产出 605 个「只有用户提示、没有助手回复」的空回合。文件结构完全合法
     * （turn/step/tool 配对全过、关系重放全过、`ok: true`），但前端渲染不出
     * 任何气泡 ⟹ 用户点开会话是一片空白，只剩「加载更早」且点不动。
     *
     * 这正是本模块头注教训 1 的重演：**同一个验证器不能既当运动员又当裁判**。
     * 关系重放只问「事件配对合法吗」，不问「这一回合里有内容吗」。
     */
    turns: TurnCoverage;
}
/**
 * 回合饱满度——「有回合、但回合里没有助手回复」的计数。
 *
 * 判据来源（2026-11-02 实测）：受损会话 608 回合中 605 个无 `assistant/message`，
 * 且这些回合的 `user/message` 内容清一色是 `<goal_round>` 自动轮次提示。
 * 健康会话对照：`a287c0b1` 15 回合 / 0 空（从未被剪裁）。
 */
export interface TurnCoverage {
    /** `turn/start` 计数。 */
    total: number;
    /** 其中不含任何 `assistant/message` 的回合数。 */
    empty: number;
    /** `assistant/message` 总条数（跨全部回合）。 */
    assistantMessages: number;
}
/**
 * 审计一个会话文件（**独立判据**——不经过 `verifyWithOfficial`）。
 *
 * 永不抛错：任何异常都折成 `ok: false` + `reasons`，便于基线比对时逐个报告。
 */
export declare function auditSessionFile(path: string): FileAudit;
/** 全库会话文件枚举（只找 `session.v4.jsonl.zstd`）。 */
export declare function listSessionFiles(dshHome: string): string[];
/** 清理前捕获的健康基线（会话路径 → 审计结果）。 */
export interface HealthBaseline {
    /** 捕获时刻（ISO）。 */
    at: string;
    /** 路径 → 审计。 */
    files: Record<string, FileAudit>;
}
/** 捕获基线（**清理前**调用）。 */
export declare function captureBaseline(dshHome: string): HealthBaseline;
/** 基线比对的一条退化记录。 */
export interface Regression {
    path: string;
    kind: 'unreadable' | 'critical-lost' | 'seq-gap' | 'vanished' | 'frame-collapse' | 'turns-emptied';
    detail: string;
}
/**
 * 基线比对（**清理后**调用）——闸二的核心。
 *
 * 只报**退化**（改前好、改后坏）。改前就坏的文件不报（不是我们弄坏的，
 * 与 `isOfficiallyReadable` 预检的「不白做」语义一致）。
 */
export declare function compareBaseline(baseline: HealthBaseline, _dshHome: string): Regression[];
