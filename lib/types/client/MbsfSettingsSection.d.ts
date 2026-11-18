/** 未必记忆设置页——设置 → 「未必记忆」顶层页：上半功能开关（staged + save），下半只读运行状态。 */
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { MbsfStatusSnapshot, MemoryReport, MbsfReclaimResult } from './mbsf-remote.ts';
import type { MbsfCardFace } from './mbsf-card-controller.ts';
import { type MbsfTrimListInjected } from './MbsfTrimList.tsx';
/** 注册侧注入的 face：状态快照 + 配置卡片动作（section 渲染器装配）。 */
export interface MbsfSettingsSectionInjected {
    /** 读一份当前状态快照。 */
    snapshot: () => Promise<MbsfStatusSnapshot>;
    /** 切换一个开关（进 staged）。 */
    toggle: MbsfCardFace['toggle'];
    /** 保存所有 staged 改动。 */
    save: MbsfCardFace['save'];
    /** 放弃所有 staged 改动。 */
    discard: MbsfCardFace['discard'];
    /** 重置一个字段（清除 user 层覆盖）。 */
    resetField: MbsfCardFace['resetField'];
    /** 设置一个数值字段（进 staged）。 */
    setNumber: MbsfCardFace['setNumber'];
    /** 派发一次「重启 DSH」（只重启、不裁剪）——由独立的「重启 DSH」分区消费。 */
    restartDsh: () => Promise<{
        ok: boolean;
        detail?: string;
    }>;
    /** 只读内存侦察（当前堆占用 + 各缓存）。 */
    memoryReport: () => Promise<MemoryReport>;
    /** 释放内存：落盘 → 清缓存 → GC（2026-09-27）。 */
    reclaimMemory: () => Promise<MbsfReclaimResult>;
    /** 卡片快照（渲染器经 useMbsfCard 读取）。 */
    hooks: MbsfCardFace['hooks'];
    /** 会话历史剪裁清单（只读）。 */
    trimTargets: MbsfTrimListInjected['trimTargets'];
    /** 勾选/取消一个会话。 */
    setTrimTarget: MbsfTrimListInjected['setTrimTarget'];
    /** 删除会话（移到回收站，30 天内可恢复）。 */
    trimDelete: MbsfTrimListInjected['trimDelete'];
    /** 回收站列表。 */
    trimDeleted: MbsfTrimListInjected['trimDeleted'];
    /** 从回收站恢复。 */
    trimRestore: MbsfTrimListInjected['trimRestore'];
}
/** 完整组件 props（settings 渲染器装配）。 */
export type MbsfSettingsSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.electronicSheep'> & InjectFace<MbsfSettingsSectionInjected>;
/** 渲染未必记忆顶层设置页。 */
export declare function MbsfSettingsSection(props: MbsfSettingsSectionProps): ReactNode;
