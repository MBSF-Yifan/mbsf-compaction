/** 未必记忆状态页——设置 → 插件 → 「状态」tab：六块只读统计 + 版本。 */
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { MbsfStatusSnapshot } from './mbsf-remote.ts';
/** 注册侧注入的 Remote face（section 渲染器装配）。 */
export interface MbsfStatusTabInjected {
    /** 读一份当前状态快照。 */
    snapshot: () => Promise<MbsfStatusSnapshot>;
}
/** 完整组件 props（settings 渲染器装配）。 */
export type MbsfStatusTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.electronicSheep'> & InjectFace<MbsfStatusTabInjected>;
/** 渲染未必记忆只读状态页。 */
export declare function MbsfStatusTab({ snapshot, t }: MbsfStatusTabProps): ReactNode;
/** 状态页主体：版本行 + 六块统计卡片（顶层设置页与插件 tab 共用）。 */
export declare function StatusBody({ snapshot, t, showVersion }: {
    snapshot: MbsfStatusSnapshot;
    t: MbsfStatusTabProps['t'];
    showVersion?: boolean;
}): ReactNode;
