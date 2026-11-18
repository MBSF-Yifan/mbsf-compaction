/**
 * Settings 双版本适配层（2026-09-27 小爪）。
 *
 * 背景：ui-015 原来直接 `ctx.settingsScope.bind(...)` —— 那是 **0.1.5** 的
 * 客户端设置 API。app 版（DSH 0.1.7-rc.2）把它换掉了：
 *
 *   0.1.5：`ctx.settingsScope`（`SettingsScopeBinder`）→ `.bind(spec)`
 *          返回 `SettingsScope`，带 `getSnapshot/subscribe/set/unset/mutate`。
 *   0.1.7：没有 `settingsScope` 服务了（全库 0 命中）。取而代之的是
 *          `ctx.configForms`（`SettingsConfigForms`）→ `.get(entryId)`
 *          返回 `ConfigFormController`，方法名**逐一对应**：
 *            getSnapshot / subscribe / set / unset / mutate
 *          差异只在两处：
 *            ① 取用方式：`bind({namespace})` → `get(entryId)`
 *            ② 快照形状：0.1.5 的 `SettingsScopeSnapshot` 有
 *               `{status, value, base, user, revision, writable, mode}`；
 *               0.1.7 的 `ConfigForm` 快照把 `value` 换成 `form`（schema 投影），
 *               用户层仍是 `user`。卡片只读 `value`/`user`/`writable`/`status`，
 *               这里做一次投影补齐。
 *
 * 为什么用结构化类型而不是 import 两侧的 d.ts：ui-015 的
 * `node_modules/@deepseek-ai/*` 链到 `.runtime/dsh-0.1.5-rc.2`，import
 * 0.1.7 的类型会解析失败；而 import 0.1.5 的类型又描述不了 0.1.7 的
 * `configForms`。两侧都只用**结构**描述，运行时探测决定走哪条路，
 * 于是同一份产物在 0.1.5 与 0.1.7 上都能用。
 *
 * 兼容性纪律：本文件**不得** import 任何 dsh 运行时值（client bundle purity
 * gate 禁止跨插件 value import）；只描述形状。
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/settings-adapter
 */
/** 卡片消费的最小 scope 面（0.1.5 与 0.1.7 的交集）。 */
export interface SettingsScopeLike<T> {
    /** 当前快照（渲染器/控制器读取）。 */
    getSnapshot(): SettingsSnapshotLike<T>;
    /** 订阅快照变化，返回退订函数。 */
    subscribe(listener: () => void): () => void;
    /** 写一个字段（revision-fenced）。 */
    set(field: string, value: unknown): Promise<unknown>;
    /** 清除一个字段的 user 层覆盖。 */
    unset(field: string): Promise<unknown>;
    /** 原子批量变更。 */
    mutate(ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<unknown>;
}
/** 0.1.5 `SettingsScopeSnapshot` 与 0.1.7 `ConfigForm` 快照的公共投影。 */
export interface SettingsSnapshotLike<T> {
    /**
     * 同步状态，三态（与 `MbsfCardState.status` 一致）。
     *
     * 0.1.7 的 form 快照多一个 `idle`（「尚无答案、下次 ensure 会读」）——
     * 映射为 `loading`：对卡片而言两者都是「还没拿到文档」，而 `idle` 不是
     * 卡片需要区分的信息。
     */
    status: 'loading' | 'ready' | 'unavailable';
    /** 解析后的有效值（user 覆盖叠加 base 之上）。 */
    value?: T;
    /** 用户层覆盖（未设置时为 undefined）。 */
    user?: unknown;
    /** host 文档是否接受写入。 */
    writable: boolean;
}
/** 0.1.7 的设置路径操作（与 0.1.5 同名同形）。 */
export interface SettingsPathOp {
    op: 'set' | 'unset';
    path: string[];
    value?: unknown;
}
/** `decode`：把 host 侧 section 收窄成本插件认识的字段。 */
export type SectionDecoder<T> = (section: unknown) => T;
/**
 * 探测并绑定一个 settings 命名空间。
 *
 * 顺序：优先 0.1.5 的 `settingsScope`（它带完整的 user/base 分层），
 * 缺失时退回 0.1.7 的 `configForms`。两者都没有时返回 `undefined`——
 * 调用方据此把卡片渲染成不可用，而不是让整个插件条目炸掉。
 *
 * ⚠ 服务必须由调用方用 `ctx.get(...)` 取好后传进来，**不要**把 `ctx` 本身
 * 传进来做属性访问：0.1.7 里没有 `settingsScope` 这个服务，若把它写进
 * `inject` 声明，fiber 会永远停在 `pending (waiting for service)` ——
 * 2026-09-26 app 启动日志里的 `dsh-client-ui-settings-mbsf: pending` 就是
 * 这个原因。`ctx.get` 无 inject 守卫，取不到就是 undefined。
 *
 * @param services - 两个候选服务句柄（都可为 undefined）。
 * @param namespaces - `{ legacy, modern }` 两个命名空间名：
 *   · `legacy` = 0.1.5 的 `settingsScope` namespace（引擎经
 *     `settings.register('mbsf', …)` 注册的那个字符串）；
 *   · `modern` = 0.1.7 的 **loader entry id**（settings 文档的 ns 就是
 *     `entry.options.id`，见 dsh-settings `describe()`）。
 *   两者**不是同一个字符串**：0.1.5 是插件自报的 'mbsf'，0.1.7 是宿主装配时
 *   给条目的 id（本插件 = `mbsf-status`）。混用会得到
 *   `status: 'unavailable'`——这正是 2026-09-27 之前「配置卡打开没效果」的
 *   另一半原因（引擎的 static Config 缺席 + 卡片查错命名空间）。
 * @param decode - section 收窄函数。
 * @returns 适配后的 scope，或 `undefined`（两版 API 都不在）。
 */
export declare function bindSettingsScope<T>(services: {
    settingsScope?: unknown;
    configForms?: unknown;
}, namespaces: {
    legacy: string;
    modern: string;
}, decode: SectionDecoder<T>): SettingsScopeLike<T> | undefined;
