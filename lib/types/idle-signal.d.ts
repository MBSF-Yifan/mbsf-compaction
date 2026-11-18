/** 标记一次 mbsf 工具调用开始（与 `leave()` 必须成对——用 try/finally）。 */
export declare function enter(): void;
/** 标记一次 mbsf 工具调用结束（幂等安全——计数夹在 ≥0）。 */
export declare function leave(): void;
/** 当前在途调用数（调试 / 状态上报用）。 */
export declare function inflightCount(): number;
/**
 * 真闲？= 无在途 mbsf 调用 **且** 阶段空闲。
 *
 * @returns true = 现在清缓存不会被立刻重建（释放的收益能留住）。
 */
export declare function isIdle(): boolean;
/** 空闲判据的人类可读快照（状态面板 / 日志用）。 */
export declare function idleSnapshot(): {
    idle: boolean;
    inflight: number;
    phase: string;
};
