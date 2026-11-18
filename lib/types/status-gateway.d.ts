/**
 * 未必记忆状态服务（插件条目 `mbsf-status`，exports ./status）
 *
 * 把未必记忆运行状态暴露给浏览器半（设置 → 「未必记忆」状态页）与任何
 * Typert Remote 客户端：足迹 / 记忆索引 / 压缩统计 / 内容段 / 注入 /
 * 回想。数据源全部是引擎内现成的 stats 快照函数——本网关只做汇总与
 * 装配，不持有任何独立状态。
 *
 * 装配：bundle patch（cordis.patch.yml）插入一条
 *   - id: mbsf-status
 *     name: 'mbsf-compaction/status'
 * 客户端经 `ctx.remote.mbsfStatus.snapshot()` 懒调用。
 *
 * 端点注册方式（2026-08-25 vendor 化后修正）：
 * 不再用 @Remote 装饰器 + TypertRemoteService 基类——装饰器把标记写进
 * dsh-typert-protocol 模块私有的 markers WeakMap，而本插件经 vendor 副本
 * 解析该包（engine/node_modules → vendor/dsh），gateway 从 workspace 原件
 * 读取，同一进程内两个模块实例 → 标记互相隔离 → 端点 404。
 * 改为 `ctx.typert.register()` 显式注册 strict contribution（registry 官方
 * 支持的手写路径，loader 注释明示），端点在主 registry 立即可见，与
 * vendor/workspace 模块身份彻底无关。result 用透传 schema（parse 原样
 * 返回），与 ui 侧 mbsf-remote.ts 的 client 契约完全对称。
 *
 * @module mbsf-compaction/status
 */
import { Service, type Context } from '@deepseek-ai/cordis';
import { lastSummarizeStats, type FoldHistoryEntry } from 'mbsf-compaction/compaction';
import { type SessionConfigState, type SessionOverride } from './session-override.ts';
import { type CleanupResult } from './cleanup.ts';
import { type TrimCandidate } from './trim-targets.ts';
/** 完整状态快照（wire 直传——均为 JSON 可序列化数据）。 */
export interface MbsfStatusSnapshot {
    /** 插件包版本（package.json）。 */
    version: string;
    /** 脑状态总览（encoder/sessions/gamma/grayZone）。 */
    brain: Record<string, unknown>;
    /** 最近一次压缩的结构快照（null = 尚未压缩过）。 */
    lastSummarize: ReturnType<typeof lastSummarizeStats>;
    /** 压缩耗时统计（次数/EMA/最近明细）。 */
    compression: Record<string, unknown>;
    /** 折叠历史明细（compaction-log 尾部记录，最新在前）——C 方案：让压缩
     *  从「只对模型可见」变「用户可查」（2026-09-27）。 */
    compressionHistory: FoldHistoryEntry[];
    /** 上次重启清理结果（null = 从未清理过）。 */
    lastCleanup: CleanupResult | null;
    /** 备份现状（份数 + 占用），设置页显示。 */
    backups: {
        prune: {
            count: number;
            bytes: number;
        };
        strip: {
            count: number;
            bytes: number;
        };
    };
    /** **进程堆现状**（2026-09-21——设置页「重启 DSH」区显示）。 */
    heap: {
        /** 当前 V8 old-space 上限（MB）——**本进程实际生效值**（含 node 偏移）。 */
        limitMb: number;
        /** 当前已用堆（MB）。 */
        usedMb: number;
        /** 已用占上限比（0-1）——UI 画进度条。 */
        usedRatio: number;
        /** 本机允许的最大堆上限（MB）——UI 滑块上界。 */
        maxMb: number;
        /** 配置里的堆上限（MB，0 = 不注入）——下次重启 dsh 生效。 */
        configuredMb: number;
        /** **释放门槛现状**（2026-09-28，Phase D）——`isIdle()` 的实时快照。
         *
         *  两个用途：① 手动释放按钮的判据正从「会话层」（`agent.status`）收窄到
         *  「引擎层」（`isIdle()`）——本字段是该判据的可见形态，让「点了被拒」
         *  可区分「真有 mbsf 调用在途」vs「判据过粗」；② 诊断自动释放「开了却
         *  没触发」——`idle: false` 若长期成立 = 空闲窗口真的不存在（多会话并行
         *  时的已知边界），而非开关失灵。 */
        idle: {
            /** 真闲？= 无在途 mbsf 调用 ∧ 阶段空闲。 */
            idle: boolean;
            /** 在途 mbsf 调用数（>0 = 有 recall/walk/wengu/forget 在跑）。 */
            inflight: number;
            /** 当前压缩阶段（`空闲` = 无阶段在跑）。 */
            phase: string;
        };
    };
    /** **catalog 探测**（2026-09-28，Phase D）——本进程实际用的 DSH 会话格式
     *  catalog 来源与版本。会话剥离 + 剪裁（`restartCleanup`）按此决定写 v3
     *  还是 v4 行；探测不到宿主 catalog 时会保守跳过（不写坏，但也白做）。
     *
     *  判读：`effective` = 真正生效的 currentVersion（CLI=3 / App=4）；
     *  `bundled` = 构建期内联那份（恒 CLI 版）；`probed` = 运行时探测到的宿主
     *  那份（仅 App 有）；`historical` = 是否有 0.1.7 独有的
     *  `historicalSessionFormatCatalog`（能原生读 v3）。 */
    catalog: {
        /** 构建期内联的 catalog 版本（null = 未取到）。 */
        bundled: number | null;
        /** 运行时探测到的宿主 catalog 版本（null = 探测失败/无宿主）。 */
        probed: number | null;
        /** 实际生效的版本（null = 无可用 catalog）。 */
        effective: number | null;
        /** 是否有 historical catalog（0.1.7 独有——原生读 v3 的路径）。 */
        historical: boolean;
    };
    /** **验证器探测**（2026-10-02）——官方存储验证器 / 会话库实际解析到哪一棵树。
     *
     *  ── 为什么需要这个口 ─────────────────────────────────────────────────
     *  「剪裁会话历史不生效」的根因是验证器**静默**解析到了 CLI 时代 0.1.5 的
     *  检出（已知事件类型 56 种，不含 App 写的 `developer/message` /
     *  `workspace/changes`）⟹ fail-closed 把全部 v4 会话判为不可读 ⟹ 189 个
     *  文件跳过、释放 0 字节，**不报错、不崩溃**，只在 `cleanup-stats.json`
     *  留一行 `skipped`。这类失效只能靠可观测性发现。
     *
     *  判读：`verifier`/`sessionLib` = `'host'`（取自 App 自带那份，正确）/
     *  `'engine'`（取自引擎自身那份——App 形态下**危险**，那是 0.1.5）；
     *  `sessionTypes` = 已知事件类型数（**59 = App 0.2.0 正常**，56 = 落到了
     *  0.1.5）；`knowsNewTypes` = 是否认识 `developer/message`（**false 即剪裁
     *  必然全跳过**，等于该功能失效）。 */
    verifier: {
        /** 验证器来源（`'host'` = App 自带 / `'engine'` = 引擎自身 / null = 未解析到）。
         *  ⚠️ 只是**粗**分类——影子 profile 等场景下同一份文件会被两类基准解析到，
         *  判读请看 `sessionPath`。 */
        verifier: string | null;
        /** 会话库来源（同上）。 */
        sessionLib: string | null;
        /** 验证器实际解析到的**文件路径**（判读的硬证据）。 */
        verifierPath: string | null;
        /** 会话库实际解析到的文件路径。 */
        sessionPath: string | null;
        /** `dsh-session` 的已知事件类型数（59 = 0.2.0 / 56 = 0.1.5）。 */
        sessionTypes: number;
        /** 是否认识 `developer/message`（false ⟹ 剪裁会全部跳过）。 */
        knowsNewTypes: boolean;
    };
    /** **引擎加载状态**（2026-11-09）：引擎跑在 preset 域、状态网关跑在宿主域，
     *  ctx 服务互相不可见——引擎构造时写 `~/.mbsf/engine-status.json`，网关读它。
     *
     *  判读：`loaded: false` = **本进程没有未必记忆引擎**——压缩不会发生。
     *  两种成因：① preset 覆盖未生效（patch 未命中原生 standard preset）；
     *  ② DSH 大版本升级后 standard preset 结构变了（覆盖内容需要跟随更新）。
     *  UI 在「压缩」卡片顶部把这个状态显示成红色警示行。 */
    engine: {
        /** 本进程（同 pid）是否加载过引擎。 */
        loaded: boolean;
        /** 标记里的 pid（null = 文件不存在）。 */
        pid: number | null;
        /** 标记写入时间（ISO）。 */
        startedAt: string | null;
        /** 未加载时的原因说明（loaded 时 null）。 */
        note: string | null;
    };
}
/** 「重启 DSH」按钮的结果。 */
export interface MbsfRestartResult {
    /** 是否已成功派发重启。 */
    ok: boolean;
    /** 诊断细节（失败原因 / 派发时刻）。 */
    detail?: string;
}
/** 「释放内存」按钮的结果（2026-09-27）。 */
export interface MbsfReclaimResult {
    ok: boolean;
    /** 回收字节（before - after）。 */
    reclaimed: number;
    /** 清理前 / 后 heapUsed。 */
    before: number;
    after: number;
    /** GC 耗时 ms。 */
    gcMs: number;
    /** 各缓存清理前条目数（审计）。 */
    clearedEntries: Record<string, number>;
    /** 人类可读摘要。 */
    detail: string;
}
/** 清单里的一行（设置页「会话历史剪裁」）。 */
export interface MbsfTrimRow {
    /** 会话 id。 */
    id: string;
    /** 会话标题（= 首条用户消息截断到 60 字；DSH 不存标题，读不到时缺省）。 */
    title?: string;
    /** 工作区真实路径（从会话头 cwd 解出）。 */
    workspacePath: string;
    /** 日志字节数。 */
    bytes: number;
    /** 日志最后修改时刻（毫秒）。 */
    mtimeMs: number;
    /** 会话创建时刻（毫秒；读不到头时缺省）。 */
    createdAtMs?: number;
    /** 会话来源（subagent 等；便于区分"谁开的"）。 */
    origin?: string;
    /** 是否勾选。 */
    selected: boolean;
    /** 是否已归档（DSH 工作区的归档集合）。 */
    archived: boolean;
    /** 子代理会话的父会话 id（主会话缺省）。 */
    parentSession?: string;
    /**
     * 根源（主）会话是否已归档。
     *
     * 子代理**不随主会话归档**（2026-11-07 实测），所以「属于已关闭的对话」
     * 只能看根。为 true 时界面显示「随父归档」，归档筛选也把它算作已归档。
     */
    rootArchived: boolean;
    /** 祖先链断了（父会话已不在盘上）——孤儿残留。 */
    orphan: boolean;
    /**
     * 现在能不能删（**服务端算好的**，客户端只照着画）。
     *
     * 判定见 `trimDeletable`：未归档的主会话、内存里活着的会话都不可删。
     * 客户端不重算——删是破坏性动作，口径只能有一处。
     */
    deletable: boolean;
    /**
     * 不可删的原因码（可删时缺省）：
     * `active` = 未归档主会话；`parent` = 父会话还没归档；`live` = 正在运行。
     */
    deletableReason?: 'active' | 'parent' | 'live';
    /** 上次剪裁记录（null = 没剪过）。 */
    lastTrim: {
        at: string;
        stripFiles: number;
        pruneFiles: number;
        freedBytes: number;
    } | null;
}
/**
 * 删除资格（唯一口径，2026-11-07 一帆定，同日第二版）。
 *
 * 第一版把「子代理会话」当成天然可删——**错在前提**：以为归档主会话会连子代理
 * 一起归档。实测不是（归档集合里只有主会话 id），于是「父会话还开着」的子代理
 * 也亮了垃圾桶，删掉就等于把活对话的子代理历史挖掉一块。
 *
 * 现在的规则——可删 = **这个会话所属的对话已经关闭**：
 *
 * - 自身已归档 → 可删（用户亲手做过「不要了」这一步）；
 * - **根源会话已归档** → 可删（整棵树属于一个已关闭的对话，含子代理）；
 * - **孤儿**（父会话已不在盘上）→ 可删（不挂在任何活对话下面，是残留）；
 * - 其余不可删：主会话给 `active`（先归档），子代理给 `parent`（父会话还没归档）。
 *
 * 不管哪一类，**内存里活着的**（正在跑 / 正开着）一律不可删。
 *
 * 为什么要先归档：删除有 30 天备份，但归档是零成本、可即时撤销的「我确定不要
 * 它了」声明。让这两步分开，误删的门槛就从「点错按钮」变成「连着点错两次」。
 */
export declare function trimDeletable(row: {
    readonly archived: boolean;
    readonly rootArchived?: boolean;
    readonly orphan?: boolean;
    readonly parentSession?: string;
}, live: boolean): {
    deletable: boolean;
    reason?: 'active' | 'parent' | 'live';
};
/** 清单结果。 */
/**
 * 引擎行 → 线上行（**逐字段搬运**）。
 *
 * ⚠️ 这一层曾经漏过 `title`（2026-11-07 第三次「改了没生效」）：字段在引擎里算出来了，
 * 客户端也渲染了，中间这个映射却只 copy 了它认识的字段 ⟹ 界面上静默消失。
 * 抽成纯函数 + 回归测试，就是为了让「新增字段忘了搬」变成红灯而不是无声。
 */
export declare function toTrimRow(row: TrimCandidate, lastTrim: {
    at: string;
    stripFiles: number;
    pruneFiles: number;
    freedBytes: number;
} | null, live?: boolean): MbsfTrimRow;
export interface MbsfTrimTargets {
    rows: MbsfTrimRow[];
    /** 勾中数量。 */
    selectedCount: number;
    /** 勾中的字节合计（给「可腾出多少」用）。 */
    selectedBytes: number;
    /** 全局「重启时清理」是否开着（开着时勾选不生效——UI 要明说）。 */
    /** 剪裁**总开关**（2026-11-08 语义变更）：true = 重启时按勾选剪，
     *  false = 一条都不剪。旧的「全库清理」分支已移除——全库 = 全选后剪。 */
    trimEnabled: boolean;
}
/** 勾选入参。 */
export interface MbsfTrimSetInput {
    sessionId: string;
    selected: boolean;
}
/** 勾选结果。 */
export interface MbsfTrimSetResult {
    id: string;
    selected: boolean;
}
/** 删除入参。 */
export interface MbsfTrimDeleteInput {
    sessionId: string;
}
/** 删除结果（失败不抛——把原因交给界面说清楚）。 */
export interface MbsfTrimDeleteResult {
    ok: boolean;
    /** 实际搬走的会话 id（父会话 + 一起带走的子代理）。 */
    deleted: string[];
    bytes: number;
    detail?: string;
}
/** 回收站里的一条。 */
export interface MbsfDeletedRow {
    id: string;
    title?: string;
    workspacePath: string;
    origin?: string;
    parentSession?: string;
    bytes: number;
    deletedAt: string;
    expiresAt: string;
    /** 剩余天数（0 = 今天到期）。 */
    remainingDays: number;
    /** `root` = 用户点删的那个；`child` = 被一起带走的子代理。 */
    role: 'root' | 'child';
    /** 同批其它会话数（显示「另有 N 个」）。 */
    siblingCount: number;
}
/** 回收站列表。 */
export interface MbsfTrimDeletedResult {
    entries: MbsfDeletedRow[];
    /** 本次顺手永久清理掉的条数（> 0 时界面要说出来）。 */
    purged: number;
}
/** 恢复入参。 */
export interface MbsfTrimRestoreInput {
    sessionId: string;
}
/** 恢复结果。 */
export interface MbsfTrimRestoreResult {
    ok: boolean;
    restored: string[];
    detail?: string;
}
/**
 * 某会话的**全部后代**（子代理会话，含孙代）。
 *
 * 删除父会话要把整棵子树带走：只带直接子会话的话，孙代目录会变成更深的孤儿
 * （父和子都不在了，它自己还占着盘，且永远没人能恢复它的父）。
 */
export declare function descendantsOf(rows: readonly TrimCandidate[], id: string): TrimCandidate[];
/** 未必记忆状态网关：注册 cordis 服务 `mbsfStatus` + Typert Remote `snapshot`，
 *  并注册未必记忆配置 namespace（旧名 electronic-sheep——2026-09-03 改 MBSF）
 *  （UI 配置面板 → settings 文档 → watch → runtime-config 落盘 + 内存单例，
 *  压缩/注入侧逐次读取实时生效）。 */
export declare class MbsfStatusGateway extends Service {
    static inject: string[];
    /** 0.1.7 的配置表单 schema（`settings.describe()` 经此把**宿主层**的
     *  `mbsf-status` 条目暴露成一个可配置 namespace）。0.1.5 下不生效也不报错
     *  ——`schemastery@0.1.5` 没有 `volatile()`，所以构造是探测式的（见
     *  {@link buildConfigSchema}）。
     *
     *  ── 为什么需要它（2026-09-27 小爪修「配置卡打开没效果」）──────────────
     *  0.1.7 的配置表单**只**来自 `entry.fiber.runtime.Config`（dsh-settings
     *  `schema(entry)`：`entry.fiber?.runtime?.Config`，且要求是 schemastery
     *  schema——判据 `"toJSON" in schema`）。而卡片原来去找的
     *  `configForms.get('mbsf')` / `get('compaction-mbsf')` 两处都不成立：
     *    · `compaction-mbsf` 在 **preset 域**内，而 `settings.describe()` 只遍历
     *      `configEditor.configuration()`（profile 树的条目）⟹ 实测 18 个
     *      namespace 里没有任何 mbsf/compaction 条目，`get()` 拿到的 form
     *      永远 status='unavailable'；
     *    · 就算它可见，其 Config 也继承自 `BasicCompactionEngine`（压缩参数
     *      thresholdRatio/retainRatio/…），与卡片期望的 injectEnabled/
     *      autoCompact/… 字段对不上。
     *
     *  修法 = 让**宿主层**的 `mbsf-status` 条目（它确实在 profile 树里）携带
     *  这份 volatile schema。volatile 的语义正好对上卡片契约：写入经
     *  `configEditor.edit()` 落进 profile 的 `cordis.patch.yml` 且**不重启**，
     *  由 loader 的 `_commitVolatile()` 把新值推进运行中的引用
     *  （`loader/volatile-update`）。字段值的最终事实源仍是
     *  `~/.mbsf/config.json`（下面的 watch 回调调 `setRuntimeConfig`），
     *  与 0.1.5 完全同一份，两版不会漂移。
     *
     *  默认值取 `getRuntimeConfig()`（当前生效值）而非写死常量：0.1.7 的 base
     *  层就是 schema default，卡片「重置」= unset user 层回到 base——回到的
     *  应当是**用户 config.json 里的值**，否则重置会把用户的设置改掉。 */
    static Config: unknown;
    /** Gateway 消费的 typertRemote binding（validateBinding 逐字段核对；
     *  与 dsh-typert-protocol 的 bindTypertRemote 输出同构）。 */
    readonly typertRemote: {
        service: MbsfStatusGateway;
        serviceKey: string;
        namespace: string;
    };
    /** ctx.typert.register 的 disposer（dispose 时撤销端点注册）。
     *  只有一个——`<package>#<face>` 是 registry 唯一键，本包 host face
     *  全局只能注册一次，四类端点必须合并进同一 contribution。 */
    private _typertDisposer;
    /** 0.1.7 传入的配置（volatile 字段是引用，loader 就地更新）。 */
    private readonly liveConfig;
    constructor(ctx: Context, config?: unknown);
    /** 把 0.1.7 volatile 引用里的当前值同步进引擎 runtime-config。
     *
     *  @param paths - loader `loader/volatile-update` 事件报告的变更路径
     *    （`[['autoReclaimEnabled'], ['dshHeapMb']]`）。**只有出现在这里的字段
     *    才被同步**——这是防「默认值覆盖用户设置」的关键（见构造函数的说明）。
     *    省略/形状不认识 → **不同步任何字段**（宁可漏同步也不能误写）。
     *
     *  幂等且廉价：只比较报告到的几个标量，值相同则不写盘。 */
    private syncLiveConfig;
    /** 插件生命周期：撤销 Typert 端点注册（幂等；settings 的 scope 由 ctx 自动清理）。 */
    dispose(): Promise<void>;
    /** 汇总全部未必记忆运行状态。 */
    snapshot(): MbsfStatusSnapshot;
    /** 会话配置状态（含继承链来源：自身覆盖 → 父链 → 全局）。 */
    sessionState(sessionId: string): SessionConfigState;
    /** 写入（合并）会话覆盖，返回新状态。 */
    sessionSet(sessionId: string, partial: SessionOverride): SessionConfigState;
    /** 清除会话覆盖（恢复继承/全局），返回新状态。 */
    sessionClear(sessionId: string): SessionConfigState;
    /**
     * 面板「重启 DSH」按钮：派发一次只重启不裁剪的重启（2026-09-10）。
     *
     * **运行中保护（2026-09-10 事故后加）**：任何会话 `status === 'running'`
     * 时拒绝重启——重启会打断在跑的回合，而客户端可能因此卡在「运行中」假
     * 状态（9ffe1d63 实测：重启后该会话每次发送都被 cancel，
     * `turn/end reason={kind:"user"}`，UI 永远「Deep diving…」）。
     */
    restart(sessionId: string): MbsfRestartResult;
    /**
     * 立即省内存（2026-11-09 公开版）：清派生缓存（可重算的预检/锚定 Map）+ 强制 GC。
     *
     * 与内部版的区别：公开版没有记忆索引（memory-index），可清的只有压缩侧的
     * 派生缓存。清理后下次预检/锚定重新计算（多花几 ms），内存立刻下降。
     * 不删任何持久数据。
     */
    reclaimMemory(): Promise<MbsfReclaimResult>;
    /**
     * 会话历史剪裁清单（设置页）：可剪裁会话 + 勾选状态 + 上次剪裁记录。
     *
     * **只读**（不写 trim-targets.json）；每行的大小/时间来自 stat，工作区路径
     * 来自会话头第一帧（不解整份日志——大文件几百 MB）。
     */
    trimTargets(): MbsfTrimTargets;
    /** 勾选/取消一个会话（下一次重启生效；全局开关开着时勾选不生效）。 */
    setTrimTarget(input: MbsfTrimSetInput): MbsfTrimSetResult;
    /**
     * 归档集合：优先问宿主注册表（内存态、即时），拿不到再读状态文件。
     *
     * 两个来源都给同一份信息；注册表是权威，文件是兜底。任何异常都退化成
     * 「空集合」而不是抛——归档状态读不到，不该让整个清单打不开。
     */
    private archivedSessionIds;
    /** 内存里活着的会话（正在跑 / 正开着）——删除前必须避开它们。 */
    private liveSessionIds;
    /**
     * 删除一个会话（搬到回收站，30 天内可恢复）。
     *
     * **服务端重新判定**，不信客户端说的「可删」：清单是快照，用户在确认框前
     * 可能已经跑起了这个会话、或刚把它取消归档。判定口径只有 `trimDeletable`
     * 一处，这里再走一遍。
     *
     * 父会话删除会**连同名下子代理会话一起搬走**（不留孤儿目录）。
     */
    trimDelete(input: MbsfTrimDeleteInput): MbsfTrimDeleteResult;
    /** 回收站列表（只读；顺手清理超过 30 天的备份）。 */
    trimDeleted(): MbsfTrimDeletedResult;
    /** 从回收站恢复（父会话整批恢复；原位置已有同名会话时拒绝，不覆盖）。 */
    trimRestore(input: MbsfTrimRestoreInput): MbsfTrimRestoreResult;
}
export default MbsfStatusGateway;
