/** 未必记忆滑块行——staged form 的 range 输入（拖动即进 staged）。
 *
 *  与 NumberRow 的差异：**拖动过程不提交**（onChange 只更新本地草稿），
 *  **松手才提交**（onPointerUp / onKeyUp / onBlur）——拖一次滑块会产生
 *  几十个 change 事件，逐个提交会让 staged 状态抖动、`dirty` 闪烁。
 *
 *  值域由调用方给（min/max/step），钳制函数（normalize）在 commit 时补齐
 *  区间内的空洞（如 dshHeapMb 的 1..4095）。
 */
import { type ReactNode } from 'react';
export interface SliderRowProps {
    id: string;
    label: string;
    hint: string;
    value: number;
    disabled: boolean;
    /** 允许的最小值。 */
    min: number;
    /** 允许的最大值。 */
    max: number;
    step?: number;
    /** 显示格式化（默认 `${value}`）——如把 MB 显示成 `8 GB`。 */
    format?: (value: number) => string;
    /** commit 前的合法域钳制。 */
    normalize?: (value: number) => number;
    onCommit: (value: number) => void;
}
/** 一个滑块行（拖动中只更新草稿，松手/失焦才提交）。 */
export declare function SliderRow(props: SliderRowProps): ReactNode;
