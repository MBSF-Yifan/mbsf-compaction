/**
 * 会话历史剪裁清单（设置页子区，2026-11-07）
 *
 * 「重启时清理」是**全库**开关；本清单是它的**降维形态**——勾中的会话在重启
 * 时被剪，没勾的完全不动。两档优先级（一帆 2026-11-07 定）：**全局开关开着
 * 时勾选不生效**（UI 直接说这句并把勾选框灰掉，而不是让勾选"看起来生效"）。
 *
 * 为什么要有可见清单：剪裁是**不可逆**的破坏性动作。把「哪些会话会被剪」摊开
 * 成一张表，误操作的门槛就从「记得自己勾过什么」变成了「看见勾了哪个」。
 *
 * ## 2026-11-07 二版（一帆：要筛选/排序/搜索，要完整会话名和 id）
 *
 * - **搜索**：会话 ID / 工作区路径 / 来源，空格分词 AND；只作用于显示。
 * - **筛选**：全部 / 已勾选 / 未勾选。
 * - **排序**：最近活动 / 创建时间 / 大小 / 工作区，可切正倒序。
 * - **完整显示**：工作区路径**换行显示全文**（原来是省略号 + tooltip），
 *   会话 ID **完整平铺**（原来只显前 8 位）+ 复制按钮（ID 是唯一的精确定位
 *   手段，8 位够看不够找）。
 * - **全选的作用域 = 当前视图**（筛选/搜索之后），且界面上写出来——破坏性
 *   动作不能有隐性作用域。
 *
 * ## 2026-11-07 三版（一帆：分组对齐 DSH 视图选项 + 筛选子代理/已归档 + 删除）
 *
 * - **分组**：按工作区 / 按工作区树 / 单列表——**名字和语义都抄 DSH 侧栏的
 *   视图选项**（`groupBy.workspace` / `groupBy.workspaceTree` / `groupBy.flat`），
 *   用户在一个地方学会的规矩在另一个地方照样成立。
 * - **筛选**：会话类型（全部 / 仅主会话 / 仅子代理）+ 归档三档（隐藏 / 全部 /
 *   仅归档）。注意与 DSH 的差别：DSH 侧栏**永不显示子代理**，我们的清单是盘上
 *   全量，所以「全部」就是真的全部——要看侧栏那种视图，选「仅主会话」。
 * - **删除**：只对「已归档 或 子代理」的会话开放（服务端判定，见
 *   `status-gateway.trimDeletable`），删除前弹确认框，删后进回收站 30 天，
 *   「已删除」页可恢复。
 *
 * 视图变换全在 `trim-list-view.ts`（纯函数，单独可测）；删除/恢复的落盘在
 * 引擎 `deleted-sessions.ts`。这个组件只负责画和问。
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/MbsfTrimList
 */
import { type ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { MbsfTrimDeletedResult, MbsfTrimTargets } from './mbsf-remote.ts';
/** 本组件需要的定位面（由设置页渲染器注入）。 */
export interface MbsfTrimListInjected {
    /** 拉清单（只读）。 */
    trimTargets: () => Promise<MbsfTrimTargets>;
    /** 勾选/取消一个会话。 */
    setTrimTarget: (sessionId: string, selected: boolean) => Promise<void>;
    /** 删除一个会话（引擎侧搬到回收站；失败返回原因而不是抛）。 */
    trimDelete: (sessionId: string) => Promise<{
        ok: boolean;
        deleted: string[];
        bytes: number;
        detail?: string;
    }>;
    /** 回收站列表（引擎侧顺手清理到期项）。 */
    trimDeleted: () => Promise<MbsfTrimDeletedResult>;
    /** 从回收站恢复。 */
    trimRestore: (sessionId: string) => Promise<{
        ok: boolean;
        restored: string[];
        detail?: string;
    }>;
}
/** 组件 props。 */
export type MbsfTrimListProps = PropsLocale<'settings.electronicSheep'> & MbsfTrimListInjected & {
    readonly disabled?: boolean;
    /**
     * 剪裁**总开关**（2026-11-08 一帆）：标题按钮就是它——
     * 开 = 重启时会剪（勾中的会话）；关 = 一条都不剪。
     * 不再有独立的「重启时清理」全局条目（那是它的重复形态）。
     */
    readonly trimEnabled?: boolean;
    /** 该开关是否被用户层覆盖（决定要不要画「恢复默认」）。 */
    readonly onToggleEnabled?: () => void;
    /** 勾选数量变化时通知父级（设置页用它决定"重启时要不要开进度页"）。 */
    readonly onSelectionChange?: (count: number) => void;
    /**
     * 剪裁参数行（2026-11-08 一帆：这些参数属于「会话历史剪裁」条目）。
     * 只在剪裁打开时渲染——关闭时整块让出来，只留开关和一句说明。
     */
    readonly children?: ReactNode;
};
/** 渲染剪裁清单。 */
export declare function MbsfTrimList(props: MbsfTrimListProps): ReactNode;
