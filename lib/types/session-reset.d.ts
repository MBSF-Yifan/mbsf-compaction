/**
 * 会话重启调度（手动触发侧）
 *
 * 2026-09-20 一帆定「自动重启删掉」——**自动重置链已退役**（内存上限 + 回合末
 * 自检 + 静默门 + 冷却 + 增长门槛 + goal 恢复注入全部删除）。本模块现在只剩
 * **面板「重启 DSH」按钮**这一条触发路径：
 *
 *  - 本模块（进程内）：写一份请求文件并派一个**独立会话**的 runner
 *    （`lib/bin/session-reset.js`）。
 *  - runner（独立进程，DSH 关停不波及）：停 dsh → 清理（剥离 + 全库剪裁 +
 *    备份清理 + 官方验证兜底还原）→ 起 dsh。
 *
 * 为什么退役自动重置：内存问题由**重启清理**解决——重启间隙是唯一全局静默
 * 窗口，也是唯一能把磁盘收益转成内存收益的窗口（清理后 dsh 从小日志重载）。
 * 自动重置的复杂度（多会话静默门、冷却、增长门槛、goal 恢复注入）换来的只是
 * 「无人值守时也能瘦身」，而用户本来就要手动重启才看得到效果。
 *
 * @module mbsf-compaction/session-reset
 */
/** 无论剪裁多深，产物至少保留的**完整回合数**（锚点底线；2026-09-10 一帆
 *  澄清「10 条」= 10 轮）。清理的 `cleanupPruneTurns` 也用它作非零下界。
 *
 *  [OBS] 与 `SESSION_RESET_MIN_TURNS_FLOOR`（UI 可设下界 3）**层次不同**：
 *  这个是「产物至少保留多少」，那个是「用户最少能设多少」。 */
export declare const SESSION_RESET_MIN_TURNS = 10;
/** runner 的请求文件（进程内写、runner 读）。 */
export interface ResetRequest {
    /** 目标会话 id。 */
    sessionId: string;
    /** 会话日志绝对路径。 */
    logPath: string;
    /** 重启前 goal 是否 active（保留字段——旧请求文件读不炸）。 */
    goalActive: boolean;
    /** 触发时的日志字节数（报告用）。 */
    logBytes: number;
    /** 上限 MB（保留字段——旧请求文件读不炸）。 */
    ceilingMb: number;
    /** 本次裁剪的保留**回合数**（保留字段——旧请求文件读不炸）。 */
    minTurns?: number;
    /**
     * 本次 host 实际监听的 web 端口（进程内现场采集）。
     *
     * 2026-09-27 加：runner 原先硬编码 3080（`dsh web` CLI 的端口），而桌面 app
     * 绑 19387 ⟹ 旧 host 不被杀 + 新 host EADDRINUSE。这里在**触发侧**（引擎跑在
     * host 进程里，能直接查出自己的监听端口）把端口记进请求，runner 照着办。
     * 可选字段：旧请求文件读不炸。
     */
    webPort?: number;
    /** 重启 dsh 用的进程信息（进程内现场采集，避免猜命令）。 */
    restart: {
        execPath: string;
        /** node 自身参数（如 `--import tsx/esm`）——process.execArgv 现场采集。 */
        execArgv?: readonly string[];
        argv: readonly string[];
        cwd: string;
    };
    /** 触发来源（审计用：手动脚本 / 面板按钮）。 */
    source?: string;
    /** 动作模式：restart = 重启（+ 按开关清理）。自动重置退役后恒为 'restart'。 */
    mode?: 'reset' | 'restart';
    /** 触发时刻（epoch ms）。 */
    at: number;
}
/** 请求文件路径（脑数据目录内，会话目录之外）。 */
/**
 * 查出**本进程**（引擎跑在 host 进程内 ⟹ 就是 host）正在监听的 web 端口。
 *
 * 用 `lsof -a -p <pid> -iTCP -sTCP:LISTEN` 取本进程的 LISTEN 端口，排除进度页
 * （3081）与本地网关（8790）之类非 web 面端口；取不到返回 undefined（调用方回退
 * 到候选表）。
 */
export declare function detectOwnWebPort(): number | undefined;
export declare function resetRequestPath(): string;
/** 读请求文件；不存在/坏 JSON 返回 undefined。 */
export declare function readResetRequest(): ResetRequest | undefined;
/** 清请求文件（幂等）。 */
export declare function clearResetRequest(): void;
/** 陈旧阈值：请求写出后超过此时长仍未被 runner 消费，即视为陈旧。 */
/** [OBS] 请求文件陈旧阈值（30 分钟）——超过即视为 runner 没消费（崩溃/被杀），
 *  清理掉防堆积。纯资源护栏，不参与剪裁判定。 */
export declare const RESET_REQUEST_TTL_MS: number;
/**
 * 请求是否陈旧（写出后超过 TTL 仍未被消费）。
 *
 * 2026-09-14 加固（一帆「两条加固都做」）：陈旧请求是**静默死锁**——
 * 两个调度入口（`shouldResetSessionLog` / `maybeScheduleRestart`）都以
 * 「已有挂起请求 ⟹ 直接返回」为守卫，于是任何一次写成功但没跑起来的请求
 * （09-10 副本缺 runner、09-14 stale 副本缺 runner）都会**永久堵死后续所有
 * 重启与自动重置**，且毫无痕迹。TTL 让这种情况自愈。
 */
export declare function isResetRequestStale(request: ResetRequest, now?: number): boolean;
/**
 * 读「新鲜」的挂起请求；陈旧则顺手清掉并返回 undefined（自愈，幂等）。
 * 调度入口一律走本函数，不走裸 `readResetRequest`。
 */
export declare function peekFreshResetRequest(now?: number): ResetRequest | undefined;
/** spawn 失败报告路径（与 runner 报告同目录，便于一起看）。 */
export declare function resetSpawnLogPath(): string;
/**
 * runner 入口路径——**包内构建产物** `<lib>/bin/session-reset.js`。
 *
 * 2026-09-10 事故：原先指向 `<engine>/scripts/session-reset.mjs`，而 DSH 经
 * profile 的 node_modules 副本加载引擎（`file:` 依赖复制），副本里只有包内
 * 构建产物 ⟹ 派生路径不存在 ⟹ runner 静默不跑（请求写了、进程没动）。放进
 * `src/bin/` 随构建落 `lib/bin/`，任何部署形态都在。
 */
export declare function resetRunnerPath(): string;
/**
 * 面板「重启 DSH」按钮：写 restart 请求并派 runner。
 *
 * 清理与否由 `restartCleanupEnabled` 开关决定（runner 侧读）——本函数只负责
 * 「派一次重启」。自动重置退役后这是**唯一**触发路径。
 */
export declare function maybeScheduleRestart(input: {
    sessionId: string;
    logPath?: string;
}): ResetRequest | undefined;
