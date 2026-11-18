/**
 * 会话级注入开关——控制器与类型（UI 落点见 MbsfFloatingPanel 🐾 浮窗）
 *
 * 会话配置覆盖（2026-09-02 一帆固化——子代理/分叉会话默认继承父会话设置）：
 *  - 两个开关：记忆浮现（injectEnabled）、日期锚（dateAnchorEnabled）。
 *  - 即时保存：切换即经 sessionConfig/set 写 host（sessions.json），回读
 *    确认生效值。
 *  - 继承指示：effective 值来自本会话覆盖时显示开关；来自父链/全局时显示
 *    「继承」badge，点击开关即为本会话写入覆盖（反相生效值）。
 *  - 引擎解析链：会话显式覆盖 > parentSession 链 > 全局 config.json。
 *
 * 2026-09-02 落点修正：原「选项卡环 trailing seat」在官方 ui-conversation
 * 无渲染位（插件侧 declare 的 slot 名 shell 不 renderSlot，组件永不渲染），
 * UI 已迁至官方 `conversation.input.left` 浮窗（MbsfFloatingPanel）；
 * 本文件保留控制器/状态类型供两处共用。
 *
 * Remote 契约与 engine status-gateway 的 STATUS_CONTRIBUTION 对称
 * （见 mbsf-remote.ts）。远程不可用 → available=false → UI 不渲染。
 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol';
import type { SessionConfigState } from './mbsf-remote.ts';
import type { BrandLocaleFace } from './brand.ts';
/** 会话开关快照（渲染器经 useSessionSwitches 读取）。 */
export interface SessionSwitchesState {
    /** false = 远程不可用，组件不渲染。 */
    available: boolean;
    /** 首次拉取中。 */
    loading: boolean;
    /** 写入中（防连点）。 */
    saving: boolean;
    /** 上次读写未落地。 */
    failed: boolean;
    /** 生效值（覆盖链解析后）。 */
    effective: {
        injectEnabled: boolean;
        dateAnchorEnabled: boolean;
        autoCompact: boolean;
        /** 🐾 活动指示器开关（全局档，不可会话覆盖——浮窗零额外往返读取）。 */
        activityIndicatorEnabled: boolean;
        /** 🐾 活动文字开关（全局档，同上——与动画开关独立）。 */
        activityLabelEnabled: boolean;
    };
    /** 生效来源：'session'（本会话覆盖）/ 'parent'（父链）/ 'global'（全局）。 */
    inheritedFrom: 'session' | 'parent' | 'global';
    /** 本会话折叠简报（A 方案——🐾 浮窗常驻压缩摘要行；null = 未折叠过）。
     *  同一次 sessionState 往返顺带取回，无额外请求（2026-09-27）。 */
    compressionBrief: SessionConfigState['compressionBrief'];
}
/** 会话级可覆盖字段（与引擎 SessionOverride 的键一一对应）。 */
export type SessionSwitchField = 'injectEnabled' | 'dateAnchorEnabled' | 'autoCompact';
/** 会话开关注入面（slot entry inject 产出）。 */
export interface SessionSwitchesInjected {
    hooks: {
        sessionSwitches: SnapshotStore<SessionSwitchesState>;
    };
    toggle: (field: SessionSwitchField) => void;
    clear: () => void;
    /** 语言面——浮窗按钮的 logo 按界面语言切换（2026-11-07）。 */
    brandLocale: BrandLocaleFace;
}
type SessionConfigRemote = TypertRemoteNamespaceMap['mbsfStatus'];
type Field = SessionSwitchField;
/** 一个会话的开关控制器：持有 Remote + sessionId，即时读写并广播快照。 */
export declare class SessionSwitchesController {
    private readonly remote;
    private readonly sessionId;
    private readonly listeners;
    private state;
    /** 请求序号：并发刷新只采纳最新（去抖过期响应）。 */
    private seq;
    constructor(remote: SessionConfigRemote | undefined, sessionId: string);
    /** 构建快照 store 并触发首拉。 */
    bind(): SnapshotStore<SessionSwitchesState>;
    /** 把一次「全局档位可能变了」的信号接进来（订阅设置文档的变更）。
     *
     *  ── 为什么需要（2026-10-14 修「关掉还在动」的第三个成因）──────────────
     *  `bind()` 只在**首次挂载**时拉一次 `sessionState`，之后再不刷新。而
     *  `activityIndicatorEnabled` / `activityLabelEnabled` 是**全局档**（不做
     *  会话覆盖，见 session-override.ts），改它们走的是设置页 → settings 文档
     *  → 引擎 runtime-config 那条路——**与浮窗的 Remote 拉取无关**。
     *
     *  ⟹ 结果：用户在设置页关掉动画，浮窗**毫不知情**，`state.effective` 还是
     *  挂载那一刻的旧值，动画照旧播——「关掉了还在动」。这不是渲染 bug，是
     *  **状态新鲜度**问题：数据源变了，消费方没有重新取。
     *
     *  ── 为什么刷两次（不是一次）────────────────────────────────────────
     *  写入链路是**跨层**的，有先后：
     *    设置页 → settings 文档（`scope.set` 解析）
     *           → loader `_commitVolatile()` 更新 volatile 引用
     *           → 引擎 `syncLiveConfig()` → `setRuntimeConfig()` 更新内存单例
     *  `sessionState()` 读的是**最后那步**的内存单例。若 `scope.set()` 一解析
     *  就立刻拉，可能拿到**同步尚未完成**的旧值（时序取决于 loader 实现，不是
     *  契约保证的）。
     *
     *  所以：**立即拉一次**（快路径——多数情况下同步已完成）+ **延迟再拉一次**
     *  （兜底——覆盖「同步稍后完成」）。两次都是单次往返，且只在用户改配置时
     *  发生（不是轮询）；设置改动本就低频，多一次往返换确定性，值得。 */
    watchSettings(scope: {
        subscribe(listener: () => void): () => void;
    } | undefined): void;
    /** 拉取最新会话配置状态。 */
    refresh(): Promise<void>;
    /** 切换一个开关（写覆盖，即时生效）。 */
    toggle(field: Field): Promise<void>;
    /** 清除本会话覆盖（恢复继承/全局）。 */
    clear(): Promise<void>;
    /** 应用 host 返回的配置状态（可用即消除失败标记）。 */
    private apply;
    private publish;
}
export {};
