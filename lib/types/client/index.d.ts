/**
 * 未必记忆设置面（浏览器半）——装配一条顶层设置页贡献：
 *
 * 「设置 → 未必记忆」顶层页：上半功能开关（记忆浮现 / γ 自动压缩，staged +
 * save），下半只读六块统计（Remote `mbsfStatus`）。
 *
 * Remote 契约手写于 mbsf-remote.ts（engine 是独立仓库，无法在 client 侧
 * import 其生成物；host 端 status-gateway 的 `@Remote('snapshot')` 与这里
 * 的 descriptor 是同一契约的两个半）。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { UseProjection } from '@deepseek-ai/dsh-api-session-controller/client';
import { type MbsfLocaleKey } from './locales.ts';
export type { MbsfSettingsSectionInjected, MbsfSettingsSectionProps } from './MbsfSettingsSection.tsx';
export type { MbsfStatusTabInjected, MbsfStatusTabProps } from './MbsfStatusTab.tsx';
export type { MbsfCardFace } from './mbsf-card-controller.ts';
export type { MbsfLocaleKey } from './locales.ts';
export type { MbsfStatusSnapshot } from './mbsf-remote.ts';
export type { MbsfFloatingPanelProps } from './MbsfFloatingPanel.tsx';
export type { SessionSwitchesInjected, SessionSwitchesState } from './SessionSwitches.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** MBSF settings surface copy. */
        'settings.electronicSheep': MbsfLocaleKey;
    }
    /** 浮窗按钮的 owner 共享（与官方 InputZone 结构兼容；本组件只读注入 hooks，不用 owner 字段）。 */
    interface MbsfInputZone {
        readonly session: unknown;
        readonly input: unknown;
        /**
         * 会话 id ✓ —— 框架对 `scope: 'session'` 的槽位会供上它 ✓，但 0.1.5 的
         * `SessionStandardProps` 在 vendor 类型里是**空壳** ✗（靠运行时包增量合并 ✓
         * 而我们没把那些包纳入编译 ✗）⟹ 插件侧自行声明 ✓（2026-09-14：不补则
         * `props.sessionId` 报 TS2551 ✓）。
         */
        readonly sessionId: string;
        /**
         * 活动投影读取面（🐾 活动指示器用，2026-10-14）。
         *
         * **为什么也在这里声明**（而不是靠 `dsh-client-ui-session/client` 的
         * declare-merge）：`.runtime` 里的 `dsh-client-ui-session` **解析不到**
         * `@deepseek-ai/dsh-client-ui-slots`（该包不在 `.runtime` 的 node_modules，
         * 实测 MODULE_NOT_FOUND）⟹ 它的 `declare module '@deepseek-ai/dsh-client-ui-slots'`
         * 增强落不到我们编译时看到的那份 `SessionStandardProps` 上（probe 实测
         * `'useProjection' extends keyof SessionStandardProps` = **NO**）⟹ 与
         * `sessionId` 完全同因同治：**插件侧自行声明**。
         *
         * 运行时无影响：框架按 `scope: 'session'` 无条件供上该 hook（ui-session
         * 的运行时实现不依赖类型合并），这里只是补编译期可见性。
         *
         * 类型取官方 `UseProjection`（`dsh-api-session-controller/client` 可解析），
         * 不手抄形状——官方签名变了这里跟着变。 */
        readonly useProjection: UseProjection;
    }
    interface SlotMap {
        /**
         * 未必记忆浮窗 seat（官方 `conversation.input.left` 渲染位——composer
         * 工具行左侧常驻小控件）。vendor 闭包不含 ui-conversation 类型（ui/
         * 未 import 它），插件侧自行 declare 合并——字符串名与官方渲染位
         * renderSlot('conversation.input.left') 一致即可对接。
         */
        'conversation.input.left': {
            kind: 'list';
            scope: 'session';
            owner: MbsfInputZone;
        };
        /** 设置 → 插件 → 可配置 tab 的一张卡片（形状照 0.1.5 官方 slot-contract ✓ keyed/root）。 */
        'settings.plugin.item': {
            kind: 'keyed';
            scope: 'root';
            owner: unknown;
        };
        /** 设置页插件区 tab（官方 0.1.5: list/root ✓）。 */
        'settings.plugins.tab': {
            kind: 'list';
            scope: 'root';
            owner: unknown;
        };
        /** 设置页顶层分区（官方 0.1.5: list/root ✓）。 */
        'settings.section': {
            kind: 'list';
            scope: 'root';
            owner: unknown;
        };
    }
}
/** Dictionary namespace owned by this plugin. */
export declare const NS = "settings.electronicSheep";
/** 0.1.7 的配置命名空间 = 引擎状态网关在 profile 里的 **loader entry id**
 *  （`- id: mbsf-status`）。0.1.7 的 settings 文档按 entry id 索引 namespace
 *  （`describe()` 里 `ns: entry.options.id`），而 schema 来自该 entry 的
 *  `static Config`（`MbsfStatusGateway.Config`）。
 *
 *  为什么不是 'mbsf'：那是 **0.1.5** 的 namespace——引擎在 0.1.5 下经
 *  `settings.register('mbsf', …)` 自报的名字，与宿主装配的 entry id 无关。
 *  两版用两个名字是结构使然（0.1.5 由插件自报、0.1.7 由宿主装配决定），
 *  所以适配层收 `{ legacy, modern }` 两个值。
 *
 *  ⚠️ 必须与 profile 里 `mbsf-status` 那一行的 id 保持一致；改装配 id 要
 *  同步改这里（否则卡片退回 `status: 'unavailable'`）。 */
export declare const MBSF_STATUS_ENTRY_ID = "mbsf-status";
/**
 * Services required by the Settings registration and the mounted Remote.
 *
 * ⚠ `settingsScope` **刻意不在这里**（2026-09-27 小爪）。它是 0.1.5 的客户端
 * 设置服务；app 版（DSH 0.1.7-rc.2）没有它。Cordis 的 `Fiber._refresh()` 逐
 * 个检查 `Object.keys(this.inject)`，缺一个就永远停在 `INACTIVE` —— 这正是
 * 2026-09-26 app 启动日志里那条
 * `@deepseek-ai/dsh-client-ui-settings-mbsf: pending (waiting for service: settingsScope)`
 * 的根因，整条插件（含状态页、🐾 浮窗）因此从未激活。
 *
 * 改成运行时用 `ctx.get` 探测（无 inject 守卫，取不到即 undefined），
 * 由 settings-adapter 决定走 0.1.5 的 settingsScope 还是 0.1.7 的 configForms。
 */
export declare const inject: string[];
/**
 * Mount the MBSF Remote, then contribute the top-level settings
 * section (switches + status).
 * @param ctx - the browser plugin context.
 * @returns disposer after the Remote contribution and the section entry.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
