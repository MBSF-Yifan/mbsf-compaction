/** 未必记忆数值行——staged form 的数值输入（blur/Enter 提交进 staged）。 */
import { type ReactNode } from 'react';
export interface NumberRowProps {
    id: string;
    label: string;
    hint: string;
    value: number;
    disabled: boolean;
    /** 允许的最小值（默认 0）。 */
    min?: number;
    step?: number;
    /** commit 前的合法域钳制（如 cleanupPruneTurns 的 0 或 >= 3）。 */
    normalize?: (value: number) => number;
    onCommit: (value: number) => void;
}
/** 一个数值输入行（blur / Enter 提交，非法值回退）。 */
export declare function NumberRow(props: NumberRowProps): ReactNode;
