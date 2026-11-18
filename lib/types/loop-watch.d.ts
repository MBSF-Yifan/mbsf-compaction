/** 标记当前阶段（阻塞报告里的「当时阶段」）。返回撤销函数 = 恢复上一阶段。 */
export declare function markPhase(name: string): () => void;
/** 阶段名（只读，供外部调试）。 */
export declare function currentPhase(): string;
/** 启动看门狗（幂等——重复调用无副作用）。 */
export declare function startLoopWatchdog(): void;
