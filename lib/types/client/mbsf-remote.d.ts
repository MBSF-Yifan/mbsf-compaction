/**
 * 未必记忆状态 Remote 的浏览器半契约（手写 mirror）
 *
 * 平台惯例：host 包经 typert 生成器产出 `./remote` 产物供 client 装配；
 * 未必记忆引擎是独立仓库（不在主 workspace），无法在 client 侧 import 其
 * 生成物。因此这里手写等价的 `TypertRemoteContribution`（wire 契约）与
 * 类型声明，由本插件 apply 时 `ctx.remote.$mount`。
 *
 * 同步纪律：descriptor 的 endpoint（namespace/method/invocation）必须与
 * engine/src/status-gateway.ts 的 `SNAPSHOT_CONTRIBUTION`（2026-08-25 起
 * 由 `ctx.typert.register` 显式注册，取代 @Remote 装饰器）一致。client api
 * 要求 result 必为 strict codec（0.1.5：mode + typeSymbol + schema；0.1.7 还必须带 create() 工厂）；
 * 这里用透传 schema（parse 原样返回）保留「不校验 wire 形状、快照结构
 * 演进免同步」的宽松语义。快照类型是本侧的宽松 mirror，UI 渲染全部防御性取值。
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/mbsf-remote
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
/** 最近一次压缩的结构快照（null = 尚未压缩过）。 */
export interface MbsfLastSummarize {
    at: number;
    elapsedMs: number;
    messages: number;
    compressed: number;
    preserved: number;
    tailFpSegments: number;
    textChars: number;
}
/** 未必记忆状态快照（宽松 mirror of engine MbsfStatusSnapshot）。 */
export interface MbsfStatusSnapshot {
    /** 插件包版本。 */
    version: string;
    /** 脑状态总览。 */
    brain: {
        encoder?: {
            D?: number;
            NP?: number;
            version?: string;
            resonance?: boolean;
        };
        sessions?: {
            active?: number;
            seededFromOpenClaw?: boolean;
        };
        gamma?: {
            trackedSessions?: number;
            globalEMA?: number | null;
        };
        grayZone?: unknown;
    };
    /** 最近一次压缩结构快照（null = 尚未压缩过）。 */
    lastSummarize: MbsfLastSummarize | null;
    /** 压缩耗时统计。 */
    compression: {
        n?: number;
        emaMs?: number | null;
        lastMs?: number | null;
        recent?: Array<{
            ts: number;
            ms: number;
            messages: number;
            compressed: number;
        }>;
    };
    /** 折叠历史明细（最新在前，≤30 条）——A 方案读首条做常驻摘要行，
     *  C 方案整体渲染历史块（2026-09-27）。 */
    compressionHistory?: Array<{
        ts: number;
        sessionKey?: string;
        tailStart?: number;
        inputMessages?: number;
        compressed?: number;
        folded?: number;
        archived?: number;
        textChars?: number;
        ema?: number;
        elapsedMs?: number;
    }>;
    /** 坐标层记忆索引状态。 */
    memoryIndex: {
        initialized?: boolean;
        topics?: number;
        totalRefs?: number;
        sessionRefs?: number;
        fileRefs?: number;
        nestedTopics?: number;
        path?: string | null;
    };
    /** 内容段状态。 */
    segments: {
        segments?: Array<{
            no: number;
            lines: number;
            bytes: number;
            created?: number;
            firstTs?: number;
            lastTs?: number;
        }>;
        totalLines?: number;
        totalBytes?: number;
    };
    /** 注入统计。 */
    injection: {
        calls?: number;
        needInjected?: number;
        weakInjected?: number;
        injected?: number;
        injectedChars?: number;
    };
    /** 回想统计。 */
    recall: {
        calls?: number;
        needTrue?: number;
        needFalse?: number;
        expanded?: number;
        expandedChars?: number;
    };
    /** 素材三分观测（E.82）：登记增长来源分账。 */
    growth?: {
        messages?: number;
        duplicate?: number;
        chainMerge?: number;
        newTopic?: number;
        shadowed?: number;
        nestEdge?: number;
        nestEdgeHot?: number;
        nestEdgeArch?: number;
    };
    /** 进程堆现状（2026-09-21）。 */
    heap?: {
        /** 当前 V8 old-space 上限（MB）——本进程实际生效值。 */
        limitMb?: number;
        /** 当前已用堆（MB）。 */
        usedMb?: number;
        /** 已用占上限比（0-1）。 */
        usedRatio?: number;
        /** 本机允许的最大堆上限（MB）——滑块上界。 */
        maxMb?: number;
        /** 配置里的堆上限（MB，0 = 不注入）——下次重启 dsh 生效。 */
        configuredMb?: number;
        /** 最近一次自动释放（2026-09-27）——未触发过为 null。 */
        autoReclaim?: {
            /** 触发时刻（epoch ms）。 */
            at: number;
            /** 释放字节。 */
            reclaimed: number;
            /** 触发时的堆占用百分比。 */
            usedPct: number;
            /** 触发路径（2026-10-02）：`idle` = 常规（空闲时清）；
             *  `emergency` = 紧急旁路（≥85% ⟹ 忙也清）。老引擎不返回本字段。 */
            reason?: 'idle' | 'emergency';
        } | null;
        /** 自动释放是否已启动（`MBSF_RECLAIM_WATCH=0` 时为 false）。 */
        autoReclaimActive?: boolean;
        /** **释放门槛现状**（2026-09-28，Phase D）——`isIdle()` 实时快照
         *  （宽 mirror，对应引擎侧 `MbsfStatusSnapshot['heap']['idle']`）。
         *  `idle: false` = 有 mbsf 调用在途或阶段未空闲 ⟹ 手动释放应被拒。 */
        idle?: {
            /** 真闲？= 无在途 mbsf 调用 ∧ 阶段空闲。 */
            idle: boolean;
            /** 在途 mbsf 调用数。 */
            inflight: number;
            /** 当前压缩阶段（`空闲` = 无阶段在跑）。 */
            phase: string;
        };
    };
    /** **catalog 探测**（2026-09-28，Phase D）——本进程实际用的 DSH 会话格式
     *  catalog 版本（宽 mirror，对应引擎侧 `MbsfStatusSnapshot['catalog']`）。
     *  `effective` = CLI 场景 3 / App 场景 4；App 下若仍是 3 ⟹ 会话剥离对
     *  v4 文件保守跳过（不写坏，但白做）。 */
    catalog?: {
        /** 构建期内联的 catalog 版本。 */
        bundled?: number | null;
        /** 运行时探测到的宿主 catalog 版本（null = 探测失败/无宿主）。 */
        probed?: number | null;
        /** 实际生效的版本（null = 无可用 catalog）。 */
        effective?: number | null;
        /** 是否有 historical catalog（0.1.7 独有）。 */
        historical?: boolean;
    };
    /** **验证器探测**（2026-10-02）——官方存储验证器 / 会话库实际解析到哪棵树
     *  （宽 mirror，对应引擎侧 `MbsfStatusSnapshot['verifier']`）。
     *
     *  判读：`sessionTypes` = 59 是 App 0.2.0 正常值；56 表示落到了 CLI 0.1.5
     *  的检出 ⟹ `knowsNewTypes: false` ⟹ **剪裁会全部静默跳过**（这是该功能
     *  失效的唯一可见信号——它不报错，只在 `cleanup-stats.json` 留 skipped）。
     *  老引擎不返回本字段。 */
    verifier?: {
        /** 验证器来源（`'host'` = App 自带 / `'engine'` = 引擎自身）。**粗**分类。 */
        verifier?: string | null;
        /** 会话库来源（同上）。 */
        sessionLib?: string | null;
        /** 验证器实际解析到的文件路径（判读的硬证据——标签有歧义时看它）。 */
        verifierPath?: string | null;
        /** 会话库实际解析到的文件路径。 */
        sessionPath?: string | null;
        /** `dsh-session` 的已知事件类型数（59 = 0.2.0 / 56 = 0.1.5）。 */
        sessionTypes?: number;
        /** 是否认识 `developer/message`（false ⟹ 剪裁全部跳过）。 */
        knowsNewTypes?: boolean;
    };
    /** **引擎加载状态**（2026-11-09，宽 mirror）——引擎在 preset 域、状态网关在
     *  宿主域，ctx 隔离，网关靠 `~/.mbsf/engine-status.json` 判断。
     *  `loaded: false` = **本进程没有引擎**（preset 覆盖未生效 / DSH 版本升级后
     *  standard preset 结构变化）——压缩不会发生。老引擎不返回本字段。 */
    engine?: {
        /** 本进程（同 pid）是否加载过引擎。 */
        loaded?: boolean;
        /** 标记里的 pid。 */
        pid?: number | null;
        /** 标记写入时间（ISO）。 */
        startedAt?: string | null;
        /** 未加载时的原因说明（loaded 时 null）。 */
        note?: string | null;
    };
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespace$electronicSheepStatus {
        snapshot: () => Promise<RemoteResult<MbsfStatusSnapshot>>;
    }
    interface TypertRemoteMap {
        'mbsfStatus/snapshot': () => Promise<RemoteResult<MbsfStatusSnapshot>>;
    }
    interface TypertRemoteNamespaceMap {
        'mbsfStatus': TypertRemoteNamespace$electronicSheepStatus;
    }
}
/** 会话级覆盖（宽松 mirror of engine SessionOverride——注入/锚/自动压缩三开关）。 */
export interface SessionOverride {
    injectEnabled?: boolean;
    dateAnchorEnabled?: boolean;
    autoCompact?: boolean;
}
/** 会话配置状态（宽松 mirror of engine SessionConfigState）。 */
export interface SessionConfigState {
    /** 生效值（覆盖链解析后）。 */
    effective: {
        injectEnabled: boolean;
        dateAnchorEnabled: boolean;
        autoCompact: boolean;
        /** 🐾 活动指示器开关（全局档——浮窗零额外往返读取）。 */
        activityIndicatorEnabled: boolean;
        /** 🐾 活动文字开关（全局档，同上——与动画开关独立）。 */
        activityLabelEnabled: boolean;
    };
    /** 当前会话的显式覆盖（null = 未覆盖，走继承/全局）。 */
    override: SessionOverride | null;
    /** 生效来源：'session' / 'parent' / 'global'。 */
    inheritedFrom: 'session' | 'parent' | 'global';
    /** 本会话折叠简报（A 方案——浮窗常驻摘要行；null = 本会话尚未折叠过）。 */
    compressionBrief?: {
        folds: number;
        lastAt: number;
        lastMs: number;
        compressedTotal: number;
        archivedTotal: number;
        lastInputMessages: number;
    } | null;
}
/** 「重启 DSH」按钮的结果（宽松 mirror of engine MbsfRestartResult）。 */
export interface MbsfRestartResult {
    ok: boolean;
    detail?: string;
}
/** 「释放内存」按钮的结果（宽松 mirror of engine MbsfReclaimResult，2026-09-27）。 */
export interface MbsfReclaimResult {
    ok: boolean;
    /** 回收字节。 */
    reclaimed: number;
    /** 清理前 / 后 heapUsed。 */
    before: number;
    after: number;
    /** GC 耗时 ms。 */
    gcMs: number;
    /** 各缓存清理前条目数。 */
    clearedEntries: Record<string, number>;
    detail: string;
}
/** 内存侦察报告（宽松 mirror of engine MemoryReport）。 */
export interface MemoryReport {
    process: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
        arrayBuffers: number;
        heapSizeLimit: number;
    };
    caches: Record<string, {
        entries: number;
        estBytes: number;
    }>;
    index: Record<string, unknown>;
    cachesTotalBytes: number;
    dataDir: string | null;
}
/** 清单一行（宽松 mirror of engine MbsfTrimRow）。 */
export interface MbsfTrimRow {
    id: string;
    /** 会话标题（= 首条用户消息截断；引擎读不到时缺省）。 */
    title?: string;
    workspacePath: string;
    bytes: number;
    mtimeMs: number;
    createdAtMs?: number;
    origin?: string;
    selected: boolean;
    /** 是否已归档（DSH 工作区口径，2026-11-07）。 */
    archived: boolean;
    /** 子代理会话的父会话 id。 */
    parentSession?: string;
    /** 根源（主）会话是否已归档——子代理不随主会话归档，所以要看根。 */
    rootArchived: boolean;
    /** 祖先链断了（父会话已不在盘上）= 孤儿残留。 */
    orphan: boolean;
    /** 能不能删（**服务端算的**，客户端别重算——破坏性动作只有一处口径）。 */
    deletable: boolean;
    /** 不能删的原因码：`active` = 未归档主会话；`parent` = 父会话未归档；`live` = 运行中。 */
    deletableReason?: 'active' | 'parent' | 'live';
    lastTrim: {
        at: string;
        stripFiles: number;
        pruneFiles: number;
        freedBytes: number;
    } | null;
}
/** 清单结果（宽松 mirror of engine MbsfTrimTargets）。 */
export interface MbsfTrimTargets {
    rows: MbsfTrimRow[];
    selectedCount: number;
    selectedBytes: number;
    /** 全局「重启时清理」是否开着——开着时勾选不生效（UI 要明说）。 */
    /** 剪裁总开关：true = 重启时按勾选剪，false = 不剪。 */
    trimEnabled: boolean;
}
/** 勾选结果。 */
export interface MbsfTrimSetResult {
    id: string;
    selected: boolean;
}
/** 删除结果（失败不抛异常——原因交给界面说清楚）。 */
export interface MbsfTrimDeleteResult {
    ok: boolean;
    /** 实际搬走的会话 id（父会话 + 一起带走的子代理）。 */
    deleted: string[];
    bytes: number;
    detail?: string;
}
/** 回收站里的一条。 */
export interface MbsfDeletedRow {
    id: string;
    title?: string;
    workspacePath: string;
    origin?: string;
    parentSession?: string;
    bytes: number;
    deletedAt: string;
    expiresAt: string;
    /** 剩余天数（0 = 今天到期）。 */
    remainingDays: number;
    role: 'root' | 'child';
    siblingCount: number;
}
/** 回收站列表。 */
export interface MbsfTrimDeletedResult {
    entries: MbsfDeletedRow[];
    /** 本次顺手永久清理掉的条数（> 0 时界面要说出来）。 */
    purged: number;
}
/** 恢复结果。 */
export interface MbsfTrimRestoreResult {
    ok: boolean;
    restored: string[];
    detail?: string;
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespace$electronicSheepStatus {
        restart: (sessionId: string) => Promise<RemoteResult<MbsfRestartResult>>;
        sessionState: (sessionId: string) => Promise<RemoteResult<SessionConfigState>>;
        sessionSet: (sessionId: string, partial: SessionOverride) => Promise<RemoteResult<SessionConfigState>>;
        sessionClear: (sessionId: string) => Promise<RemoteResult<SessionConfigState>>;
        /** 只读内存侦察（2026-09-27）。 */
        memoryReport: () => Promise<RemoteResult<MemoryReport>>;
        /** 释放内存：落盘 → 清缓存 → GC。 */
        reclaimMemory: () => Promise<RemoteResult<MbsfReclaimResult>>;
        /** 会话历史剪裁清单（只读）。 */
        trimTargets: () => Promise<RemoteResult<MbsfTrimTargets>>;
        /** 勾选/取消一个会话。 */
        setTrimTarget: (input: {
            sessionId: string;
            selected: boolean;
        }) => Promise<RemoteResult<MbsfTrimSetResult>>;
        /** 删除会话（搬到回收站，30 天内可恢复）。 */
        trimDelete: (input: {
            sessionId: string;
        }) => Promise<RemoteResult<MbsfTrimDeleteResult>>;
        /** 回收站列表（只读；顺手清理超过 30 天的）。 */
        trimDeleted: () => Promise<RemoteResult<MbsfTrimDeletedResult>>;
        /** 从回收站恢复（父会话整批恢复）。 */
        trimRestore: (input: {
            sessionId: string;
        }) => Promise<RemoteResult<MbsfTrimRestoreResult>>;
    }
    interface TypertRemoteMap {
        'mbsfStatus/restart': (sessionId: string) => Promise<RemoteResult<MbsfRestartResult>>;
        'mbsfStatus/sessionState': (sessionId: string) => Promise<RemoteResult<SessionConfigState>>;
        'mbsfStatus/sessionSet': (sessionId: string, partial: SessionOverride) => Promise<RemoteResult<SessionConfigState>>;
        'mbsfStatus/sessionClear': (sessionId: string) => Promise<RemoteResult<SessionConfigState>>;
        'mbsfStatus/memoryReport': () => Promise<RemoteResult<MemoryReport>>;
        'mbsfStatus/reclaimMemory': () => Promise<RemoteResult<MbsfReclaimResult>>;
        'mbsfStatus/trimTargets': () => Promise<RemoteResult<MbsfTrimTargets>>;
        'mbsfStatus/setTrimTarget': (input: {
            sessionId: string;
            selected: boolean;
        }) => Promise<RemoteResult<MbsfTrimSetResult>>;
        'mbsfStatus/trimDelete': (input: {
            sessionId: string;
        }) => Promise<RemoteResult<MbsfTrimDeleteResult>>;
        'mbsfStatus/trimDeleted': () => Promise<RemoteResult<MbsfTrimDeletedResult>>;
        'mbsfStatus/trimRestore': (input: {
            sessionId: string;
        }) => Promise<RemoteResult<MbsfTrimRestoreResult>>;
    }
}
/** 浏览器半装配的 Remote contribution（host 端 mbsf-status 插件实现同契约）。 */
export declare const TYPERT_REMOTE: TypertRemoteContribution;
export default TYPERT_REMOTE;
