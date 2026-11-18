/**
 * 水滴 —— 🐾 图标上的活动指示器（2026-10-14 三轮定稿）。
 *
 * 本文件是**纯逻辑 + 纯绘制**：不碰 React、不碰 DOM、不读全局时钟。
 * 状态在 `DropletState` 对象里（组件实例各持一份），`advance()` 只依赖
 * `(state, dt, act)` ⟹ 可以在 Node 里完整重演（见 `tests/droplet.spec.ts`），
 * 也可以被页面按 60fps 驱动。**同一份代码**服务真实 UI 与测试——
 * 不做「测试用一份、跑起来用另一份」。
 *
 * ── 三类动作 = 工程切面 ──────────────────────────────
 * 与 `../mbsf-activity.ts` 头注同源（那里是 host 半的分类，这里是它的视觉）：
 *   · 读（读取内容）= 展开成内容 ⟹ 顺时针绕行
 *   · 写（nominate / forget）    = `D` 区分——内容**落成**坐标 ⟹ 逆时针绕行
 *   · 压（压缩）         = 多条合并成一个 ⟹ 停住、交替变扁
 * 注意「压」没有单独动作，本质仍是归并（同一话题的多条消息 → 合并）
 * ⟹ 三类是两个方向的切面，不是一个三分法。
 *
 * ── 形态要点（2026-10-14 一帆逐条定，三轮）───────────────────────────
 *   · 球在 logo **外面**绕（`ORB_R > LOGO_R`）——不挡品牌图
 *   · 尾巴拖在**行进反方向**；跨角随「已进行多久」生长（长调用看得见时间）
 *   · **起步即有基础尾**：0.25s 内长到 `ARC_MIN`，不做「光球干绕」
 *   · 空档**边动态边淡**：继续按上一动作的方向走，尾跨角**冻结**（尾形不塌）
 *   · 文字**快起慢落**：亮 0.10s / 暗 0.30s（亮是「球来了」要灵敏，暗是余晖要缓）
 *
 * ── 幅度硬约束（`tests/droplet.spec.ts` 逐条钉住）────────────────────
 *   · 球全程在 logo 外（读/写最坏 14.60px > 13px；压最坏 13.935px > 13px）
 *   · 球与尾都不出 canvas（读/写 18.40px、压 19.065px ≤ 20px）
 *   · 三类动作的相位/方向语义与 host 侧 `MBSF_TOOLS` 一致
 *
 * ── 为什么 canvas 要 40px 而按钮只有 26px ────────────────────────────
 * 轨道半径 16.5 + 球半径 1.9 = 18.4px（压时 19.065px）⟹ 直径 ~38px。
 * canvas 取 40px 居中盖在按钮上（`left/top = (26 − 40)/2 = −7px`）。
 * ⟹ **祖先链上任何 `overflow: hidden` 都会切掉球**——`MbsfFloatingPanel`
 * 的 `.seat` 到 composer 卡片实测无裁剪（2026-10-14 查证），
 * 但这是**布局契约**：改 composer 样式的人需要知道这里有个溢出 7px 的画布。
 */
/** 球心轨道半径（26px 制）——球整体在 logo 外。 */
export declare const BTN = 26;
/** logo（= 按钮）半径。 */
export declare const LOGO_R: number;
/** 球外缘与 logo 边缘的净空——「不挡 logo」的量化保证。 */
export declare const CLEAR = 1.6;
/** 球半径。 */
export declare const DOT = 1.9;
/** 球心轨道半径 = 13 + 1.6 + 1.9 = 16.5px。 */
export declare const ORB_R: number;
/** canvas 边长（≥ 2×(ORB_R + DOT·K_SQ) = 38.13 ⟹ 取 40）。 */
export declare const CV = 40;
/** 尾巴跨角上限（度）——过 180° 就绕成甜甜圈。 */
export declare const ARC_MAX = 150;
/** 起步尾角（度）——「一动就有尾巴」，不许光球干绕。 */
export declare const ARC_MIN = 26;
/** 尾宽剖面指数：1 = 直线尖锥（水滴）。 */
export declare const TAIL_P = 0.9;
/** 尾尖宽度 / 球半径。 */
export declare const TIP_W = 0.05;
/** 整条水滴的不透明度。 */
export declare const HEAD_A = 0.88;
/** 渐淡时尾尖的残余不透明度。 */
export declare const TIP_A = 0.06;
/**
 * 水滴墨色（亮色主题）——近黑的深灰。
 *
 * ── 为什么现在要分亮/暗两套（2026-10-14 三轮·一帆）──────────────────
 * 原先写死一套，理由是「logo 是白底黑图的固定 JPEG，不随主题变」。
 * 但一轮反馈指出：**深色模式下 logo 自己就该反色**（否则白底圆片糊在
 * 深色聊天窗上）。logo 一旦反色，叠在它上面的水滴也必须跟着反——
 * 「覆盖层的前景由被覆盖物决定」这条原则没变，变的是**被覆盖物现在随主题**。
 * ⟹ 墨色成为主题的函数：亮色用深墨，暗色用浅墨。
 */
export declare const INK_LIGHT = "24,24,27";
/** 水滴墨色（暗色主题）——与 `--dsw-alias-label-primary`（暗色 = 近白）同域。 */
export declare const INK_DARK = "249,250,251";
/**
 * 压缩形变系数——上下 ⇄ 左右交替变扁，面积守恒（`sx·sy ≡ 1`）。
 *
 * ── 上限是算出来的，不是调出来的（2026-10-14 三轮）───────────────────
 * 球心轨道半径 `ORB_R = 16.5`，而三个方向的「可用余量」**恰好都是 3.5px**：
 *
 * ```
 *   logo 边缘     13.0   ⟹ 16.5 − 13.0 = 3.5   （球内缘不压 logo）
 *   canvas 边缘   20.0   ⟹ 20.0 − 16.5 = 3.5   （球外缘不被裁）
 *   右侧文字      20.0   ⟹ 20.0 − 16.5 = 3.5   （球外缘不压文字，= LOGO_R + gap 7）
 * ```
 *
 * 半轴最大 = `DOT · K` ⟹ `1.9K ≤ 3.5` ⟹ **K ≤ 1.842**（三个约束同时到期）。
 * 取 **1.7**：比原 1.35 明显更扁（+26%），仍留 0.27px 净空。
 * `tests/droplet.spec.ts` 钉住 `K_SQ < K_SQ_MAX`——再往上调会先红。
 */
export declare const K_SQ = 1.7;
/** 压缩形变系数上限（`(ORB_R − LOGO_R) / DOT`，三约束同值）。 */
export declare const K_SQ_MAX: number;
/** 压缩形变周期（ms）——与轨道周期不同，避免两通道锁相。 */
export declare const SQ_MS = 1400;
/** 淡入时长（秒）。 */
export declare const FADE_IN = 0.25;
/**
 * 淡出时长的**下限**（秒）——「边动态边淡」的最短观感长度。
 *
 * ⚠ 三轮起余韵时长**不再是常数**：球要从当前位置走到**下一个顶部**，
 * 走多久就淡多久（`fadeOut = max(FADE_OUT_MIN, 距离 × SEC_PER_TURN)`）
 * ⟹ 走到顶部与淡到 0 **同时发生**（终点必然在正上方）。
 * 距离很短时用这个下限兜底，避免「一闪就没」。
 */
export declare const FADE_OUT_MIN = 0.45;
/** 尾长生长起点（秒）——T₀ 之前只有基础尾。 */
export declare const T0 = 3.5;
/** 基础尾出生时长（秒）——「一动就有尾巴」。 */
export declare const T_BORN = 0.25;
/** 尾长饱和点（秒）——到 ARC_MAX。 */
export declare const TMAX = 30;
/** 文字亮度上升时间常数（秒）——快。 */
export declare const GLOW_ATTACK = 0.1;
/** 文字亮度下降时间常数（秒）——比上升慢（一帆：「暗的时候可以比明的时候稍慢些」）。 */
export declare const GLOW_RELEASE = 0.3;
/** 亮度曲线指数——三次方是**窗口宽度**的选择（见 `glowAt`）。 */
export declare const GLOW_P = 3;
/** 一圈秒数——对齐 DSH 既有指示器节奏（1.2s）。 */
export declare const SEC_PER_TURN = 1.2;
/**
 * 顶部相位（圈）——**起点 / 终点 / 压缩点**。
 *
 * `orbitAt(0.75) = (0, −1)` = 屏幕正上方（`orbitAt(0.25)` 是正下方）。
 *
 * ── 为什么锚在顶部（2026-10-14 三轮·一帆）────────────────────────────
 * 「起点和终点和压缩都在 logo 正上方」——三个理由：
 *   ① **可预期**：每次动作都从同一个地方出发、回到同一个地方，
 *      不积累漂移（否则看久了会觉得球"跑偏了"）。
 *   ② **压缩有地方变扁**：顶部两侧是空的（球心 (0,−16.5)，左右各有
 *      ~16px 余量），而右侧紧邻动作文字（gap 7px）——在顶部变扁最自由。
 *   ③ **一次动作 = 整数圈**：球从顶部出发，结束时继续走到**下一个顶部**
 *      才停，走过的总弧长恰好是整数圈 ⟹ 「起点终点都在正上方」自动成立。
 *
 * ⚠ 与设计稿 §3.7(1)「位置是连续累加的弧长」的关系：**相位仍然连续**
 * （换方向只翻符号、永不瞬移），只是**停靠点**锚在顶部。两者不冲突——
 * 「连续」说的是过程中不跳，「锚顶」说的是停在哪。
 */
export declare const TOP_PHASE = 0.75;
/**
 * 最短显示时长（毫秒）——**出现即保证看得见**。
 *
 * 缓存命中的调用只有 ~50ms：若按真实时长渲染，水滴只长到基础尾的 1/5
 * 就被撤掉，视觉上是一次抖动（不是「动过」）。故活动到来后**至少**保持
 * 这么久才允许进入淡出——与旧的 `ACTIVITY_CYCLE_MS`（1200ms，保证播完
 * 一整个环）同一意图，只是水滴的时间尺度更短（基础尾 250ms + 余韵 450ms）。
 */
export declare const MIN_ACT_MS = 400;
/**
 * 压缩动作的最短显示时长（毫秒）——**必须够播完一个完整形变周期**。
 *
 * ── 为什么压缩要单独一条（2026-10-14 四轮·一帆：「压缩闪太快」）────────
 * `MIN_ACT_MS`（400ms）是照**读/写**的时间尺度定的：基础尾 250ms + 一点
 * 余韵就够看。但压缩的节奏由 `SQ_MS`（1400ms）主导——球要**慢慢变扁再
 * 鼓回来**，这是一个完整周期。400ms 连三分之一周期都不到就被撤掉 ⟹
 * 压缩永远是「闪一下就没了」，形变根本来不及成形。
 *
 * 真实事务时长也印证：压缩的 `start→end` 实测只有 70~300ms，远短于
 * 1400ms 的形变周期 ⟹ 不加这条保底，压缩动作**必然**被腰斩。
 *
 * ⚠ 不把 `MIN_ACT_MS` 全局提到 1400：读/写会被一起拖长，缓存命中的
 * ~50ms 调用要卡满 1.4 秒，手感发黏。**只给压缩加保底。**
 */
export declare const MIN_COMPACT_MS = 1400;
/**
 * 按动作取「最短显示时长」——形态不同，该看的时长也不同。
 *
 * @param act - 动作形态（`idle` 无意义——调用方不应在空闲时问）。
 * @returns 该动作至少应显示的毫秒数。
 */
export declare function minActMs(act: DropletAct): number;
/** 三类动作（`idle` = 无动作）。 */
export type DropletAct = 'read' | 'write' | 'compact' | 'idle';
/** 方向：读顺时针（屏幕坐标 y 向下 ⟹ 角度递增 = 视觉顺时针）/ 写逆时针 / 压不动。 */
export declare const DIRS: Readonly<Record<DropletAct, number>>;
/** 是否已在顶部（含浮点容差）。 */
export declare function atTop(u: number): boolean;
/**
 * 余韵是否已经走完（可以卸载画布了）。
 *
 * ── 为什么需要这个判断（2026-10-14 四轮·一次真实故障）────────────────
 * 组件原先靠 `act` 变 `'idle'` 来调 `endActivity`，但 `act` 是**形态**
 * （`ACTIVITY_FACE` 只产出 read / write / compact），`'idle'` 永远不来；
 * 而活动消失时组件直接**整个卸载**，rAF 随之停 ⟹ `endActivity` 一次都
 * 没被调用过 ⟹ 余韵、锚顶、边淡边走**全部落空**（球只会硬生生消失）。
 *
 * 修法：水滴**自管生命周期**——活动消失时传 `'idle'` 进来（不卸载），
 * 由本函数判断「余韵跑完了」，跑完才让组件摘掉画布。
 *
 * ⚠ 判定条件必须是 `vis` 而非 `elapsed`：余韵期 `active === false`，
 * 但球还在走、还在淡，此时摘掉画布 = 半路掐断。
 *
 * @param s - 状态。
 * @returns 是否已完全静止（可卸载）。
 */
export declare function settled(s: DropletState): boolean;
/**
 * 从 `u` 到顶部**最短**该走哪个方向（+1 / −1）；已在顶部 ⟹ 0。
 *
 * 压缩自己没有方向（`DIRS.compact = 0`），但「压缩要发生在顶部」——
 * 若球不在顶部（读/写途中切到压缩），就走最短的那半圈上去。
 */
export declare function shortestToTop(u: number): number;
/** 水滴状态（组件实例各持一份——不是模块级单例）。 */
export interface DropletState {
    /** 相位（圈，可为负）——只被「有动作」或「还没淡完」的时间推进。 */
    u: number;
    /** 可见度 0..1（缓动）。 */
    vis: number;
    /**
     * 是否**有活跃动作**——驱动「淡入还是淡出」与「elapsed 是否增长」。
     *
     * ⚠ 必须与 `act` 分开：`act` 是**形态**（余韵期要继续按它画），
     * `active` 是**事实**（动作还在不在）。二轮曾用 `act !== 'idle'` 兼职
     * 两者，结果是 `endActivity` 之后 `vis` 仍往 1 涨（动作结束了却还在淡入）
     * ——`tests/droplet.spec.ts` 抓到。
     */
    active: boolean;
    /** 当前形态——**余韵期保留上一个动作**（渐淡期继续按它演）。 */
    act: DropletAct;
    /** 当前方向——余韵期保留上一个方向。 */
    dir: number;
    /** 动作结束瞬间的尾跨角（冻结值）；`null` = 按 `elapsed` 实时算。 */
    arc: number | null;
    /** 上一活跃帧的尾跨角——动作结束时冻结成 `arc`。 */
    frozenArc: number;
    /** 当前动作已进行秒数（换动作归零）。 */
    elapsed: number;
    /** 累计时钟（秒）——供压缩形变相位用（与轨道不锁相）。 */
    clock: number;
    /** 文字亮度跟随器状态（不对称：快起慢落）。 */
    glow: number;
    /**
     * 本轮余韵的总时长（秒）——动作结束时按「到下一个顶部的距离」算定。
     * 走到顶部与淡到 0 **同时发生**，分母就是它。
     */
    fadeOut: number;
    /** 余韵起点相位（圈）——与 `fadeTurns` 一起插值出当前位置。 */
    fadeFrom: number;
    /** 余韵要走的总圈数（带符号）——终点必然是顶部（整数圈 ⟹ 精确落在 TOP_PHASE）。 */
    fadeTurns: number;
    /** 余韵已进行秒数——进度 `p = fadeElapsed / fadeOut`。 */
    fadeElapsed: number;
    /** 余韵开始时的可见度（正常是 1；淡入未满就结束时会 < 1）。 */
    fadeVis0: number;
}
/** 新状态（未启动）。 */
export declare function createState(): DropletState;
/**
 * 尾长映射（2026-10-14 一帆「一开始动就应该有一点基础尾巴」）。
 *
 * ```
 * 跨角(T) = ARC_MAX · born(T) · [ ARC_MIN/ARC_MAX + (1 − ARC_MIN/ARC_MAX)·grow(T) ]
 *   born(T) = min(T / T_BORN, 1)                     —— 出生段：0 → ARC_MIN
 *   grow(T) = √(clamp((T − T₀)/(Tmax − T₀), 0, 1))   —— 生长段：T₀ 之后往 ARC_MAX
 * ```
 *
 * 两段的用意：`T₀` 之前恒为 0 的旧版是**光球干绕**——「读 = 展开」唯一的
 * 时间箭头，正好在最该看见的开头缺席。`T ≥ T₀` 时 `born ≡ 1` ⟹ 退化成
 * 原曲线，老读数不变。
 *
 * @param T - 已进行秒数。
 * @returns 归一化尾长 0..1（T ≤ 0 取 0）。
 */
export declare function tailLen(T: number): number;
/**
 * 尾长 → 实际跨角（度）。
 * @param T - 已进行秒数。
 * @returns 跨角（度）。
 */
export declare function tailArc(T: number): number;
/**
 * 球扫过文字那一侧时，文字亮多少：0 = 常态，1 = 最亮。
 *
 * 度量用球心的**朝向文字的分量** `cos(2πu)`：文字在按钮右侧 ⟹ `u=0`
 * （球在最右）最近、`u=0.5` 最远。取三次方是**窗口宽度**的选择（不是美术
 * 选择）：`glow ≥ 0.5` 的窗口 `|θ| ≤ 37°`，1.2s/圈下亮约 0.25s——
 * 短到像「擦过」，长到眼睛跟得上（实测占一圈 20.8%）。
 *
 * @param u - 球相位（圈）。
 * @returns 亮度目标 0..1。
 */
export declare function glowAt(u: number): number;
/**
 * 平面圆周上的位置（单位圆）。
 * @param u - 相位（圈，可为负）。
 * @returns 单位圆上的点。
 */
export declare function orbitAt(u: number): {
    x: number;
    y: number;
};
/**
 * 动作开始（活动投影从「无」变「有」，或换成另一个动作）。
 *
 * ⚠ **必须由调用方在活动变化时调用**——不能靠 `advance()` 内部比较
 * `act !== s.act` 来推断：同一类动作连续来两次（read → 空档 → read）时
 * 后者会让 `elapsed` 不归零，尾巴就不重长（第二次读没有「出生段」）。
 * 把生命周期做成显式调用，这个坑在类型层面就消失了。
 *
 * @param s - 状态。
 * @param act - 新动作（`idle` 无意义——结束请用 `endActivity`）。
 */
export declare function beginActivity(s: DropletState, act: DropletAct): void;
/**
 * 动作结束（活动投影回到「无」）——冻结尾跨角，进入余韵。
 *
 * 冻结的意义：尾形**不塌回光球**。淡出期继续按上一动作的方向走，
 * 但尾巴长度停在动作末帧的值（「余韵留在运动里，不是停在静止里」）。
 *
 * @param s - 状态。
 */
export declare function endActivity(s: DropletState): void;
/**
 * 推进一帧。
 *
 * ⚠ **顺序是硬约束**（二轮踩过的坑，`tests/droplet.spec.ts` 钉住）：
 * 先算**本帧** `vis`，再用更新后的值决定「走不走」。旧写法（先判 `vis > 0`
 * 再更新）会让淡到 0 的那一帧多走一步——看不见的位移。
 *
 * @param s - 状态（**原地修改**——每帧调用，不分配对象）。
 * @param dt - 本帧时长（秒）。
 */
export declare function advance(s: DropletState, dt: number): void;
/**
 * 画一帧。
 *
 * @param ctx - 2D 上下文。
 * @param size - canvas 逻辑边长（= `CV`）。
 * @param eff - backing store 倍率（devicePixelRatio × 放大倍数）。
 * @param s - 状态。
 */
export declare function drawFrame(ctx: CanvasRenderingContext2D, size: number, eff: number, s: DropletState, ink?: string): void;
/**
 * 绘制一帧静态水滴（`prefers-reduced-motion` 用）——不跑动画，只留形态。
 *
 * 尊重系统「减弱动态效果」：信息（正在做事）不丢，只是不闪。
 *
 * @param ctx - 2D 上下文。
 * @param size - canvas 逻辑边长。
 * @param eff - backing store 倍率。
 * @param act - 当前动作。
 */
export declare function drawStaticFrame(ctx: CanvasRenderingContext2D, size: number, eff: number, act: DropletAct, ink?: string): void;
