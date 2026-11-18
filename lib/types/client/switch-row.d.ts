/** 未必记忆开关行——staged form 的布尔开关 UI（原生 checkbox 样式化）。 */
import type { ReactNode } from 'react';
export interface SwitchRowProps {
    id: string;
    label: string;
    hint: string;
    value: boolean;
    disabled: boolean;
    onToggle: () => void;
}
/** 一个布尔开关行（原生 checkbox 样式化）。 */
export declare function SwitchRow(props: SwitchRowProps): ReactNode;
