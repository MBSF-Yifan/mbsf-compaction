/**
 * 未必记忆浮窗（🐾）——会话级注入开关的显式落点
 *
 * 挂官方 `conversation.input.left`（composer 工具行左侧常驻小控件 seat——
 * 官方 slots.ts 注释明说它是「the seat for a small always-visible
 * control」）：🐾 按钮点击展开浮窗面板，内含记忆浮现 / 日期锚两个会话级
 * 开关 + 继承来源 + 会话 ID。
 *
 * 为什么不用「选项卡环 trailing」：官方 ui-conversation 没有该渲染位
 * （2026-09-02 验证——插件侧 declare 的 slot 名 shell 不 renderSlot，组件
 * 永不渲染）。input.left 是官方声明并渲染的 seat，零官方源码改动。
 *
 * 开关逻辑与 SessionSwitches 共用 SessionSwitchesController（会话配置覆盖
 * 链：本会话覆盖 > 父会话链 > 全局 config.json；切换即写 host 即时生效）。
 * 远程不可用 → available=false → 不渲染按钮（静默降级，不阻塞工具行）。
 */
import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionSwitchesInjected } from './SessionSwitches.tsx';
/**
 * 浮窗组件完整 props：官方 input.left runtime + 本包 locale + 开关注入面。
 *
 * `useProjection` 来自官方 `SessionStandardProps`（slot `scope: 'session'`
 * 时框架自动供上；类型由 `dsh-client-ui-session/client` 的 declare-merge
 * 提供——本包 client/index.ts 已 `import type {}` 引入该增强）。
 */
export type MbsfFloatingPanelProps = PropsRuntime<'conversation.input.left'> & PropsLocale<'settings.electronicSheep'> & InjectFace<SessionSwitchesInjected>;
/** 🐾 浮窗按钮：点击展开会话级开关面板；再点 / 点外部 / Esc 关闭。 */
export declare function MbsfFloatingPanel(props: MbsfFloatingPanelProps): ReactNode;
