/**
 * 会话级配置覆盖（sessions.json）+ 继承链解析
 *
 * 分层（2026-09-02 一帆固化——子代理/分叉会话默认继承父会话设置）：
 *  - 全局 config.json（runtime-config.ts）：新建会话的默认值。
 *  - 会话覆盖 `~/.mbsf/sessions.json`：`<sessionId>` →
 *    `{ injectEnabled?, dateAnchorEnabled? }`。当前会话无显式覆盖时沿
 *    `parentSession` 链向上找第一个覆盖；全链无 → 回落全局（返回 null）。
 *  - 生效顺序：会话显式覆盖 > 父会话链 > 全局 config.json > env 默认。
 *  - 引擎每次压缩/注入从内存单例读取（mtime 校验实时生效，无需重启）。
 *
 * parentSession 链读取：当前 agent 的 header 由调用方直接传入（免读盘）；
 * 祖先会话经 session-log-reader 读流水首帧首行（zstd 拼接帧第一帧解压）。
 *
 * @module mbsf-compaction/session-override
 */
import { type MbsfRuntimeConfig } from './runtime-config.ts';
/** 会话级覆盖字段（三个布尔开关——清理/重启等破坏性动作保持全局）。
 *
 *  2026-09-20 收缩：`sessionMemoryCeilingMb` / `sessionResetMinTurns` 随自动重置
 *  退役删除（会话级「内存上限 / 保留轮数」两行 UI 一并删除）。存量 `sessions.json`
 *  里的旧键**不主动清理**——读侧只认已知字段，旧键自然失效（不动用户数据文件）。
 *
 *  2026-09-27 加 `autoCompact`：γ 自动压缩从「只全局」升级为「可会话覆盖」——
 *  新建会话默认继承全局值，单个会话可关（长会话不想被折叠时）。 */
export interface SessionOverride {
    /** 记忆浮现（注入）开关。 */
    injectEnabled?: boolean;
    /** 日期锚点注入开关。 */
    dateAnchorEnabled?: boolean;
    /** γ 自动压缩开关（会话级；未覆盖时继承父链/全局）。 */
    autoCompact?: boolean;
    /** 压缩 tail 近因窗口（条，8–256）——本会话覆盖全局默认（2026-11-08 加）。 */
    sessionTailMessages?: number;
}
/** 会话身份（当前 agent 的 header 免读盘直接传入）。 */
export interface SessionIdentity {
    /** agent.session.id（`session-<uuid>`）。 */
    sessionId: string;
    /** 当前会话 header.parentSession（可直接读，不必走流水）。 */
    parentSessionId?: string | null;
}
/** 会话配置状态（status-gateway 端点 wire 形状）。 */
export interface SessionConfigState {
    /** 生效值（覆盖链解析后）。 */
    effective: {
        injectEnabled: boolean;
        dateAnchorEnabled: boolean;
        autoCompact: boolean;
        /** 压缩 tail 近因窗口（条，8–256）。 */
        compactTailMessages: number;
        /** 🐾 活动指示器开关（全局档，不做会话覆盖——浮窗零额外往返读取）。 */
        activityIndicatorEnabled: boolean;
        /** 🐾 活动文字开关（全局档，同上——与动画开关独立）。 */
        activityLabelEnabled: boolean;
    };
    /** 当前会话的显式覆盖（null = 未覆盖，走继承/全局）。 */
    override: SessionOverride | null;
    /** 生效来源：'session'（本会话覆盖）/ 'parent'（父链覆盖）/ 'global'（全局默认）。 */
    inheritedFrom: 'session' | 'parent' | 'global';
    /** 本会话折叠简报（A 方案——浮窗常驻压缩摘要行，2026-09-27）。
     *
     *  为什么挂在 sessionState 上而不是新开端点：浮窗本就每会话调这个端点
     *  拉开关状态，顺带带上压缩简报 = 零额外往返、零额外轮询。数据从
     *  compaction-log 按 sessionKey 过滤（同会话历次折叠累加），null = 本
     *  会话尚未折叠过。 */
    compressionBrief?: SessionCompressionBrief | null;
}
/** 本会话折叠简报（浮窗一行摘要的原料）。 */
export interface SessionCompressionBrief {
    /** 本会话累计折叠次数。 */
    folds: number;
    /** 最近一次折叠时刻（epoch ms）。 */
    lastAt: number;
    /** 最近一次折叠耗时 ms。 */
    lastMs: number;
    /** 累计压缩消息条数（compressed 求和——「减了多少条」）。 */
    compressedTotal: number;
    /** 累计归档条数。 */
    archivedTotal: number;
    /** 最近一次输入消息数。 */
    lastInputMessages: number;
}
/** 加载（mtime 校验缓存）全部会话覆盖。 */
export declare function loadSessionOverrides(): Record<string, SessionOverride>;
/** 当前会话自身的显式覆盖（不含父链）。 */
export declare function getSessionOverride(sessionId: string): SessionOverride | null;
/**
 * 写入（合并）会话覆盖并落盘。
 * @returns 写入后的完整覆盖（副本）。
 */
export declare function setSessionOverride(sessionId: string, partial: SessionOverride): SessionOverride;
/** 清除会话覆盖（恢复继承/全局）。 */
export declare function clearSessionOverride(sessionId: string): void;
/**
 * 读指定会话流水首帧首行的 header.parentSession（明文/zstd 都支持）。
 * 找不到/损坏 → null（链在此截断，回落全局）。
 */
export declare function readParentSession(sessionKey: string): string | null;
/**
 * 解析会话生效覆盖：自身 → parentSession 链 → null（回落全局）。
 * 字段级继承（2026-09-02 固化）：链上所有覆盖并集合并，近者优先——
 * 子会话只覆盖 dateAnchor 时，injectEnabled 仍继承父会话的值。
 * @param identity - 会话身份；parentSessionId 传入时免读盘（当前 agent 场景）。
 */
export declare function resolveSessionOverrideFor(identity: SessionIdentity): SessionOverride | null;
/**
 * 会话生效的运行时配置 = 全局 + 覆盖链（覆盖优先，仅三个布尔开关可被覆盖）。
 * @param global - 全局运行时配置（getRuntimeConfig() 的结果）。
 * @param identity - 会话身份。
 */
export declare function getRuntimeConfigForSession(global: MbsfRuntimeConfig, identity: SessionIdentity): MbsfRuntimeConfig;
/** 会话配置状态（端点用：生效值 + 覆盖 + 来源）。 */
export declare function sessionConfigStateFor(identity: SessionIdentity): SessionConfigState;
