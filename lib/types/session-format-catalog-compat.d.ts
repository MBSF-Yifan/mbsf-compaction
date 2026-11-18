/**
 * 会话格式 catalog 双版本兼容层 —— engine 侧接触 DSH 存储格式的统一入口。
 *
 * ── 为什么需要（2026-09-26 App 版适配）─────────────────────────────────────
 * 引擎同时要活在两个宿主里：
 *   · CLI 0.1.5（`~/.dsh`）        → catalog 当前版本 = **v3**（`session.v3.jsonl`）
 *   · App 0.1.7（`~/dsh-desktop-trial`）→ catalog 当前版本 = **v4**（`session.v4.jsonl`）
 * 两边 catalog 包的 **API 形状不同**（2026-09-26 逐行比对两包 lib/index.js 实测）：
 *
 *   ┌──────────────────────┬──────────────────────┬────────────────────────────┐
 *   │                      │ 0.1.5 catalog        │ 0.1.7 catalog              │
 *   ├──────────────────────┼──────────────────────┼────────────────────────────┤
 *   │ sessionFormatCatalog │ currentVersion = 3   │ currentVersion = 4         │
 *   │ 读 v3 日志           │ ✅ current           │ ⚠️ migration-required，但  │
 *   │                      │                      │    v3→v4 迁移要 children    │
 *   │                      │                      │    证据（缺 → unsupported） │
 *   │ historicalSession…   │ ❌ 无此导出          │ ✅ 读 v3 = current（完整）  │
 *   │ 读 v4 日志           │ ❌ unsupported       │ ✅ current                 │
 *   └──────────────────────┴──────────────────────┴────────────────────────────┘
 *
 * ── 取用策略：探测 + 兜底（零硬失败）──────────────────────────────────────
 * 构建期 catalog 被 **内联** 进 bundle（tsdown 只 external 化 peerDependencies，
 * 而 catalog 不在其中——实测 lib/index.js 无该 import）。内联副本 = 构建时
 * 引擎 node_modules 里那份（CLI 场景 = 0.1.5）。
 *
 * 因此本层在**运行时探测宿主**是否有更新的 catalog（App 场景 pnpm 会把它装到
 * 插件自己的 node_modules 下，因为 2026-09-26 起它进了 peerDependencies）：
 *   · 探测成功且版本更高 → 用它（App：拿到 v4 能力）
 *   · 探测失败/版本不高   → 用内联那份（CLI：行为与改动前完全一致）
 * ⟹ **任何情况下都有可用 catalog，不存在「探测失败 → 引擎起不来」**。
 *
 * ── 读侧选法（按目标文件头）──────────────────────────────────────────────
 *  1. `historicalSessionFormatCatalog`（0.1.7 独有）——current = v3，读 v3 是
 *     「原生」路径，不需要 children 证据；
 *  2. 宿主 catalog——0.1.5 下它就是 v3 原生；0.1.7 下是 v4（读 v4 靠它）。
 *  判定用 `readHeader` 的 status：`current` / `migration-required` 都算可读
 *  （与旧 `openLogReader` 同判据）；其余（unsupported / malformed）→ 换下一个。
 *
 * ── 写侧选法（按宿主 current，与读侧不同）────────────────────────────────
 * 写侧产物要被**宿主**读回，所以必须跟宿主 currentVersion 走，而不是跟输入
 * 文件版本走。0.1.5 宿主 → v3 行；0.1.7 宿主 → v4 行。
 *
 * ── 保守性（安全第一）────────────────────────────────────────────────────
 * 探测失败/API 形状不认识 → 一律 null（调用方按「不可读/不可写」处理——跳过该
 * 文件，绝不猜、绝不写坏）。读口 `decodeAll` 任一行失败 → null。
 */
/** catalog 读头结果（两版本形状一致的部分）。 */
interface ReadHeaderResult {
    status: string;
    storedVersion?: number;
    targetVersion?: number;
    header?: Record<string, unknown>;
    reason?: string;
}
/** 一个 catalog 的最小可用面（两版本共有）。 */
interface CatalogLike {
    currentVersion: number;
    readHeader(header: Record<string, unknown>): ReadHeaderResult;
    createRestore(header: Record<string, unknown>, opts: {
        recovery: string;
        validation: string;
    }): {
        decodeRow(row: unknown): void;
        finish(): {
            header: unknown;
            inheritedEventCount: number;
            events: unknown[];
        };
    };
    encodeCurrentHeader(header: unknown, inheritedEventCount: number): unknown;
    encodeCurrentEvent(event: unknown): unknown;
}
/**
 * 宿主 catalog（**写侧**用）：池里 currentVersion 最大的那份——产物要能被宿主
 * 读回，所以跟最高版本走。池空 → null。
 */
export declare const hostCatalog: CatalogLike | null;
/**
 * v0–v3 历史读口：0.1.7 独有导出（其 sessionFormatCatalog 本身 current = 3）。
 * 0.1.5 没有这个导出 → null。
 */
export declare const historicalCatalog: CatalogLike | null;
/**
 * 一个已打开的日志读口（单趟收集：喂完全部行才出事件）。
 * @see 旧 `session-format-v3.openLogReader` —— 语义完全一致，只是 catalog 可换。
 */
export interface CompatLogReader {
    /** 喂入全部物理行 → 返回 artifact；任一行非法即 null。 */
    decodeAll(rows: readonly unknown[]): {
        header: Record<string, unknown>;
        inheritedEventCount: number;
        events: unknown[];
    } | null;
    /** 本次读实际用的 catalog 名（诊断用）。 */
    readonly via: string;
}
/**
 * 按**目标文件头**选 catalog 开读口。
 *
 * ⚠️ 关键：`readHeader` 接受 ≠ 真能读完。0.1.7 的 v4 catalog 对 v3 头返回
 * `migration-required`（看似可读），但 `createRestore` 走 v3→v4 迁移时需要
 * **children 证据**，缺证据直接抛 → 解码失败。所以本实现**不**在 readHeader
 * 通过时就定下 catalog，而是把候选池整个带进 `decodeAll`：逐个真读，谁读出
 * 来算谁的（首读失败 → 换下一个）。这样「能读」是实测结论，不是静态推测。
 *
 * @returns 读口；池里所有 catalog 都读不出 → decodeAll 返回 null（调用方按
 *   不可读处理）。
 */
export declare function openCompatLogReader(headerObj: Record<string, unknown>): CompatLogReader | null;
/**
 * 事件数组 → **宿主**兼容行（每事件一行）+ 迁好的头行。
 *
 * ⚠️ 写侧跟宿主 current（产物要被宿主读回），与读侧的「按文件版本选」不同。
 *
 * @returns null = 头被宿主拒绝（调用方跳过写盘——绝不写坏）。
 */
export declare function encodeCompatLogRows(headerObj: Record<string, unknown>, events: readonly unknown[], inheritedEventCount?: number): {
    headerLine: string;
    rows: unknown[];
    via: string;
} | null;
/** 宿主 catalog 的当前格式版本（0.1.5 → 3；0.1.7 → 4）；探测失败 → null。 */
export declare function hostCurrentVersion(): number | null;
/** 验证器最小可用面（两版本共有；只声明我们真正调用的成员）。 */
interface OfficialVerifierLike {
    /** 逐事件校验 + 冻结（`adoptSessionEvent` 归一化——会原地改写数组）。 */
    validateStoredEvents: (meta: unknown, events: unknown, extra: undefined) => unknown;
    /** seq 从 0 起连续。 */
    assertContiguous: (id: unknown, events: unknown, from: number) => void;
}
/** `@deepseek-ai/dsh-session` 的最小可用面。 */
interface SessionLibLike {
    foldSurface: (events: unknown) => unknown;
    SessionId: (id: string) => unknown;
}
/** 官方存储验证器（取**配套 session 能力最强**的那份；解析不到 → null，
 *  调用方退回静态 import）。
 *
 *  评分用「同一基准下 `dsh-session` 的已知类型数」——这样 persistence 与
 *  session 必然取自**同一棵树**，不会出现「验证器是新的、类型表是旧的」那种
 *  自相矛盾的组合（2026-10-02 实测：单看 persistence 形状两版都合格，
 *  按基准顺序取首个会拿到 0.1.5 那份 ⟹ 仍拒新事件类型）。 */
export declare function resolveOfficialVerifier(): {
    mod: OfficialVerifierLike;
    from: string;
    path: string;
} | null;
/** 会话库（`foldSurface` / `SessionId`；取已知类型最多的那份）。
 *
 *  ⚠️ 必须与 `resolveOfficialVerifier` **配套**：persistence 的
 *  `validateStoredEvents` 内部 `import` 的是它自己那份 `dsh-session` 的
 *  `KNOWN_SESSION_EVENT_TYPES`。两份各自取到「最强」时才是自洽的一对。 */
export declare function resolveSessionLib(): {
    mod: SessionLibLike;
    from: string;
    path: string;
} | null;
/** v3→v4 关系断言器的最小可用面。 */
interface RelationshipsAssertLike {
    /**
     * **有状态重放**校验：顺序喂完整个事件流，检查 turn/step 配对、tool 生命周期、
     * surfaceOp 端点、compaction 影子范围等**跨事件关系**。
     *
     * ⚠️ 这是唯一能抓「`system/message does not match an open turn and step`」
     * 这类错误的检查（2026-10-03 事故教训）：逐行 `decodeRow` 只看单行合法性，
     * `validateStoredEvents` 也不重放 turn/step 状态，**只有它重放**。
     */
    assertReleasedV4Relationships: (artifact: unknown, knownEventTypes: unknown) => void;
}
/**
 * 关系断言器（`@deepseek-ai/dsh-session-format-v3-to-v4`）。
 *
 * **为什么需要单独解析**（2026-10-03 事故）：剪裁产物通过了闸一（结构）、
 * 逐行 `decodeRow`、以及 `verifyWithOfficial`，却在 App 打开时报
 * `system/message does not match an open turn and step` ⟹ 会话打不开。
 * 三道检查**都不重放 turn/step 状态**，而这个断言器重放。
 *
 * **配套要求**：调用时必须传**与它同一棵树**的 `KNOWN_SESSION_EVENT_TYPES`。
 * 实测（2026-10-03）：用 58 类的 `RELEASED_V3_EVENT_TYPES` 会把**健康文件**
 * 也判死（`compaction/summary shadowedSeqs do not name an exact current
 * surface span`）；换 59 类的 `KNOWN_SESSION_EVENT_TYPES` 后健康文件 ✅、
 * 变体 ❌ ⟹ 判定有效。故此处与 `resolveSessionLib()` 配套使用。
 */
export declare function resolveRelationshipsAssert(): {
    mod: RelationshipsAssertLike;
    from: string;
    path: string;
} | null;
/** 诊断：验证器实际解析到哪一份、能力几何（状态面板 / 排查用）。
 *
 *  `path` 是判读的**硬证据**（`host`/`engine` 标签只是粗分类，影子 profile
 *  等场景下会同名歧义）；`sessionTypes` / `knowsNewTypes` 是**结论**——
 *  `knowsNewTypes: false` ⟹ 剪裁必然全跳过（静默失效）。 */
export declare function verifierProbeReport(): {
    verifier: string | null;
    sessionLib: string | null;
    verifierPath: string | null;
    sessionPath: string | null;
    sessionTypes: number;
    knowsNewTypes: boolean;
};
/** 诊断快照：本次进程实际用到的 catalog 来源与版本。 */
export declare function catalogProbeReport(): {
    bundled: number | null;
    probed: number | null;
    effective: number | null;
    historical: boolean;
};
export {};
