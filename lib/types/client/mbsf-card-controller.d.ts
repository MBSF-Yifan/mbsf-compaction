/**
 * 未必记忆配置卡片的 staged form
 *
 * 平台惯例（ui-settings-plugins 的 CardForm）是「staged + save」：用户先改
 * 草稿，保存时才整批写入 settings 文档。该 CardForm 是 ui-settings-plugins
 * 的私有实现（仅导出类型，且跨包 value import 被 client bundle purity
 * gate 禁止），这里为 boolean 开关写一个等价的最小实现：切换只进 staged，
 * 保存经 scope.set 写 host（revision-fenced），读回 host 确认。
 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { SettingsScopeLike } from './settings-adapter.ts';
/** 未必记忆配置 namespace（与 host 端 status-gateway 注册的字符串一致）。 */
export declare const ESHEEP_NS = "mbsf";
/** 本卡片编辑的字段——host schema 的子集。 */
export interface MbsfSettings {
    /** 记忆浮现（注入）开关。 */
    injectEnabled?: boolean;
    /** 日期锚点注入开关（每会话每天首次 pre-step 注入「当前日期」坐标参照）。 */
    dateAnchorEnabled?: boolean;
    /** γ 自动压缩开关。 */
    autoCompact?: boolean;
    /** 重启时清理开关（剥离录像 + 剪裁日志）。 */
    restartCleanupEnabled?: boolean;
    /** 是否显示「重启 DSH」按钮。 */
    restartButtonVisible?: boolean;
    /** 🐾 浮窗活动指示器开关（默认开——2026-10-14）。 */
    activityIndicatorEnabled?: boolean;
    /** 🐾 活动文字开关（默认开——与动画独立，2026-10-14）。 */
    activityLabelEnabled?: boolean;
    /** 清理保留轮数（0 = 不剪裁；否则 >= 3）。 */
    cleanupPruneTurns?: number;
    /** 备份保留份数（0 = 不设上限）。 */
    backupKeepCount?: number;
    /** 剥离时保留最近 N 条 stream（0 = 全剥）。 */
    sessionStreamKeepCount?: number;
    /** DSH 堆上限（MB）：0 = 不注入；≥4096 = 注入（下次重启生效）。 */
    dshHeapMb?: number;
    /** 缓存自动释放开关（默认关）。 */
    autoReclaimEnabled?: boolean;
    /** 自动释放阈值（% 真实堆上限；20–95）。 */
    autoReclaimThresholdPct?: number;
    /** 压缩 tail 近因窗口（条，8–256；默认 64）。 */
    compactTailMessages?: number;
}
/** 一个开关的状态。 */
export interface BooleanFieldState {
    /** 当前有效值（staged 优先，否则 scope 解析值）。 */
    value: boolean;
    /** 保存会留下 user 层覆盖（区别于 composition base）。 */
    overridden: boolean;
}
/** 一个数值字段的状态。 */
export interface NumberFieldState {
    /** 当前有效值（staged 优先，否则 scope 解析值）。 */
    value: number;
    /** 保存会留下 user 层覆盖（区别于 composition base）。 */
    overridden: boolean;
}
/** 卡片级状态。 */
export interface MbsfCardState {
    /** false = namespace 未被 host 提供，卡片不渲染。 */
    available: boolean;
    /** scope 同步状态（诊断用——为什么不可用）。 */
    status: 'loading' | 'ready' | 'unavailable';
    /** host 文档是否接受写入。 */
    writable: boolean;
    /** 是否持有未保存的改动。 */
    dirty: boolean;
    /** 是否正在保存。 */
    saving: boolean;
    /** 上次保存是否未按 staged 落地。 */
    failed: boolean;
    /** 上次保存**读回自检失败**的字段名（空 = 全部通过）。
     *
     *  为什么要把字段名带出来：`failed` 只说明「没落地」，不说明**是哪个**。
     *  而「保存成反值」这类静默错误的排查全靠这个明细——没有它，用户只能
     *  看到「保存失败」，不知道哪个开关没生效。 */
    failedFields: string[];
    /** 记忆浮现开关。 */
    injectEnabled: BooleanFieldState;
    /** 日期锚点注入开关。 */
    dateAnchorEnabled: BooleanFieldState;
    /** γ 自动压缩开关。 */
    autoCompact: BooleanFieldState;
    /** 重启时清理开关。 */
    restartCleanupEnabled: BooleanFieldState;
    /** 是否显示「重启 DSH」按钮。 */
    restartButtonVisible: BooleanFieldState;
    /** 🐾 活动指示器开关。 */
    activityIndicatorEnabled: BooleanFieldState;
    /** 🐾 活动文字开关（与动画独立）。 */
    activityLabelEnabled: BooleanFieldState;
    /** 清理保留轮数（0 = 不剪裁）。 */
    cleanupPruneTurns: NumberFieldState;
    /** 备份保留份数（0 = 不设上限）。 */
    backupKeepCount: NumberFieldState;
    /** 剥离时保留最近 N 条 stream。 */
    sessionStreamKeepCount: NumberFieldState;
    /** DSH 堆上限（MB，0 = 不注入）。 */
    dshHeapMb: NumberFieldState;
    /** 缓存自动释放开关（默认关）。 */
    autoReclaimEnabled: BooleanFieldState;
    /** 自动释放阈值（% 真实堆上限）。 */
    autoReclaimThresholdPct: NumberFieldState;
    /** 压缩 tail 近因窗口（条）。 */
    compactTailMessages: NumberFieldState;
    /** 本机允许的堆上限（MB）——滑块上界。
     *
     *  来自 status 快照（`heap.maxMb`，引擎按物理内存算出），不是 settings
     *  字段——settings schema 里没有它。绑定前默认 8192（保守下界，见
     *  `DEFAULT_HEAP_MAX_MB`）——快照到位后由 `setHeapMax` 更新。 */
    dshHeapMaxMb: number;
    /** **实际生效**的堆上限（MB）——来自 status 快照的 `heap.limitMb`。
     *
     *  与 `dshHeapMaxMb`（本机允许的最大值）不同：这是**当前进程真正生效**的
     *  上限。App（Electron）形态实测 4192MB，而配置的 `dshHeapMb` 在该形态下
     *  不生效——自动释放的百分比阈值必须按这个值算（否则分母错，阈值失真）。
     *  0 = 快照未到位（UI 隐藏换算显示，只显示百分比）。 */
    heapLimitMb: number;
}
/** 卡片 slot 注入的动作与快照。 */
export interface MbsfCardFace {
    /** 切换一个开关（进 staged）。 */
    toggle: (field: 'injectEnabled' | 'dateAnchorEnabled' | 'autoCompact' | 'restartCleanupEnabled' | 'restartButtonVisible' | 'autoReclaimEnabled' | 'activityIndicatorEnabled' | 'activityLabelEnabled') => void;
    /** 保存所有 staged 改动。 */
    save: () => void;
    /** 放弃所有 staged 改动。 */
    discard: () => void;
    /** 重置一个字段（清除 user 层覆盖）。 */
    resetField: (field: 'injectEnabled' | 'dateAnchorEnabled' | 'autoCompact' | 'restartCleanupEnabled' | 'restartButtonVisible' | 'cleanupPruneTurns' | 'backupKeepCount' | 'sessionStreamKeepCount' | 'dshHeapMb' | 'autoReclaimEnabled' | 'autoReclaimThresholdPct' | 'compactTailMessages' | 'activityIndicatorEnabled' | 'activityLabelEnabled') => void;
    /** 设置一个数值字段（进 staged）。 */
    setNumber: (field: 'cleanupPruneTurns' | 'backupKeepCount' | 'sessionStreamKeepCount' | 'dshHeapMb' | 'autoReclaimThresholdPct' | 'compactTailMessages', value: number) => void;
    /** 卡片快照（渲染器经 useMbsfCard 读取）。 */
    hooks: {
        mbsfCard: SnapshotStore<MbsfCardState>;
    };
}
declare const FIELDS: readonly ["injectEnabled", "dateAnchorEnabled", "autoCompact", "restartCleanupEnabled", "restartButtonVisible", "autoReclaimEnabled", "activityIndicatorEnabled", "activityLabelEnabled"];
type Field = typeof FIELDS[number];
/** 数值字段（与布尔字段同走 staged + save 语义）。 */
declare const NUMBER_FIELDS: readonly ["cleanupPruneTurns", "backupKeepCount", "sessionStreamKeepCount", "dshHeapMb", "autoReclaimThresholdPct", "compactTailMessages"];
type NumberField = typeof NUMBER_FIELDS[number];
/** 所有可重置字段。 */
type AnyField = Field | NumberField;
/** cleanupPruneTurns 的合法域钳制：0 或 >= 3（落进 1、2 的输入钳到 3）。
 *  `min` 属性只能表达一个下界，区间内的空洞由本函数在 commit 时补齐。 */
export declare function normalizeCleanupPruneTurns(value: number): number;
/** compactTailMessages 的合法域钳制：8–256（与引擎侧 COMPACT_TAIL_MESSAGES_*
 *  同域——UI 侧重复一份以保持 client bundle 对引擎零依赖）。 */
export declare function normalizeCompactTailMessages(value: number): number;
/** dshHeapMb 的合法域钳制：0 或 >= 4096（落进 1..4095 的输入钳到 4096）。
 *  低于 node 默认上限（本机实测 4288MB）的注入值只会让 OOM 提前——无意义。
 *  与引擎侧 normalizeDshHeapMb 同域（UI 侧重复一份以保持 client bundle
 *  对引擎零依赖）。 */
export declare function normalizeDshHeapMb(value: number): number;
/** autoReclaimThresholdPct 的合法域钳制：20–95（与引擎侧 AUTO_RECLAIM_PCT_*
 *  同域——UI 侧重复一份以保持 client bundle 对引擎零依赖）。
 *
 *  下界 20 防「一启动就清」（启动窗口缓存在建，清了必白清）；上界 95 留安全
 *  余量（100% = 已经 OOM 了，来不及清）。 */
export declare function normalizeAutoReclaimPct(value: number): number;
/** 滑块上界的兜底值（快照到位前）——16GB 机器的引擎侧默认（物理内存 −
 *  6GB 系统保留）。快照到位后立刻被真实值替换（`setHeapMax`）。 */
export declare const DEFAULT_HEAP_MAX_MB = 10240;
/** 一个 boolean 字段的 staged form（staged + save 语义）。 */
export declare class MbsfCardController {
    private readonly scope;
    private readonly staged;
    private readonly stagedNumbers;
    private readonly listeners;
    private saving;
    private failed;
    /** 自动保存的防抖句柄（2026-11-08 一帆：设置改完自动存，不必点保存按钮）。 */
    private pendingSave;
    /** 上次保存读回自检失败的字段名（见 `MbsfCardState.failedFields`）。 */
    private failedFields;
    /** 本机堆上限（滑块上界）——由 `setHeapMax` 从 status 快照更新。 */
    private heapMaxMb;
    /** 实际生效的堆上限（MB）——由 `setHeapLimit` 从 status 快照更新。
     *  0 = 未知（快照未到位——UI 只显示百分比，不做 MB 换算）。 */
    private heapLimit;
    /**
     * @param scope - 绑定的设置作用域；`undefined` = 宿主两版 API 都没有
     *   （卡片渲染为不可用，但状态页与浮窗照常）。
     */
    constructor(scope: SettingsScopeLike<MbsfSettings> | undefined);
    /** 构建卡片快照 store（渲染器绑定）。 */
    bind(): SnapshotStore<MbsfCardState>;
    private projection;
    /** 更新滑块上界（status 快照的 `heap.maxMb` 到位后调用——引擎按物理
     *  内存算出，UI 不猜）。值未变则不发通知（防无谓重渲染）。 */
    setHeapMax(maxMb: number): void;
    /** 更新**实际生效**的堆上限（status 快照的 `heap.limitMb` 到位后调用）。
     *
     *  用于把百分比阈值换算成 MB 显示（「60% ≈ 2515 MB」）。必须用真实生效值
     *  而非配置值——App 形态下 `dshHeapMb` 不生效（实测 4192 vs 10240）。
     *  值未变则不发通知（防无谓重渲染）。 */
    setHeapLimit(limitMb: number): void;
    private numberField;
    /** 设置一个数值字段（进 staged）。 */
    setNumber(field: NumberField, value: number): void;
    /**
     * 防抖自动保存（2026-11-08 一帆：改完自动存，不必点保存按钮）。
     *
     * 为什么要防抖而不是每次立刻写：滑块/数字框在拖动时会连续触发 commit，
     * 逐次写盘既浪费又会让「保存中…」闪烁。250ms 是手感与延迟的折中——
     * 手一停就存上了，用户看不到「未保存」状态。
     */
    private scheduleSave;
    private field;
    /** 切换一个开关（staged 反相；未 staged 时相对当前解析值反相）。 */
    toggle(field: Field): void;
    /** 清除一个字段的 user 层覆盖（= 重新继承 base）。 */
    resetField(field: AnyField): void;
    /** 放弃所有 staged 改动。 */
    discard(): void;
    /** 逐字段写入 host 并读回确认；失败保留 staged 供修正。
     *
     *  ── 读回自检为什么是两层（2026-10-14 加，防「保存成反值」）──────────
     *  只查 user 层（原实现）能发现「没写进去」，但发现不了**写进去的是反值**
     *  这一类：用户按自己看到的开关状态点击，写入值由 `!current` 反相得来——
     *  若「看到的」本身是错的（解码漏字段 → 渲染回落成默认 `false`），
     *  那么用户点「关」时反相算出的是 `true`，**写进去的与意图相反，且一路
     *  静默**：`scope.set` 成功、user 层确实等于写入值、界面显示「已保存」。
     *
     *  两层自检把这条堵死：
     *    ① **user 层**：写入确实落到了用户覆盖层（原检查）；
     *    ② **解析值**：`sectionValue()` 读回来的值 = 界面显示的值 = 用户意图。
     *  两层都相等才算成功。第 ② 层是新增的那一层——它比对的正是**用户眼睛
     *  看到的那个数**，所以「显示与意图不一致」必然被抓到。
     *
     *  失败时记录**字段名**（`failedFields`）——静默错误之所以难查，就是因为
     *  只报「保存失败」而不说哪个字段。 */
    save(): Promise<void>;
    private sectionValue;
    private userLayer;
    private stored;
    private publish;
}
export {};
