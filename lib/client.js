window.__ModuleLoader__.load({
	id: "mbsf-compaction",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom = require("react-dom");
		//#region lib/types/client/mbsf-remote.js
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
		/** 「原样透传」的 schema 工厂（parse 恒等），保留宽松语义：
		*  不校验 wire 形状、快照结构演进免同步。 */
		function passthroughSchemaFactory() {
			return { parse: (value) => value };
		}
		/** strict 参数/结果 codec 的公共片段（client api 的 requireStrictDescriptor 对
		*  result 与每个 parameter 都要 strict；src-json 会让整个 $mount 抛
		*  "has no strict codec"，插件加载失败——2026-09-02 修）。 */
		const STRICT = (typeSymbol) => ({
			mode: "strict",
			typeSymbol,
			schema: { parse: (value) => value },
			create: passthroughSchemaFactory
		});
		const SESSION_ID_CODEC = STRICT("mbsf-compaction/types#SessionId");
		const SESSION_OVERRIDE_CODEC = STRICT("mbsf-compaction/types#SessionOverride");
		const SESSION_CONFIG_RESULT = STRICT("mbsf-compaction/types#SessionConfigState");
		/** 会话配置端点 descriptors（与 engine status-gateway 的
		*  STATUS_CONTRIBUTION 一字不差；2026-09-02 起与 snapshot 端点合并在
		*  同一个 contribution 内——`<package>#<face>` 是 registry 唯一键，
		*  host face 只能 register 一次）。 */
		const SESSION_CONFIG_DESCRIPTORS = [
			{
				id: "mbsf-compaction#mbsfStatus/restart",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "restart",
				invocation: { kind: "direct" },
				parameters: [{
					name: "sessionId",
					wire: "sessionId",
					source: "json",
					codec: SESSION_ID_CODEC
				}],
				result: STRICT("mbsf-compaction/types#MbsfRestartResult")
			},
			{
				id: "mbsf-compaction#mbsfStatus/sessionState",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "sessionState",
				invocation: { kind: "direct" },
				parameters: [{
					name: "sessionId",
					wire: "sessionId",
					source: "json",
					codec: SESSION_ID_CODEC
				}],
				result: SESSION_CONFIG_RESULT
			},
			{
				id: "mbsf-compaction#mbsfStatus/sessionSet",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "sessionSet",
				invocation: { kind: "direct" },
				parameters: [{
					name: "sessionId",
					wire: "sessionId",
					source: "json",
					codec: SESSION_ID_CODEC
				}, {
					name: "partial",
					wire: "partial",
					source: "json",
					codec: SESSION_OVERRIDE_CODEC
				}],
				result: SESSION_CONFIG_RESULT
			},
			{
				id: "mbsf-compaction#mbsfStatus/sessionClear",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "sessionClear",
				invocation: { kind: "direct" },
				parameters: [{
					name: "sessionId",
					wire: "sessionId",
					source: "json",
					codec: SESSION_ID_CODEC
				}],
				result: SESSION_CONFIG_RESULT
			},
			{
				id: "mbsf-compaction#mbsfStatus/memoryReport",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "memoryReport",
				invocation: { kind: "direct" },
				parameters: [],
				result: STRICT("mbsf-compaction/types#MemoryReport")
			},
			{
				id: "mbsf-compaction#mbsfStatus/trimTargets",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "trimTargets",
				invocation: { kind: "direct" },
				parameters: [],
				result: STRICT("mbsf-compaction/types#MbsfTrimTargets")
			},
			{
				id: "mbsf-compaction#mbsfStatus/setTrimTarget",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "setTrimTarget",
				invocation: { kind: "direct" },
				parameters: [{
					name: "input",
					wire: "input",
					source: "json",
					codec: STRICT("mbsf-compaction/types#MbsfTrimSetInput")
				}],
				result: STRICT("mbsf-compaction/types#MbsfTrimSetResult")
			},
			{
				id: "mbsf-compaction#mbsfStatus/trimDelete",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "trimDelete",
				invocation: { kind: "direct" },
				parameters: [{
					name: "input",
					wire: "input",
					source: "json",
					codec: STRICT("mbsf-compaction/types#MbsfTrimDeleteInput")
				}],
				result: STRICT("mbsf-compaction/types#MbsfTrimDeleteResult")
			},
			{
				id: "mbsf-compaction#mbsfStatus/trimDeleted",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "trimDeleted",
				invocation: { kind: "direct" },
				parameters: [],
				result: STRICT("mbsf-compaction/types#MbsfTrimDeletedResult")
			},
			{
				id: "mbsf-compaction#mbsfStatus/trimRestore",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "trimRestore",
				invocation: { kind: "direct" },
				parameters: [{
					name: "input",
					wire: "input",
					source: "json",
					codec: STRICT("mbsf-compaction/types#MbsfTrimRestoreInput")
				}],
				result: STRICT("mbsf-compaction/types#MbsfTrimRestoreResult")
			},
			{
				id: "mbsf-compaction#mbsfStatus/reclaimMemory",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "reclaimMemory",
				invocation: { kind: "direct" },
				parameters: [],
				result: STRICT("mbsf-compaction/types#MbsfReclaimResult")
			}
		];
		/** 浏览器半装配的 Remote contribution（host 端 mbsf-status 插件实现同契约）。 */
		const TYPERT_REMOTE = {
			package: "mbsf-compaction",
			descriptors: [{
				id: "mbsf-compaction#mbsfStatus/snapshot",
				service: "mbsfStatus",
				namespace: "mbsfStatus",
				method: "snapshot",
				invocation: { kind: "direct" },
				parameters: [],
				result: STRICT("mbsf-compaction/types#MbsfStatusSnapshot")
			}, ...SESSION_CONFIG_DESCRIPTORS]
		};
		//#endregion
		//#region lib/types/client/mbsf-card-controller.js
		/**
		* 未必记忆配置卡片的 staged form
		*
		* 平台惯例（ui-settings-plugins 的 CardForm）是「staged + save」：用户先改
		* 草稿，保存时才整批写入 settings 文档。该 CardForm 是 ui-settings-plugins
		* 的私有实现（仅导出类型，且跨包 value import 被 client bundle purity
		* gate 禁止），这里为 boolean 开关写一个等价的最小实现：切换只进 staged，
		* 保存经 scope.set 写 host（revision-fenced），读回 host 确认。
		*/
		/** 未必记忆配置 namespace（与 host 端 status-gateway 注册的字符串一致）。 */
		const ESHEEP_NS = "mbsf";
		/** cleanupPruneTurns 的合法域钳制：0 或 >= 3（落进 1、2 的输入钳到 3）。
		*  `min` 属性只能表达一个下界，区间内的空洞由本函数在 commit 时补齐。 */
		function normalizeCleanupPruneTurns(value) {
			return value > 0 && value < 3 ? 3 : value;
		}
		/** compactTailMessages 的合法域钳制：8–256（与引擎侧 COMPACT_TAIL_MESSAGES_*
		*  同域——UI 侧重复一份以保持 client bundle 对引擎零依赖）。 */
		function normalizeCompactTailMessages(value) {
			if (!Number.isFinite(value)) return 64;
			return Math.min(256, Math.max(8, Math.round(value)));
		}
		/** dshHeapMb 的合法域钳制：0 或 >= 4096（落进 1..4095 的输入钳到 4096）。
		*  低于 node 默认上限（本机实测 4288MB）的注入值只会让 OOM 提前——无意义。
		*  与引擎侧 normalizeDshHeapMb 同域（UI 侧重复一份以保持 client bundle
		*  对引擎零依赖）。 */
		function normalizeDshHeapMb(value) {
			if (!Number.isFinite(value) || value <= 0) return 0;
			if (value < 4096) return 4096;
			return Math.floor(value / 1024) * 1024;
		}
		/** autoReclaimThresholdPct 的合法域钳制：20–95（与引擎侧 AUTO_RECLAIM_PCT_*
		*  同域——UI 侧重复一份以保持 client bundle 对引擎零依赖）。
		*
		*  下界 20 防「一启动就清」（启动窗口缓存在建，清了必白清）；上界 95 留安全
		*  余量（100% = 已经 OOM 了，来不及清）。 */
		function normalizeAutoReclaimPct(value) {
			if (!Number.isFinite(value)) return 60;
			return Math.min(95, Math.max(20, Math.round(value)));
		}
		/** 滑块上界的兜底值（快照到位前）——16GB 机器的引擎侧默认（物理内存 −
		*  6GB 系统保留）。快照到位后立刻被真实值替换（`setHeapMax`）。 */
		const DEFAULT_HEAP_MAX_MB = 10240;
		/** 一个 boolean 字段的 staged form（staged + save 语义）。 */
		var MbsfCardController = class {
			scope;
			staged = /* @__PURE__ */ new Map();
			stagedNumbers = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			saving = false;
			failed = false;
			/** 自动保存的防抖句柄（2026-11-08 一帆：设置改完自动存，不必点保存按钮）。 */
			pendingSave = null;
			/** 上次保存读回自检失败的字段名（见 `MbsfCardState.failedFields`）。 */
			failedFields = [];
			/** 本机堆上限（滑块上界）——由 `setHeapMax` 从 status 快照更新。 */
			heapMaxMb = DEFAULT_HEAP_MAX_MB;
			/** 实际生效的堆上限（MB）——由 `setHeapLimit` 从 status 快照更新。
			*  0 = 未知（快照未到位——UI 只显示百分比，不做 MB 换算）。 */
			heapLimit = 0;
			/**
			* @param scope - 绑定的设置作用域；`undefined` = 宿主两版 API 都没有
			*   （卡片渲染为不可用，但状态页与浮窗照常）。
			*/
			constructor(scope) {
				this.scope = scope;
				scope?.subscribe(() => this.publish());
			}
			/** 构建卡片快照 store（渲染器绑定）。 */
			bind() {
				const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.projection());
				this.listeners.add(() => {
					store.set(this.projection());
				});
				return store;
			}
			projection() {
				if (this.scope === void 0) return {
					available: false,
					status: "unavailable",
					writable: false,
					dirty: this.staged.size > 0 || this.stagedNumbers.size > 0,
					saving: this.saving,
					failed: this.failed,
					failedFields: this.failedFields,
					injectEnabled: this.field("injectEnabled"),
					dateAnchorEnabled: this.field("dateAnchorEnabled"),
					autoCompact: this.field("autoCompact"),
					restartCleanupEnabled: this.field("restartCleanupEnabled"),
					restartButtonVisible: this.field("restartButtonVisible"),
					activityIndicatorEnabled: this.field("activityIndicatorEnabled"),
					activityLabelEnabled: this.field("activityLabelEnabled"),
					cleanupPruneTurns: this.numberField("cleanupPruneTurns"),
					backupKeepCount: this.numberField("backupKeepCount"),
					sessionStreamKeepCount: this.numberField("sessionStreamKeepCount"),
					dshHeapMb: this.numberField("dshHeapMb"),
					autoReclaimEnabled: this.field("autoReclaimEnabled"),
					autoReclaimThresholdPct: this.numberField("autoReclaimThresholdPct"),
					compactTailMessages: this.numberField("compactTailMessages"),
					dshHeapMaxMb: this.heapMaxMb,
					heapLimitMb: this.heapLimit
				};
				const snapshot = this.scope.getSnapshot();
				return {
					available: snapshot.status === "ready",
					status: snapshot.status,
					writable: snapshot.writable,
					dirty: this.staged.size > 0 || this.stagedNumbers.size > 0,
					saving: this.saving,
					failed: this.failed,
					failedFields: this.failedFields,
					injectEnabled: this.field("injectEnabled"),
					dateAnchorEnabled: this.field("dateAnchorEnabled"),
					autoCompact: this.field("autoCompact"),
					restartCleanupEnabled: this.field("restartCleanupEnabled"),
					restartButtonVisible: this.field("restartButtonVisible"),
					activityIndicatorEnabled: this.field("activityIndicatorEnabled"),
					activityLabelEnabled: this.field("activityLabelEnabled"),
					cleanupPruneTurns: this.numberField("cleanupPruneTurns"),
					backupKeepCount: this.numberField("backupKeepCount"),
					sessionStreamKeepCount: this.numberField("sessionStreamKeepCount"),
					dshHeapMb: this.numberField("dshHeapMb"),
					autoReclaimEnabled: this.field("autoReclaimEnabled"),
					autoReclaimThresholdPct: this.numberField("autoReclaimThresholdPct"),
					compactTailMessages: this.numberField("compactTailMessages"),
					dshHeapMaxMb: this.heapMaxMb,
					heapLimitMb: this.heapLimit
				};
			}
			/** 更新滑块上界（status 快照的 `heap.maxMb` 到位后调用——引擎按物理
			*  内存算出，UI 不猜）。值未变则不发通知（防无谓重渲染）。 */
			setHeapMax(maxMb) {
				if (!Number.isFinite(maxMb) || maxMb <= 0) return;
				const next = Math.max(4096, Math.floor(maxMb));
				if (next === this.heapMaxMb) return;
				this.heapMaxMb = next;
				this.publish();
			}
			/** 更新**实际生效**的堆上限（status 快照的 `heap.limitMb` 到位后调用）。
			*
			*  用于把百分比阈值换算成 MB 显示（「60% ≈ 2515 MB」）。必须用真实生效值
			*  而非配置值——App 形态下 `dshHeapMb` 不生效（实测 4192 vs 10240）。
			*  值未变则不发通知（防无谓重渲染）。 */
			setHeapLimit(limitMb) {
				if (!Number.isFinite(limitMb) || limitMb <= 0) return;
				const next = Math.floor(limitMb);
				if (next === this.heapLimit) return;
				this.heapLimit = next;
				this.publish();
			}
			numberField(field) {
				const staged = this.stagedNumbers.get(field);
				const resolved = this.sectionValue(field);
				const fallback = field === "backupKeepCount" ? 3 : field === "sessionStreamKeepCount" ? 200 : field === "dshHeapMb" ? 8192 : field === "autoReclaimThresholdPct" ? 60 : field === "compactTailMessages" ? 12 : 0;
				return {
					value: staged ?? (typeof resolved === "number" && Number.isFinite(resolved) ? resolved : fallback),
					overridden: staged !== void 0 ? true : this.stored(field)
				};
			}
			/** 设置一个数值字段（进 staged）。 */
			setNumber(field, value) {
				if (!Number.isFinite(value) || value < 0) return;
				const next = field === "cleanupPruneTurns" ? normalizeCleanupPruneTurns(value) : field === "dshHeapMb" ? normalizeDshHeapMb(value) : field === "autoReclaimThresholdPct" ? normalizeAutoReclaimPct(value) : field === "compactTailMessages" ? normalizeCompactTailMessages(value) : value;
				if (next === this.numberField(field).value) return;
				this.stagedNumbers.set(field, next);
				this.failed = false;
				this.failedFields = [];
				this.publish();
				this.scheduleSave();
			}
			/**
			* 防抖自动保存（2026-11-08 一帆：改完自动存，不必点保存按钮）。
			*
			* 为什么要防抖而不是每次立刻写：滑块/数字框在拖动时会连续触发 commit，
			* 逐次写盘既浪费又会让「保存中…」闪烁。250ms 是手感与延迟的折中——
			* 手一停就存上了，用户看不到「未保存」状态。
			*/
			scheduleSave() {
				if (this.scope === void 0) return;
				if (this.pendingSave !== null) clearTimeout(this.pendingSave);
				this.pendingSave = setTimeout(() => {
					this.pendingSave = null;
					this.save();
				}, 250);
			}
			field(field) {
				const staged = this.staged.get(field);
				const resolved = this.sectionValue(field);
				return {
					value: staged ?? (typeof resolved === "boolean" ? resolved : false),
					overridden: staged !== void 0 ? true : this.stored(field)
				};
			}
			/** 切换一个开关（staged 反相；未 staged 时相对当前解析值反相）。 */
			toggle(field) {
				const current = this.field(field).value;
				this.staged.set(field, !current);
				this.failed = false;
				this.failedFields = [];
				this.publish();
				this.scheduleSave();
			}
			/** 清除一个字段的 user 层覆盖（= 重新继承 base）。 */
			resetField(field) {
				if (this.staged.has(field)) {
					this.staged.delete(field);
					this.publish();
					this.scheduleSave();
					return;
				}
				if (this.stagedNumbers.has(field)) {
					this.stagedNumbers.delete(field);
					this.publish();
					this.scheduleSave();
					return;
				}
				if (this.scope === void 0) {
					this.failed = true;
					this.publish();
					return;
				}
				this.scope.unset(field).then(() => {
					if (this.stored(field)) this.failed = true;
					this.publish();
				});
			}
			/** 放弃所有 staged 改动。 */
			discard() {
				if (this.pendingSave !== null) {
					clearTimeout(this.pendingSave);
					this.pendingSave = null;
				}
				if (this.staged.size === 0 && this.stagedNumbers.size === 0 && !this.failed) return;
				this.staged.clear();
				this.stagedNumbers.clear();
				this.failed = false;
				this.failedFields = [];
				this.publish();
			}
			/** 逐字段写入 host 并读回确认；失败保留 staged 供修正。
			*
			*  ── 读回自检为什么是两层（2026-10-14 加，防「保存成反值」）──────────
			*  只查 user 层（原实现）能发现「没写进去」，但发现不了**写进去的是反值**
			*  这一类：用户按自己看到的开关状态点击，写入值由 `!current` 反相得来——
			*  若「看到的」本身是错的（解码漏字段 → 渲染回落成默认 `false`），
			*  那么用户点「关」时反相算出的是 `true`，**写进去的与意图相反，且一路
			*  静默**：`scope.set` 成功、user 层确实等于写入值、界面显示「已保存」。
			*
			*  两层自检把这条堵死：
			*    ① **user 层**：写入确实落到了用户覆盖层（原检查）；
			*    ② **解析值**：`sectionValue()` 读回来的值 = 界面显示的值 = 用户意图。
			*  两层都相等才算成功。第 ② 层是新增的那一层——它比对的正是**用户眼睛
			*  看到的那个数**，所以「显示与意图不一致」必然被抓到。
			*
			*  失败时记录**字段名**（`failedFields`）——静默错误之所以难查，就是因为
			*  只报「保存失败」而不说哪个字段。 */
			async save() {
				if (this.staged.size === 0 && this.stagedNumbers.size === 0 || this.saving) return;
				if (this.scope === void 0) {
					this.failed = true;
					this.publish();
					return;
				}
				this.saving = true;
				this.failed = false;
				this.failedFields = [];
				this.publish();
				const failed = [];
				for (const [field, value] of [...this.staged, ...this.stagedNumbers]) try {
					await this.scope.set(field, value);
					if (this.userLayer()?.[field] !== value || this.sectionValue(field) !== value) failed.push(field);
				} catch {
					failed.push(field);
				}
				const landed = failed.length === 0;
				if (landed) {
					this.staged.clear();
					this.stagedNumbers.clear();
				}
				this.saving = false;
				this.failed = !landed;
				this.failedFields = failed;
				this.publish();
			}
			sectionValue(field) {
				if (this.scope === void 0) return void 0;
				return this.scope.getSnapshot().value?.[field];
			}
			userLayer() {
				if (this.scope === void 0) return void 0;
				return this.scope.getSnapshot().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region lib/types/client/mbsf-logo.js
		/**
		* 品牌图三张（全部内联 data URL，插件不分发二进制资源）：
		*
		*  1. `MBSF_LOGO_ZH_DATA_URL` —— 「未必科幻.jpeg」256px，**输入框旁小按钮**的中文形态。
		*  2. `MBSF_LOGO_EN_DATA_URL` —— 「MBSF_logo.jpg」256px，小按钮的英文形态。
		*     小按钮按界面语言切换这两张（2026-11-07 一帆：保持现状）。
		*  3. `MBSF_LOGO_LOCKUP_DATA_URL` —— 设置页品牌区的**双语合体 logo**（未必科幻 +
		*     MAYBE SCI-FI），固定不随语言变化。
		*
		* 重新生成（256px，2x 屏清晰度）：
		*   sips -s format jpeg -s formatOptions 78 -Z 256 ~/Desktop/未必科幻.jpeg --out /tmp/zh.jpg
		*   sips -s format jpeg -s formatOptions 78 -Z 256 ~/Desktop/MBSF_logo.jpg --out /tmp/en.jpg
		* 然后 base64 编码替换下面三条常量。
		*
		* ⚠️ **每条常量必须写成单行字符串**（2026-11-07 踩过）：分块写成
		*     'aaa'
		*     'bbb'
		* 不是字符串拼接——JS 没有隐式字面量拼接，那是两条独立的表达式语句，
		* 常量只会拿到第一块（合体图当时只导出了 57 字节，界面直接空白，
		* 而 tsc/构建/原有测试全绿）。tests/logo-assets.spec.ts 现在守着这条。
		*/
		const MBSF_LOGO_ZH_DATA_URL = "data:image/jpeg;base64,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";
		const MBSF_LOGO_EN_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QCgRXhpZgAATU0AKgAAAAgABAEaAAUAAAABAAAAPgEbAAUAAAABAAAARgEoAAMAAAABAAIAAIdpAAQAAAABAAAATgAAAAAAAABIAAAAAQAAAEgAAAABAASQBAACAAAAFAAAAISgAQADAAAAAQABAACgAgAEAAAAAQAAAQCgAwAEAAAAAQAAAQAAAAAAMjAyNjowOTowNCAxODowNzoyNQD/4QoJaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyNi0wOS0wNFQxODowNzoyNSI+IDxkYzp0aXRsZT4gPHJkZjpBbHQ+IDxyZGY6bGkgeG1sOmxhbmc9IngtZGVmYXVsdCI+Tk5TRl9sb2dvPC9yZGY6bGk+IDwvcmRmOkFsdD4gPC9kYzp0aXRsZT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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3El3ezSXE8rF5JZWLuzHklmOSSe5Nf1Q/wDBHklv2RsE5/4qXUOv0ir+Vev6p/8Agjx/yaOf+xl1D+UVAH6iy6RpU7bprK3kPq0aE/qKaNG0gDAsbYf9sk/wrSooAq29jZWjFrW3ihLDBMaKpI98CrVFFABRRRQB/9T9/KKKKAPhn9uX9jq5/bE8KeGPDVt4mTwyfD2oTXxle2Nz5vmxeXtADpjHXPNfmx/w481P/oq8H/grb/5Ir+g2igD4/wD2Kv2Wrj9kn4V33w3uPECeI2vNYm1QXSW5twoliij2bC75x5ec5719gUUUAFFFFAHm/wAYfAL/ABT+Ffiz4bx3g09vE2kXWli7ZPMEJuIzHvKZXdtznGRmvw6/4cean/0VeD/wVt/8kV/QbRQB+Sv7If8AwTO1f9lX4st8VYfHlv4gmTSbvT4rNrF4F8y4C7HZ/Nc7VK8gDJFeO6z/AMEdtb+JPxB1n4hfFr4sm6vdf1CXUL8aZpu1meZyzKjzTEIADtXKNgAcV+5lFAH5zRf8Euv2XLX4SXXwosLPVrQ38sc95r0N2RqM8kQPl+a+3ymiUneIfL8vcA2NwBr5Huf+CK2l6dNdJ4W+KVwdPuxskstU0tJg6g5XdJDPF8ynkMqqQencV+6NFAH8+Or/APBEDVjJE+hfFG2VGX96l1p7/K3fYyS/MPqAR056n234Tf8ABF74PeGb+DVPit4r1Pxj5RDnT7WNdPtWI7SMrSTMP910zX7Q0UAeKwfs7fBWCy0HSB4S059J8LAHRdKkjD2NnIP+W0dq2YjMf+ezq0nXDDJz7PFFFBGsMKLHGgCqqgAADoAB0FPooARlV1KOAysMEHkEGvh349f8E8P2Yfj89xqmteG18O6/cZLax4fK2k7Mf4pYwphlPqXjLH1r7jooA/n+1f8A4IfSHVc6D8VQums2cXmm5nVfTMcwRiPX5c+gr2zwD/wR3+Hfhq6e01/xhe32lTqqXxtYVgvbyPgvCbgsy20DkfMkKGRhw0pHFfsrRQBxPw8+HPgj4UeErHwL8O9HttC0PTk2wWlqu1QT952Jyzux5Z2JZjySa+c/21f2Wbj9rf4XWHw5tvECeHGstXi1Q3T25uAwjikj2bA6YzvznPavsKigD+fL/hx5qf8A0VeD/wAFbf8AyRX6u/sa/s0T/spfCA/C6411PETf2ncah9sSA24xOFGzYXfpt65r6wooAKKKKACiiigAooooA//V/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9b9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q==";
		const MBSF_LOGO_LOCKUP_DATA_URL = "data:image/jpeg;base64,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";
		/**
		* 狐狸图形（透明底 PNG，128px）——**设置页导航图标**用。
		*
		* 只有形状没有颜色：前端用 CSS `mask-image` + `background: currentColor`
		* 上色，所以深色主题下不会变成一块白砖（2026-11-07 一帆：设置页标签左边
		* 的齿轮，换成 logo 的图形部分）。透明底由 `compose-brand-lockup.py` 的
		* `make_glyph()` 从原图白底转 alpha 生成。
		*/
		const MBSF_LOGO_GLYPH_DATA_URL = "data:image/png;base64,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";
		//#endregion
		//#region lib/types/client/brand-nav-icon.js
		/**
		* 设置页导航图标：把宿主默认的齿轮换成品牌图形（2026-11-07 一帆）。
		*
		* ## 为什么不是「注册时传个 icon」
		*
		* `settings.section` 的可选项只有 `id / order / label / locale / inject`——
		* 没有 icon 字段。导航图标由宿主 `dsh-client-ui-settings-general` 里一个写死的
		* `navIcon(id)` 决定：认识 `models` / `agent-presets` / `plugins` 三个 id，
		* **其余一律回落到齿轮**。我们没有官方扩展点可用。
		*
		* ## 为什么是「隐藏 + 旁边插一个」而不是「替换掉」
		*
		* 那个 `<svg>` 是 React 渲染的节点。把它从 DOM 里换成别的标签，等于在 React
		* 不知情的情况下抽走它持有的子节点——后续任何一次 re-render / 卸载都可能抛
		* `NotFoundError: The node to be removed is not a child of this node`。
		* 所以这里只做两件 React 能容忍的事：
		*   1. 把原 svg 设为 `display:none`（样式层面，不碰树）
		*   2. 在它**旁边**插一个 `span`（多一个兄弟节点，React 不持有它）
		*
		* ## 为什么用 mask 而不是 <img>
		*
		* 合体图是黑字白底 JPEG；导航栏要跟随主题（深色模式下白底图标 = 一块白砖）。
		* `mask-image` + `background: currentColor` 只取形状、颜色交给 CSS，两套主题
		* 都不用出第二张图。所以 `MBSF_LOGO_GLYPH_DATA_URL` 是**透明底 PNG**。
		*
		* ## 失效姿态
		*
		* 认不出导航条（宿主改了结构 / 改了 class / 改成了别的标签）→ 什么都不做，
		* 界面上仍然是原来的齿轮。这是个装饰性改动，退化不该比没有更糟。
		*/
		const MARK = "mbsfBrandIcon";
		const DEFAULT_SIZE = 16;
		const DEBOUNCE_MS = 120;
		function iconElement(size) {
			const span = document.createElement("span");
			span.setAttribute(MARK, "1");
			span.setAttribute("aria-hidden", "true");
			span.style.display = "inline-block";
			span.style.flex = "0 0 auto";
			span.style.width = `${size}px`;
			span.style.height = `${size}px`;
			span.style.backgroundColor = "currentColor";
			const mask = `url("${MBSF_LOGO_GLYPH_DATA_URL}")`;
			span.style.maskImage = mask;
			span.style.maskSize = "contain";
			span.style.maskRepeat = "no-repeat";
			span.style.maskPosition = "center";
			span.style.setProperty("-webkit-mask-image", mask);
			span.style.setProperty("-webkit-mask-size", "contain");
			span.style.setProperty("-webkit-mask-repeat", "no-repeat");
			span.style.setProperty("-webkit-mask-position", "center");
			return span;
		}
		/**
		* 给「文字等于本插件导航名」的那个按钮补上品牌图形。
		*
		* @param label 当前语言的导航名（`t('nav')`——所有语言都是「未必科幻MBSF」）
		* @returns 是否找到了目标按钮（找不到 = 面板还没打开，不算错误）
		*/
		function decorateNavIcon(label) {
			if (typeof document === "undefined") return false;
			const wanted = label.trim();
			if (!wanted) return false;
			const dialogs = Array.from(document.querySelectorAll("[role=\"dialog\"]"));
			if (dialogs.length === 0) return false;
			const scopeButtons = dialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll("button")));
			const buttons = scopeButtons.length > 0 ? scopeButtons : Array.from(document.querySelectorAll("button"));
			for (const button of buttons) {
				if (button.children.length === 0) continue;
				if ((button.textContent ?? "").trim() !== wanted) continue;
				if (button.querySelector(`[${MARK}]`) !== null) return true;
				const svg = button.querySelector("svg");
				if (svg === null) continue;
				const size = Number(svg.getAttribute("width")) || DEFAULT_SIZE;
				svg.style.display = "none";
				svg.insertAdjacentElement("afterend", iconElement(size));
				return true;
			}
			return false;
		}
		/**
		* 装上观察器：设置面板每次打开都是新挂载的 DOM，所以不能只在启动时做一次。
		* 监视 `body` 的子树变化，去抖后重扫——命中即幂等（已替换过会直接返回）。
		*
		* @returns 拆卸函数（插件卸载 / 热重载时调用）
		*/
		function watchNavIcon(label) {
			if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
			let timer = null;
			const run = () => {
				timer = null;
				try {
					decorateNavIcon(label());
				} catch {}
			};
			const schedule = () => {
				if (timer !== null) return;
				timer = setTimeout(run, DEBOUNCE_MS);
			};
			run();
			const observer = new MutationObserver(schedule);
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			return () => {
				observer.disconnect();
				if (timer !== null) clearTimeout(timer);
			};
		}
		//#endregion
		//#region lib/types/client/settings-adapter.js
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
		function bindSettingsScope(services, namespaces, decode) {
			const binder = services.settingsScope;
			const forms = services.configForms;
			if (typeof binder?.bind === "function") return binder.bind({
				namespace: namespaces.legacy,
				decode
			});
			if (typeof forms?.get === "function") {
				const form = forms.get(namespaces.modern);
				return {
					getSnapshot: () => {
						const snap = form.getSnapshot();
						const raw = snap.value ?? snap.form ?? {};
						return {
							status: normalizeStatus(snap.status),
							value: decode(raw),
							user: snap.user,
							writable: snap.writable ?? false
						};
					},
					subscribe: (listener) => form.subscribe(listener),
					set: (field, value) => form.set(field, value),
					unset: (field) => form.unset(field),
					mutate: (ops, expectedRevision) => form.mutate(ops, expectedRevision)
				};
			}
		}
		/** 把两版可能的状态字符串收窄到卡片认识的三态。 */
		function normalizeStatus(status) {
			switch (status) {
				case "ready": return "ready";
				case "loading": return "loading";
				case "idle": return "ready";
				case "unavailable": return "unavailable";
				default: return "unavailable";
			}
		}
		//#endregion
		//#region lib/types/client/settings-decode.js
		/**
		* 设置文档 section → `MbsfSettings` 的解码。
		*
		* 从 `index.ts` 的 `install()` 闭包里提出来（2026-09-27）——原因见下。
		*
		* ## 为什么单独成模块
		*
		* 这段逻辑原先埋在 `install()` 内，是闭包，**测不到也查不了**。它漏解码了
		* `autoReclaimEnabled` 等 3 个字段 → 用户点开开关、保存成功（`config.json`
		* 里 `autoReclaimEnabled: true` 落盘无误），但界面读回来是 `undefined`，
		* 渲染回落成默认 `false` ——「保存后弹回」。
		*
		* 病理在于：**写路径没坏，只有读路径坏了**。所以症状是「明明存进去了却显示关」，
		* 而不是「存不进去」。加了字段忘了在这儿加一行 `if`，就复现一次，且**静默**
		* （没有 UI 的字段连症状都没有）。
		*
		* 提出来的目的 = 让它可被 `scripts/check-settings-decode.mjs` 静态 + 行为双重
		* 校验：每次构建时把 `MbsfRuntimeConfig` 的字段名与下面的表做差集，漏一个就
		* 构建失败。**加字段忘了改这里 → 机器拦住，不再靠人肉发现。**
		*
		* ## 加字段时怎么做
		*
		* 1. 在 `runtime-config.ts` 的 `MbsfRuntimeConfig` 加字段（带默认值 + 注释）
		* 2. 在 `mbsf-card-controller.ts` 的 `MbsfSettings` 加同名字段
		* 3. **在下面的 `FIELD_DECODERS` 加一行**
		*
		* 漏了第 3 步 → `pnpm build` 会在 `tsc` 之后直接失败并指名道姓报出字段。
		*/
		/**
		* `MbsfRuntimeConfig` 里那些**必须在设置文档里能读到**的字段。
		*
		* 与 `MbsfSettings` 的键集一致（`Record` 类型已强制），此处导出供构建期
		* 校验脚本交叉比对——脚本不去猜，直接用这一份。
		*/
		const MBSF_SETTINGS_FIELDS = [
			"injectEnabled",
			"dateAnchorEnabled",
			"autoCompact",
			"restartCleanupEnabled",
			"cleanupPruneTurns",
			"backupKeepCount",
			"restartButtonVisible",
			"sessionStreamKeepCount",
			"dshHeapMb",
			"autoReclaimEnabled",
			"autoReclaimThresholdPct",
			"compactTailMessages",
			"activityIndicatorEnabled",
			"activityLabelEnabled"
		];
		/** 布尔域唯一的判定。 */
		const isBoolean = (raw) => typeof raw === "boolean";
		/** 数字域唯一的判定——`Number.isFinite` 挡住 `NaN` / `Infinity`。 */
		const isFiniteNumber = (raw) => typeof raw === "number" && Number.isFinite(raw);
		/**
		* **字段名 → 合法值判定**表。
		*
		* 键名必须与 `MbsfRuntimeConfig` / `MbsfSettings` 的字段名**逐字一致**——
		* `check-settings-decode.mjs` 会核这一点（`Record<keyof MbsfSettings, …>` 在
		* 类型层也强制：漏一个 `tsc` 就报）。
		*/
		const FIELD_GUARDS = {
			injectEnabled: isBoolean,
			dateAnchorEnabled: isBoolean,
			autoCompact: isBoolean,
			restartCleanupEnabled: isBoolean,
			cleanupPruneTurns: isFiniteNumber,
			backupKeepCount: isFiniteNumber,
			restartButtonVisible: isBoolean,
			sessionStreamKeepCount: isFiniteNumber,
			dshHeapMb: isFiniteNumber,
			autoReclaimEnabled: isBoolean,
			autoReclaimThresholdPct: isFiniteNumber,
			compactTailMessages: isFiniteNumber,
			activityIndicatorEnabled: isBoolean,
			activityLabelEnabled: isBoolean
		};
		/**
		* 把设置文档的 section 收窄成 `MbsfSettings`。
		*
		* **缺席与非法都映射成 `undefined`**（不写进输出对象），让下游 `?? 默认值`
		* 生效；不要用 `false` / `0` 顶替——那会混淆「字段没存过」和「显式存了 false」。
		*
		* @param section - 宿主给的原始 section（可能是 `null`、字符串或任意对象）。
		* @returns 只含合法字段的对象；`section` 不是对象时返回 `{}`。
		*/
		function decodeMbsfSettings(section) {
			if (section === null || typeof section !== "object") return {};
			const record = section;
			const out = {};
			for (const field of MBSF_SETTINGS_FIELDS) {
				const raw = record[field];
				if (FIELD_GUARDS[field](raw)) out[field] = raw;
			}
			return out;
		}
		//#endregion
		//#region \0dsh-css:/Users/ai/Desktop/未必科幻 Harness/mbsf-split/03-dsh/src/client/MbsfConfigCard.module.css.mjs
		const css$4 = ".X8AGHq_card{border:1px solid var(--border-color,#7f7f7f4d);background:var(--surface-1,#ffffff08);border-radius:10px;flex-direction:column;gap:12px;padding:14px 16px;display:flex}.X8AGHq_header{flex-wrap:wrap;align-items:baseline;gap:12px;display:flex}.X8AGHq_heading{align-items:baseline;gap:8px;display:flex}.X8AGHq_heading strong{font-size:14px}.X8AGHq_description{opacity:.75;font-size:12px}.X8AGHq_hint{opacity:.55;margin-left:auto;font-size:11px}.X8AGHq_fields{flex-direction:column;gap:10px;display:flex}.X8AGHq_row{flex-direction:column;gap:4px;display:flex}.X8AGHq_rowBody{align-items:center;gap:10px;display:flex}.X8AGHq_switch{cursor:pointer;align-items:center;gap:10px;display:inline-flex}.X8AGHq_switch input{opacity:0;pointer-events:none;position:absolute}.X8AGHq_track{background:#7f7f7f59;border-radius:999px;flex:none;width:36px;height:20px;transition:background .15s;position:relative}.X8AGHq_thumb{background:#fff;border-radius:50%;width:16px;height:16px;transition:transform .15s;position:absolute;top:2px;left:2px}.X8AGHq_switch input:checked+.X8AGHq_track{background:var(--accent,#4a90d9)}.X8AGHq_switch input:checked+.X8AGHq_track .X8AGHq_thumb{transform:translate(16px)}.X8AGHq_switch input:disabled+.X8AGHq_track{opacity:.5}.X8AGHq_rowLabel{font-size:13px}.X8AGHq_overridden{color:inherit;cursor:pointer;opacity:.7;background:0 0;border:1px solid #7f7f7f66;border-radius:999px;padding:1px 6px;font-size:10px}.X8AGHq_overridden:hover{opacity:1}.X8AGHq_rowHint{opacity:.6;margin:0;font-size:11px;line-height:1.5}.X8AGHq_sliderValue{font-variant-numeric:tabular-nums;text-align:right;opacity:.85;min-width:4.5rem;font-size:12px}.X8AGHq_heapBar{background:#7f7f7f40;border-radius:999px;height:6px;position:relative;overflow:hidden}.X8AGHq_heapBarFill{background:var(--accent,#4a90d9);border-radius:999px;transition:width .3s;position:absolute;inset:0 auto 0 0}.X8AGHq_heapBarFill[data-warn=true]{background:#e5484d}.X8AGHq_heapLine{font-variant-numeric:tabular-nums;align-items:baseline;gap:8px;font-size:12px;display:flex}.X8AGHq_heapLine .X8AGHq_muted{opacity:.6;font-size:11px}.X8AGHq_actions{align-items:center;gap:8px;display:flex}.X8AGHq_status{opacity:.7;margin-right:auto;font-size:11px}.X8AGHq_status[data-failed=true]{color:#e5484d;opacity:1}.X8AGHq_button{color:inherit;cursor:pointer;background:0 0;border:1px solid #7f7f7f66;border-radius:6px;padding:4px 12px;font-size:12px}.X8AGHq_button:hover:not(:disabled){background:#7f7f7f26}.X8AGHq_button:disabled{opacity:.4;cursor:default}.X8AGHq_group{border-left:2px solid #80808040;flex-direction:column;gap:10px;margin-left:10px;padding-left:12px;display:flex}.X8AGHq_dangerHint{color:#d9534f;background:#d9534f14;border-left:3px solid #d9534f;border-radius:4px;margin:0;padding:8px 10px;font-size:12px;line-height:1.6}";
		const tagId$4 = "mbsf-compaction/MbsfConfigCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "mbsf-compaction";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var MbsfConfigCard_module_css_default = {
			"dangerHint": "X8AGHq_dangerHint",
			"muted": "X8AGHq_muted",
			"actions": "X8AGHq_actions",
			"switch": "X8AGHq_switch",
			"heading": "X8AGHq_heading",
			"row": "X8AGHq_row",
			"rowBody": "X8AGHq_rowBody",
			"track": "X8AGHq_track",
			"rowLabel": "X8AGHq_rowLabel",
			"fields": "X8AGHq_fields",
			"description": "X8AGHq_description",
			"sliderValue": "X8AGHq_sliderValue",
			"header": "X8AGHq_header",
			"thumb": "X8AGHq_thumb",
			"heapBar": "X8AGHq_heapBar",
			"group": "X8AGHq_group",
			"card": "X8AGHq_card",
			"hint": "X8AGHq_hint",
			"overridden": "X8AGHq_overridden",
			"rowHint": "X8AGHq_rowHint",
			"button": "X8AGHq_button",
			"heapLine": "X8AGHq_heapLine",
			"heapBarFill": "X8AGHq_heapBarFill",
			"status": "X8AGHq_status"
		};
		//#endregion
		//#region \0dsh-css:/Users/ai/Desktop/未必科幻 Harness/mbsf-split/03-dsh/src/client/MbsfStatusTab.module.css.mjs
		const css$3 = ".CDlUrq_section{flex-direction:column;gap:14px;display:flex}.CDlUrq_status{opacity:.7;font-size:12px}.CDlUrq_failure{align-items:center;gap:10px;font-size:13px;display:flex}.CDlUrq_failure p{margin:0}.CDlUrq_failure button{color:inherit;cursor:pointer;background:0 0;border:1px solid #7f7f7f66;border-radius:6px;padding:4px 12px;font-size:12px}.CDlUrq_body{flex-direction:column;gap:12px;display:flex}.CDlUrq_versionRow{opacity:.8;align-items:center;gap:8px;font-size:12px;display:flex}.CDlUrq_versionRow code{background:#7f7f7f26;border-radius:6px;padding:2px 8px;font-size:11px}.CDlUrq_grid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;display:grid}.CDlUrq_blockFull{grid-column:1/-1}.CDlUrq_block{background:#ffffff08;border:1px solid #7f7f7f4d;border-radius:10px;padding:12px 14px}.CDlUrq_block h4{text-transform:uppercase;letter-spacing:.06em;opacity:.75;margin:0 0 8px;font-size:12px}.CDlUrq_rows{flex-direction:column;gap:4px;margin:0;display:flex}.CDlUrq_row{justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;display:flex}.CDlUrq_row dt{opacity:.65}.CDlUrq_row dd{font-variant-numeric:tabular-nums;margin:0}.CDlUrq_engineOk{color:#2e7d32;margin:0 0 .5rem;font-size:12px;line-height:1.5}.CDlUrq_engineBad{color:#c62828;white-space:pre-wrap;margin:0 0 .5rem;font-size:12px;font-weight:600;line-height:1.5}.CDlUrq_never{opacity:.6;margin:0 0 8px;font-size:12px}.CDlUrq_historyList{flex-direction:column;gap:2px;max-height:260px;margin:0;padding:0;font-size:11px;list-style:none;display:flex;overflow-y:auto}.CDlUrq_historyRow{font-family:var(--dsh-mono-font,ui-monospace, SFMono-Regular, Menlo, monospace);border-bottom:1px solid #7f7f7f1f;grid-template-columns:auto 1fr auto auto auto;align-items:baseline;gap:10px;padding:3px 0;display:grid}.CDlUrq_historyRow:last-child{border-bottom:none}.CDlUrq_historyWhen{color:var(--dsw-alias-label-tertiary);white-space:nowrap}.CDlUrq_historySpan{color:var(--dsw-alias-label-secondary);white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.CDlUrq_historyResult{color:var(--dsw-alias-label-primary-bluish);white-space:nowrap}.CDlUrq_historyEma,.CDlUrq_historyMs{color:var(--dsw-alias-label-tertiary);white-space:nowrap}.CDlUrq_historyInline{border-top:1px solid #7f7f7f33;margin-top:10px;padding-top:8px}";
		const tagId$3 = "mbsf-compaction/MbsfStatusTab.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "mbsf-compaction";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var MbsfStatusTab_module_css_default = {
			"engineBad": "CDlUrq_engineBad",
			"historyRow": "CDlUrq_historyRow",
			"historyWhen": "CDlUrq_historyWhen",
			"versionRow": "CDlUrq_versionRow",
			"row": "CDlUrq_row",
			"section": "CDlUrq_section",
			"rows": "CDlUrq_rows",
			"historyResult": "CDlUrq_historyResult",
			"status": "CDlUrq_status",
			"historyEma": "CDlUrq_historyEma",
			"failure": "CDlUrq_failure",
			"historyList": "CDlUrq_historyList",
			"historyInline": "CDlUrq_historyInline",
			"blockFull": "CDlUrq_blockFull",
			"never": "CDlUrq_never",
			"body": "CDlUrq_body",
			"engineOk": "CDlUrq_engineOk",
			"historySpan": "CDlUrq_historySpan",
			"block": "CDlUrq_block",
			"grid": "CDlUrq_grid",
			"historyMs": "CDlUrq_historyMs"
		};
		//#endregion
		//#region lib/types/client/MbsfStatusTab.js
		/** 未必记忆状态页——设置 → 插件 → 「状态」tab：六块只读统计 + 版本。 */
		/** 状态页主体：版本行 + 六块统计卡片（顶层设置页与插件 tab 共用）。 */
		function StatusBody({ snapshot, t, showVersion = true }) {
			const compression = snapshot.compression;
			const last = snapshot.lastSummarize;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfStatusTab_module_css_default.body,
				children: [showVersion ? (0, react_jsx_runtime.jsxs)("div", {
					className: MbsfStatusTab_module_css_default.versionRow,
					children: [(0, react_jsx_runtime.jsx)("span", { children: t("version") }), (0, react_jsx_runtime.jsx)("code", { children: snapshot.version })]
				}) : null, (0, react_jsx_runtime.jsx)("div", {
					className: MbsfStatusTab_module_css_default.grid,
					children: (0, react_jsx_runtime.jsxs)(Block, {
						title: t("compression"),
						className: MbsfStatusTab_module_css_default.blockFull,
						children: [
							snapshot.engine ? (0, react_jsx_runtime.jsx)("p", {
								className: snapshot.engine.loaded ? MbsfStatusTab_module_css_default.engineOk : MbsfStatusTab_module_css_default.engineBad,
								children: snapshot.engine.loaded ? "引擎已加载 · 自动压缩生效中" : `引擎未加载 · 压缩不会发生${snapshot.engine.note ? `（${snapshot.engine.note}）` : ""}`
							}) : null,
							last === null ? (0, react_jsx_runtime.jsx)("p", {
								className: MbsfStatusTab_module_css_default.never,
								children: t("never")
							}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsx)(Row, {
									label: t("lastMs"),
									value: `${last.elapsedMs} ms`
								}),
								(0, react_jsx_runtime.jsx)(Row, {
									label: t("messages"),
									value: String(last.messages)
								}),
								(0, react_jsx_runtime.jsx)(Row, {
									label: t("compressed"),
									value: String(last.compressed)
								}),
								(0, react_jsx_runtime.jsx)(Row, {
									label: t("preserved"),
									value: String(last.preserved)
								}),
								(0, react_jsx_runtime.jsx)(Row, {
									label: t("tailFpSegments"),
									value: String(last.tailFpSegments)
								}),
								(0, react_jsx_runtime.jsx)(Row, {
									label: t("textChars"),
									value: String(last.textChars)
								})
							] }),
							(0, react_jsx_runtime.jsx)(Row, {
								label: t("compressions"),
								value: String(compression.n ?? 0)
							}),
							(0, react_jsx_runtime.jsx)(Row, {
								label: t("emaMs"),
								value: compression.emaMs == null ? t("none") : `${compression.emaMs} ms`
							}),
							snapshot.compressionHistory ? (0, react_jsx_runtime.jsx)(HistoryBlock, {
								entries: snapshot.compressionHistory,
								t
							}) : null
						]
					})
				})]
			});
		}
		/** C 方案：折叠历史明细块（2026-09-27）。
		*
		*  为什么要它：压缩此前只以「一条 user 消息」的形式进模型上下文
		*  （BasicCompactionEngine 把 summarize() 产物包成 createUserMessage），
		*  不经任何 UI——用户看不到「压了什么」。此处把主机侧 compaction-log 的
		*  折叠记录列出来：时刻 / 区间（被压消息数 → 摘要字符） / 结果（压缩+折叠+
		*  归档） / γ EMA / 耗时。正文不在日志里（防重复存储），凭 sessionKey 可回
		*  session 文件比对原文与摘要。
		*
		*  截断：主机侧已限 30 条（foldHistory limit），此处不再分页——明细是
		*  「抽查锚」不是「全量档案」，够用即止。 */
		function HistoryBlock({ entries, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfStatusTab_module_css_default.historyInline,
				children: [(0, react_jsx_runtime.jsx)("h4", { children: t("compressionHistory") }), entries.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
					className: MbsfStatusTab_module_css_default.never,
					children: t("historyEmpty")
				}) : (0, react_jsx_runtime.jsx)("ul", {
					className: MbsfStatusTab_module_css_default.historyList,
					children: entries.map((e) => {
						const folded = e.folded ?? 0;
						const archived = e.archived ?? 0;
						const k = (n) => n >= 1024 ? `${(n / 1024).toFixed(1)}k` : String(n);
						return (0, react_jsx_runtime.jsxs)("li", {
							className: MbsfStatusTab_module_css_default.historyRow,
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: MbsfStatusTab_module_css_default.historyWhen,
									children: fmtWhen(e.ts)
								}),
								(0, react_jsx_runtime.jsxs)("span", {
									className: MbsfStatusTab_module_css_default.historySpan,
									children: [
										e.inputMessages ?? 0,
										" → ",
										k(e.textChars ?? 0)
									]
								}),
								(0, react_jsx_runtime.jsxs)("span", {
									className: MbsfStatusTab_module_css_default.historyResult,
									children: [
										t("compressed"),
										" ",
										e.compressed ?? 0,
										folded > 0 ? ` · ${folded}` : "",
										archived > 0 ? ` · ${archived}` : ""
									]
								}),
								(0, react_jsx_runtime.jsxs)("span", {
									className: MbsfStatusTab_module_css_default.historyEma,
									children: ["γ ", (e.ema ?? 0).toFixed(3)]
								}),
								(0, react_jsx_runtime.jsxs)("span", {
									className: MbsfStatusTab_module_css_default.historyMs,
									children: [e.elapsedMs ?? 0, " ms"]
								})
							]
						}, `${e.ts}-${e.sessionKey ?? ""}`);
					})
				})]
			});
		}
		/** 时刻格式：MM-DD HH:MM（本地时区）——历史表只需到分钟粒度。 */
		function fmtWhen(ts) {
			const d = new Date(ts);
			const p = (n) => String(n).padStart(2, "0");
			return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
		}
		/** 一块统计卡片。 */
		function Block({ title, children, className }) {
			return (0, react_jsx_runtime.jsxs)("section", {
				className: className ? `${MbsfStatusTab_module_css_default.block} ${className}` : MbsfStatusTab_module_css_default.block,
				children: [(0, react_jsx_runtime.jsx)("h4", { children: title }), (0, react_jsx_runtime.jsx)("dl", {
					className: MbsfStatusTab_module_css_default.rows,
					children
				})]
			});
		}
		/** 一行 label/value。 */
		function Row({ label, value }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfStatusTab_module_css_default.row,
				children: [(0, react_jsx_runtime.jsx)("dt", { children: label }), (0, react_jsx_runtime.jsx)("dd", { children: value })]
			});
		}
		//#endregion
		//#region lib/types/client/switch-row.js
		/** 一个布尔开关行（原生 checkbox 样式化）。 */
		function SwitchRow(props) {
			const { id, label, hint, value, disabled, onToggle } = props;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfConfigCard_module_css_default.row,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: MbsfConfigCard_module_css_default.rowBody,
					children: (0, react_jsx_runtime.jsxs)("label", {
						className: MbsfConfigCard_module_css_default.switch,
						htmlFor: id,
						children: [
							(0, react_jsx_runtime.jsx)("input", {
								id,
								type: "checkbox",
								role: "switch",
								checked: value,
								disabled,
								onChange: onToggle
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: MbsfConfigCard_module_css_default.track,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)("span", { className: MbsfConfigCard_module_css_default.thumb })
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: MbsfConfigCard_module_css_default.rowLabel,
								children: label
							})
						]
					})
				}), (0, react_jsx_runtime.jsx)("p", {
					className: MbsfConfigCard_module_css_default.rowHint,
					children: hint
				})]
			});
		}
		//#endregion
		//#region lib/types/client/number-row.js
		/** 未必记忆数值行——staged form 的数值输入（blur/Enter 提交进 staged）。 */
		/** 一个数值输入行（blur / Enter 提交，非法值回退）。 */
		function NumberRow(props) {
			const { id, label, hint, value, disabled, min = 0, step = 1, normalize } = props;
			const [draft, setDraft] = (0, react.useState)(String(value));
			(0, react.useEffect)(() => {
				setDraft(String(value));
			}, [value]);
			const commit = () => {
				const parsed = Number(draft);
				if (!Number.isFinite(parsed) || parsed < min) {
					setDraft(String(value));
					return;
				}
				const next = normalize === void 0 ? parsed : normalize(parsed);
				if (next !== value) props.onCommit(next);
				else setDraft(String(value));
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfConfigCard_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MbsfConfigCard_module_css_default.rowBody,
					children: [(0, react_jsx_runtime.jsx)("label", {
						className: MbsfConfigCard_module_css_default.rowLabel,
						htmlFor: id,
						children: label
					}), (0, react_jsx_runtime.jsx)("input", {
						id,
						type: "number",
						min,
						step,
						value: draft,
						disabled,
						style: {
							width: "6.5rem",
							marginLeft: "0.5rem"
						},
						onChange: (event) => {
							setDraft(event.target.value);
						},
						onBlur: commit,
						onKeyDown: (event) => {
							if (event.key === "Enter") commit();
						}
					})]
				}), (0, react_jsx_runtime.jsx)("p", {
					className: MbsfConfigCard_module_css_default.rowHint,
					children: hint
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/ai/Desktop/未必科幻 Harness/mbsf-split/03-dsh/src/client/MbsfSettingsSection.module.css.mjs
		const css$2 = ".QmtxkW_page{flex-direction:column;gap:20px;display:flex}.QmtxkW_brand{background:#8080800a;border:1px solid #8080802e;border-radius:12px;align-items:center;gap:20px;padding:20px 24px;display:flex}.QmtxkW_brandLogo{object-fit:contain;background:#fff;border-radius:8px;flex:none;width:auto;height:62px;max-height:96px}.QmtxkW_brandMeta{flex-direction:column;gap:6px;min-width:0;display:flex}.QmtxkW_brandTitleRow{flex-wrap:wrap;align-items:baseline;gap:12px;display:flex}.QmtxkW_brandName{font-size:20px;line-height:1.2}.QmtxkW_brandVersion{opacity:.7;font-size:12px}.QmtxkW_brandLine{opacity:.85;font-size:13px}.QmtxkW_brandSmall{opacity:.6;font-size:12px}";
		const tagId$2 = "mbsf-compaction/MbsfSettingsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "mbsf-compaction";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var MbsfSettingsSection_module_css_default = {
			"brandVersion": "QmtxkW_brandVersion",
			"brandMeta": "QmtxkW_brandMeta",
			"brandLine": "QmtxkW_brandLine",
			"brandSmall": "QmtxkW_brandSmall",
			"page": "QmtxkW_page",
			"brandTitleRow": "QmtxkW_brandTitleRow",
			"brandName": "QmtxkW_brandName",
			"brand": "QmtxkW_brand",
			"brandLogo": "QmtxkW_brandLogo"
		};
		//#endregion
		//#region lib/types/client/trim-list-view.js
		/**
		* 剪裁清单的**视图变换**（搜索 / 筛选 / 排序，2026-11-07 一帆要求）。
		*
		* 为什么单独拿出来：这是清单里唯一有分支的一段逻辑，混在 JSX 里就只能靠肉眼
		* 保证「搜到 0 条时不能说成筛选失效」「排序不许改动勾选集合」。抽成纯函数后
		* 它可以在没有 DOM 的环境里被逐条验证（`tests/trim-list-view.spec.ts`）。
		*
		* 三条不变量（每条都有对应断言）：
		*   1. **只读**——输入行数组不被修改（返回重排后的新数组，行对象原样复用）；
		*   2. **勾选集合无关**——筛选/排序不改变任何行的 `selected`，也不决定写盘；
		*   3. **稳定**——同键排序保持原有相对顺序（JS `sort` 自 ES2019 起稳定，
		*      这里靠「键相等时不返回 0 以外的值」保证，不依赖引擎实现细节）。
		*
		* @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/trim-list-view
		*/
		/**
		* 视图默认值。
		*
		* **单列表 + 体积降序**：
		* - `groupBy: 'flat'`——按工作区分组会把最大的会话打散到各组（每组各排各的），
		*   单列表让体积排序跨全部会话生效，打开即看到最该剪的那几个。
		* - `sort: 'size'` / `desc: true`——清理关心的是体积，不是活动时间。
		*/
		const DEFAULT_TRIM_VIEW = {
			query: "",
			filter: "all",
			sort: "size",
			desc: true,
			scope: "all",
			archive: "hide",
			groupBy: "flat"
		};
		/** 行是否命中搜索词。空词 = 全命中（**不**等于「没搜」——由调用方区分文案）。 */
		function matchesQuery(row, query) {
			const needle = query.trim().toLowerCase();
			if (needle === "") return true;
			const haystack = `${row.title ?? ""}\n${row.id}\n${row.workspacePath}\n${row.origin ?? ""}`.toLowerCase();
			return needle.split(/\s+/).every((part) => haystack.includes(part));
		}
		/** 取排序键值；`created` 缺创建时间时回落到 mtime（否则 undefined 会污染比较）。 */
		function sortValue(row, sort) {
			switch (sort) {
				case "mtime": return row.mtimeMs;
				case "created": return row.createdAtMs ?? row.mtimeMs;
				case "size": return row.bytes;
				case "path": return row.workspacePath.toLowerCase();
			}
		}
		/**
		* 搜索 + 筛选 + 排序。
		*
		* 路径按字符串比较（`localeCompare` 会随系统区域变，清单不该有这种漂移），
		* 数值键按差值比较。
		*/
		function applyTrimView(rows, options) {
			const filtered = rows.filter((row) => {
				if (options.filter === "selected" && !row.selected) return false;
				if (options.filter === "unselected" && row.selected) return false;
				if (options.scope === "main" && row.origin === "subagent") return false;
				if (options.scope === "subagent" && row.origin !== "subagent") return false;
				const archived = row.archived || row.rootArchived;
				if (options.archive === "hide" && archived) return false;
				if (options.archive === "only" && !archived) return false;
				return matchesQuery(row, options.query);
			});
			const sign = options.desc ? -1 : 1;
			return filtered.sort((a, b) => {
				const left = sortValue(a, options.sort);
				const right = sortValue(b, options.sort);
				if (typeof left === "string" || typeof right === "string") {
					const l = String(left);
					const r = String(right);
					if (l === r) return 0;
					return l < r ? -sign : sign;
				}
				if (left === right) return 0;
				return left < right ? -sign : sign;
			});
		}
		/** 清单统计（「筛选后 N / 共 M 条」+ 筛选结果里已勾多少）。 */
		function summarizeView(view, all) {
			return {
				shown: view.length,
				total: all.length,
				selectedShown: view.filter((row) => row.selected).length,
				bytesShown: view.reduce((sum, row) => sum + (row.selected ? row.bytes : 0), 0)
			};
		}
		/**
		* 「全选」的作用域 = **当前视图**（筛选/搜索之后的行）。
		*
		* 为什么不是全库：清单可搜索正是为了「只剪某几个大文件」，全选若越过筛选，
		* 用户会剪掉自己没看见的会话——破坏性动作不能有隐性作用域。
		*/
		function viewSelectionGap(view, selected) {
			return view.filter((row) => row.selected !== selected);
		}
		/** 工作区路径的末段（组标题）。 */
		function lastSegment(path) {
			const trimmed = path.replace(/\/+$/, "");
			const index = trimmed.lastIndexOf("/");
			return index < 0 ? trimmed : trimmed.slice(index + 1);
		}
		/**
		* 按分组方式切分（**只切不改**：行对象原样复用，顺序不动）。
		*
		* `tree` 的语义：把工作区路径按 `/` 逐段展开，**有会话的目录**才出组头——
		* 空目录不占位置。逐层缩进，父目录本身没有会话时仍保留组头（用户要靠它
		* 识别「这几个子目录是一家」）。
		*/
		function groupTrimRows(rows, groupBy) {
			if (groupBy === "flat") return [{
				key: "",
				label: "",
				depth: 0,
				rows: [...rows]
			}];
			if (groupBy === "workspace") {
				const byPath = /* @__PURE__ */ new Map();
				for (const row of rows) {
					const list = byPath.get(row.workspacePath);
					if (list === void 0) byPath.set(row.workspacePath, [row]);
					else list.push(row);
				}
				return [...byPath.entries()].sort((a, b) => {
					const left = lastSegment(a[0]);
					const right = lastSegment(b[0]);
					return left === right ? 0 : left < right ? -1 : 1;
				}).map(([path, members]) => ({
					key: path,
					label: lastSegment(path) || path,
					depth: 0,
					rows: members
				}));
			}
			const root = {
				label: "",
				children: /* @__PURE__ */ new Map(),
				rows: []
			};
			for (const row of rows) {
				const segments = row.workspacePath.split("/").filter((segment) => segment !== "");
				let node = root;
				for (const segment of segments) {
					const existing = node.children.get(segment);
					if (existing === void 0) {
						const created = {
							label: segment,
							children: /* @__PURE__ */ new Map(),
							rows: []
						};
						node.children.set(segment, created);
						node = created;
					} else node = existing;
				}
				node.rows.push(row);
			}
			const out = [];
			const walk = (node, path, depth) => {
				const children = [...node.children.entries()].sort((a, b) => a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1);
				if (node.label !== "" || node.rows.length > 0) {
					if (node.rows.length > 0 || children.length > 0) out.push({
						key: path,
						label: node.label === "" ? "/" : node.label,
						depth,
						rows: [...node.rows]
					});
				}
				for (const [name, child] of children) walk(child, `${path}/${name}`, depth + 1);
			};
			walk(root, "", 0);
			return out.filter((group) => group.key !== "" || group.rows.length > 0);
		}
		/** 组内已勾数量（组头显示「3/12」）。 */
		function groupSelectedCount(group) {
			return group.rows.filter((row) => row.selected).length;
		}
		//#endregion
		//#region \0dsh-css:/Users/ai/Desktop/未必科幻 Harness/mbsf-split/03-dsh/src/client/MbsfTrimList.module.css.mjs
		const css$1 = ".avcmqq_wrap{flex-direction:column;gap:8px;padding:10px 0 2px;display:flex}.avcmqq_head{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.avcmqq_headSummary{color:var(--dsh-text-secondary,#888);font-variant-numeric:tabular-nums;margin-left:4px;font-size:12px}.avcmqq_note{color:var(--dsh-text-secondary,#888);margin:2px 0 0;font-size:12px;line-height:1.5}.avcmqq_noteLead{color:var(--dsh-text-primary,#ddd);margin:6px 0 0;font-size:12.5px;font-weight:650;line-height:1.5}.avcmqq_toolbar{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.avcmqq_search{border:1px solid var(--dsh-border-subtle,#e0e0e0);background:var(--dsh-input-bg,#fff);min-width:120px;color:inherit;border-radius:6px;flex:180px;padding:4px 8px;font-size:12px}.avcmqq_search:focus-visible,.avcmqq_select:focus-visible{outline:2px solid var(--dsh-accent,#4a7cff);outline-offset:1px}.avcmqq_select{border:1px solid var(--dsh-border-subtle,#e0e0e0);background:var(--dsh-input-bg,#fff);max-width:40%;color:inherit;border-radius:6px;flex:none;padding:4px 6px;font-size:12px}.avcmqq_sortButton{border:1px solid var(--dsh-border-subtle,#e0e0e0);width:26px;height:26px;color:inherit;cursor:pointer;background:0 0;border-radius:6px;flex:none;font-size:12px;line-height:1}.avcmqq_sortButton:hover{background:var(--dsh-surface-hover,#0000000a)}.avcmqq_summaryRow{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.avcmqq_summary{color:var(--dsh-text-secondary,#888);font-variant-numeric:tabular-nums;margin-right:auto;font-size:12px}.avcmqq_list{border:1px solid var(--dsh-border-subtle,#e6e6e6);border-radius:8px;flex-direction:column;max-height:320px;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.avcmqq_row{align-items:flex-start;gap:4px;display:flex}.avcmqq_row+.avcmqq_row{border-top:1px solid var(--dsh-border-subtle,#f0f0f0)}.avcmqq_label{cursor:pointer;flex:1;align-items:flex-start;gap:8px;min-width:0;padding:7px 4px 7px 10px;font-size:12px;display:flex}.avcmqq_label:hover{background:var(--dsh-surface-hover,#00000008)}.avcmqq_checkbox{accent-color:#111;flex:none;margin-top:2px}.avcmqq_main{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}.avcmqq_name{overflow-wrap:anywhere;word-break:break-word;font-size:13px;font-weight:600;line-height:1.4;display:block}.avcmqq_path{overflow-wrap:anywhere;word-break:break-word;line-height:1.45}.avcmqq_meta{color:var(--dsh-text-secondary,#999);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;flex-wrap:wrap;align-items:baseline;gap:4px;display:flex}.avcmqq_id{font-family:var(--dsh-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);color:var(--dsh-text-secondary,#888);user-select:all;overflow-wrap:anywhere;font-size:11px}.avcmqq_last{color:var(--dsh-text-secondary,#999);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;padding:7px 2px 0 8px;font-size:11px}.avcmqq_copy{width:22px;height:22px;color:var(--dsh-text-tertiary,#aaa);cursor:pointer;background:0 0;border:none;border-radius:5px;flex:none;margin:4px 6px 0 0;padding:0;font-size:11px;line-height:1}.avcmqq_copy:hover{background:var(--dsh-surface-hover,#0000000f);color:inherit}.avcmqq_copyDone{color:var(--dsh-success,#2ea043)}.avcmqq_tabs{border-bottom:1px solid var(--dsh-border-subtle,#e6e6e6);gap:4px;display:flex}.avcmqq_tab{color:var(--dsh-text-secondary,#888);cursor:pointer;background:0 0;border:none;border-bottom:2px solid #0000;padding:5px 10px;font-size:12px}.avcmqq_tab:hover{color:inherit}.avcmqq_tabActive{border-bottom-color:var(--dsh-accent,#4a7cff);color:inherit;font-weight:600}.avcmqq_notice{background:var(--dsh-surface-raised,#4a7cff14);color:inherit;border-radius:6px;align-items:center;gap:8px;margin:0;padding:6px 10px;font-size:12px;display:flex}.avcmqq_noticeClose{color:var(--dsh-text-secondary,#888);cursor:pointer;background:0 0;border:none;margin-left:auto;font-size:14px;line-height:1}.avcmqq_groups{flex-direction:column;gap:10px;display:flex}.avcmqq_group{flex-direction:column;gap:4px;display:flex}.avcmqq_groupHead{color:inherit;cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:6px;padding:3px 4px;font-size:12px;display:flex}.avcmqq_groupHead:hover{background:var(--dsh-surface-hover,#00000008);border-radius:5px}.avcmqq_groupArrow{width:10px;color:var(--dsh-text-tertiary,#aaa);flex:none}.avcmqq_groupName{overflow-wrap:anywhere;font-weight:600}.avcmqq_groupCount{color:var(--dsh-text-secondary,#999);font-variant-numeric:tabular-nums;margin-left:auto}.avcmqq_badge{background:var(--dsh-surface-raised,#0000000f);color:var(--dsh-text-secondary,#777);border-radius:8px;margin:0 2px;padding:0 5px;font-size:10px;line-height:16px;display:inline-block}.avcmqq_trash{width:22px;height:22px;color:var(--dsh-text-tertiary,#aaa);cursor:pointer;background:0 0;border:none;border-radius:5px;flex:none;margin:4px 8px 0 0;padding:0;font-size:11px;line-height:1}.avcmqq_trash:hover:not(:disabled){background:var(--dsh-surface-hover,#0000000f);color:var(--dsh-danger,#d1242f)}.avcmqq_trash:disabled{opacity:.35;cursor:not-allowed}.avcmqq_dialogBackdrop{z-index:40;background:#0006;justify-content:center;align-items:center;padding:16px;display:flex;position:fixed;inset:0}.avcmqq_dialog{background:var(--dsh-surface,#fff);border-radius:10px;flex-direction:column;gap:8px;width:min(420px,100%);padding:16px;display:flex;box-shadow:0 8px 32px #0000003d}.avcmqq_dialogTitle{font-size:14px}.avcmqq_dialogBody{color:inherit;margin:0;font-size:12px;line-height:1.6}.avcmqq_dialogActions{justify-content:flex-end;gap:8px;margin-top:4px;display:flex}.avcmqq_dangerButton{border:1px solid var(--dsh-danger,#d1242f);background:var(--dsh-danger,#d1242f);color:#fff;cursor:pointer;border-radius:6px;padding:4px 12px;font-size:12px}.avcmqq_dangerButton:hover{filter:brightness(.95)}";
		const tagId$1 = "mbsf-compaction/MbsfTrimList.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "mbsf-compaction";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var MbsfTrimList_module_css_default = {
			"wrap": "avcmqq_wrap",
			"dangerButton": "avcmqq_dangerButton",
			"sortButton": "avcmqq_sortButton",
			"trash": "avcmqq_trash",
			"dialog": "avcmqq_dialog",
			"checkbox": "avcmqq_checkbox",
			"groupHead": "avcmqq_groupHead",
			"main": "avcmqq_main",
			"tab": "avcmqq_tab",
			"noteLead": "avcmqq_noteLead",
			"id": "avcmqq_id",
			"select": "avcmqq_select",
			"headSummary": "avcmqq_headSummary",
			"groupArrow": "avcmqq_groupArrow",
			"notice": "avcmqq_notice",
			"note": "avcmqq_note",
			"groups": "avcmqq_groups",
			"head": "avcmqq_head",
			"groupCount": "avcmqq_groupCount",
			"dialogActions": "avcmqq_dialogActions",
			"noticeClose": "avcmqq_noticeClose",
			"summaryRow": "avcmqq_summaryRow",
			"row": "avcmqq_row",
			"badge": "avcmqq_badge",
			"tabActive": "avcmqq_tabActive",
			"meta": "avcmqq_meta",
			"summary": "avcmqq_summary",
			"copy": "avcmqq_copy",
			"toolbar": "avcmqq_toolbar",
			"last": "avcmqq_last",
			"search": "avcmqq_search",
			"dialogTitle": "avcmqq_dialogTitle",
			"name": "avcmqq_name",
			"tabs": "avcmqq_tabs",
			"group": "avcmqq_group",
			"groupName": "avcmqq_groupName",
			"label": "avcmqq_label",
			"dialogBackdrop": "avcmqq_dialogBackdrop",
			"dialogBody": "avcmqq_dialogBody",
			"copyDone": "avcmqq_copyDone",
			"list": "avcmqq_list",
			"path": "avcmqq_path"
		};
		//#endregion
		//#region lib/types/client/MbsfTrimList.js
		/**
		* 会话历史剪裁清单（设置页子区，2026-11-07）
		*
		* 「重启时清理」是**全库**开关；本清单是它的**降维形态**——勾中的会话在重启
		* 时被剪，没勾的完全不动。两档优先级（一帆 2026-11-07 定）：**全局开关开着
		* 时勾选不生效**（UI 直接说这句并把勾选框灰掉，而不是让勾选"看起来生效"）。
		*
		* 为什么要有可见清单：剪裁是**不可逆**的破坏性动作。把「哪些会话会被剪」摊开
		* 成一张表，误操作的门槛就从「记得自己勾过什么」变成了「看见勾了哪个」。
		*
		* ## 2026-11-07 二版（一帆：要筛选/排序/搜索，要完整会话名和 id）
		*
		* - **搜索**：会话 ID / 工作区路径 / 来源，空格分词 AND；只作用于显示。
		* - **筛选**：全部 / 已勾选 / 未勾选。
		* - **排序**：最近活动 / 创建时间 / 大小 / 工作区，可切正倒序。
		* - **完整显示**：工作区路径**换行显示全文**（原来是省略号 + tooltip），
		*   会话 ID **完整平铺**（原来只显前 8 位）+ 复制按钮（ID 是唯一的精确定位
		*   手段，8 位够看不够找）。
		* - **全选的作用域 = 当前视图**（筛选/搜索之后），且界面上写出来——破坏性
		*   动作不能有隐性作用域。
		*
		* ## 2026-11-07 三版（一帆：分组对齐 DSH 视图选项 + 筛选子代理/已归档 + 删除）
		*
		* - **分组**：按工作区 / 按工作区树 / 单列表——**名字和语义都抄 DSH 侧栏的
		*   视图选项**（`groupBy.workspace` / `groupBy.workspaceTree` / `groupBy.flat`），
		*   用户在一个地方学会的规矩在另一个地方照样成立。
		* - **筛选**：会话类型（全部 / 仅主会话 / 仅子代理）+ 归档三档（隐藏 / 全部 /
		*   仅归档）。注意与 DSH 的差别：DSH 侧栏**永不显示子代理**，我们的清单是盘上
		*   全量，所以「全部」就是真的全部——要看侧栏那种视图，选「仅主会话」。
		* - **删除**：只对「已归档 或 子代理」的会话开放（服务端判定，见
		*   `status-gateway.trimDeletable`），删除前弹确认框，删后进回收站 30 天，
		*   「已删除」页可恢复。
		*
		* 视图变换全在 `trim-list-view.ts`（纯函数，单独可测）；删除/恢复的落盘在
		* 引擎 `deleted-sessions.ts`。这个组件只负责画和问。
		*
		* @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/MbsfTrimList
		*/
		/** 字节数转人话（1024 进制，与设置页其它地方一致）。 */
		function formatBytes(bytes) {
			if (bytes < 1024) return `${bytes} B`;
			const kb = bytes / 1024;
			if (kb < 1024) return `${kb.toFixed(0)} KB`;
			const mb = kb / 1024;
			if (mb < 1024) return `${mb.toFixed(1)} MB`;
			return `${(mb / 1024).toFixed(2)} GB`;
		}
		/** 保留天数（与引擎 `DELETED_RETENTION_DAYS` 一致；只用于文案）。 */
		const RETENTION_DAYS = 30;
		/** 渲染剪裁清单。 */
		function MbsfTrimList(props) {
			const { t, trimTargets, setTrimTarget, trimDelete, trimDeleted, trimRestore, disabled = false, trimEnabled = false, onToggleEnabled, onSelectionChange } = props;
			/** 展开态 === 剪裁启用（2026-11-08）——同一个状态，两个称呼。 */
			const open = trimEnabled;
			const children = props.children;
			const toggleEnabled = () => {
				onToggleEnabled?.();
			};
			const [state, setState] = (0, react.useState)({ status: "loading" });
			const [busy, setBusy] = (0, react.useState)("");
			const [request, setRequest] = (0, react.useState)(0);
			const [view, setView] = (0, react.useState)(DEFAULT_TRIM_VIEW);
			const [copied, setCopied] = (0, react.useState)("");
			const [tab, setTab] = (0, react.useState)("sessions");
			const [deleted, setDeleted] = (0, react.useState)({ status: "idle" });
			const [pending, setPending] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)("");
			const [collapsed, setCollapsed] = (0, react.useState)(/* @__PURE__ */ new Set());
			(0, react.useEffect)(() => {
				if (state.status !== "ready") return;
				onSelectionChange?.(state.data.selectedCount);
			}, [onSelectionChange, state]);
			(0, react.useEffect)(() => {
				if (!open) return;
				let current = true;
				Promise.resolve().then(() => trimTargets()).then((data) => {
					if (current) setState({
						status: "ready",
						data
					});
				}, () => {
					if (current) setState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [
				open,
				trimTargets,
				request
			]);
			const refresh = (0, react.useCallback)(() => {
				setState({ status: "loading" });
				setRequest((value) => value + 1);
			}, []);
			/** 拉回收站（切页 / 删除 / 恢复之后都要重读——它才是事实）。 */
			const loadDeleted = (0, react.useCallback)(() => {
				setDeleted({ status: "loading" });
				Promise.resolve().then(() => trimDeleted()).then((result) => {
					setDeleted({
						status: "ready",
						entries: result.entries,
						purged: result.purged
					});
					if (result.purged > 0) setNotice(t("trimDeletedPurged", {
						n: result.purged,
						days: RETENTION_DAYS
					}));
				}, () => {
					setDeleted({ status: "error" });
				});
			}, [t, trimDeleted]);
			(0, react.useEffect)(() => {
				if (tab === "deleted" && deleted.status === "idle") loadDeleted();
			}, [
				deleted.status,
				loadDeleted,
				tab
			]);
			const flip = (0, react.useCallback)((row, selected) => {
				setBusy(row.id);
				setState((prev) => prev.status === "ready" ? {
					status: "ready",
					data: {
						...prev.data,
						rows: prev.data.rows.map((r) => r.id === row.id ? {
							...r,
							selected
						} : r),
						selectedCount: prev.data.selectedCount + (selected ? 1 : -1),
						selectedBytes: prev.data.selectedBytes + (selected ? row.bytes : -row.bytes)
					}
				} : prev);
				setTrimTarget(row.id, selected).then(() => {
					setBusy("");
				}, () => {
					setBusy("");
					refresh();
				});
			}, [refresh, setTrimTarget]);
			const copyId = (0, react.useCallback)((id) => {
				Promise.resolve().then(() => navigator.clipboard.writeText(id)).then(() => {
					setCopied(id);
					setTimeout(() => {
						setCopied((current) => current === id ? "" : current);
					}, 1200);
				}).catch(() => {});
			}, []);
			const rows = state.status === "ready" ? state.data.rows : [];
			const visible = (0, react.useMemo)(() => applyTrimView(rows, view), [rows, view]);
			const groups = (0, react.useMemo)(() => groupTrimRows(visible, view.groupBy), [visible, view.groupBy]);
			const stats = (0, react.useMemo)(() => summarizeView(visible, rows), [visible, rows]);
			const narrowed = view.query.trim() !== "" || view.filter !== "all" || view.scope !== "all" || view.archive !== "hide";
			/**
			* 每个会话名下的**全部后代**子代理数（只为确认框里能说出「会一起删 N 个」）。
			*
			* 必须递归：服务端级联删的是整棵子树（`descendantsOf`），只数直接子会话会
			* 在确认框里少数——用户以为删 3 个、实际删了 7 个。环安全靠 visited。
			*/
			const childIndex = (0, react.useMemo)(() => {
				const byParent = /* @__PURE__ */ new Map();
				for (const row of rows) {
					if (row.parentSession === void 0) continue;
					const list = byParent.get(row.parentSession);
					if (list === void 0) byParent.set(row.parentSession, [row.id]);
					else list.push(row.id);
				}
				const counts = /* @__PURE__ */ new Map();
				for (const row of rows) {
					const seen = /* @__PURE__ */ new Set([row.id]);
					const queue = [...byParent.get(row.id) ?? []];
					let count = 0;
					while (queue.length > 0) {
						const next = queue.shift();
						if (next === void 0 || seen.has(next)) continue;
						seen.add(next);
						count += 1;
						queue.push(...byParent.get(next) ?? []);
					}
					if (count > 0) counts.set(row.id, count);
				}
				return counts;
			}, [rows]);
			const setAll = (0, react.useCallback)((selected) => {
				if (state.status !== "ready") return;
				const targets = viewSelectionGap(visible, selected);
				if (targets.length === 0) return;
				setBusy("*");
				Promise.all(targets.map((row) => setTrimTarget(row.id, selected))).then(() => {
					setBusy("");
					refresh();
				}, () => {
					setBusy("");
					refresh();
				});
			}, [
				refresh,
				setTrimTarget,
				state,
				visible
			]);
			const confirmDelete = (0, react.useCallback)(() => {
				if (pending === null) return;
				const { row } = pending;
				setPending(null);
				setBusy(row.id);
				trimDelete(row.id).then((result) => {
					setBusy("");
					if (!result.ok) {
						setNotice(t("trimDeleteFailed", { detail: result.detail ?? "" }));
						return;
					}
					setNotice(t("trimDeleteDone", {
						n: result.deleted.length,
						days: RETENTION_DAYS
					}));
					refresh();
					if (tab === "deleted") loadDeleted();
				}, (error) => {
					setBusy("");
					setNotice(t("trimDeleteFailed", { detail: error instanceof Error ? error.message : String(error) }));
				});
			}, [
				loadDeleted,
				pending,
				refresh,
				t,
				tab,
				trimDelete
			]);
			const restore = (0, react.useCallback)((entry) => {
				setBusy(entry.id);
				trimRestore(entry.id).then((result) => {
					setBusy("");
					if (!result.ok) {
						setNotice(t("trimRestoreFailed", { detail: result.detail ?? "" }));
						return;
					}
					setNotice(t("trimRestoreDone", { n: result.restored.length }));
					loadDeleted();
					refresh();
				}, (error) => {
					setBusy("");
					setNotice(t("trimRestoreFailed", { detail: error instanceof Error ? error.message : String(error) }));
				});
			}, [
				loadDeleted,
				refresh,
				t,
				trimRestore
			]);
			const relative = (0, react.useCallback)((ms) => {
				const diff = Date.now() - ms;
				const minutes = Math.floor(diff / 6e4);
				if (minutes < 1) return t("compressionJustNow");
				if (minutes < 60) return t("compressionMinutesAgo", { n: minutes });
				const hours = Math.floor(minutes / 60);
				if (hours < 48) return t("compressionHoursAgo", { n: hours });
				return new Date(ms).toLocaleDateString();
			}, [t]);
			/**
			* 标题行 = 剪裁总开关（2026-11-08 一帆：样式要和设置页其它开关统一）。
			* 原生 checkbox role=switch + track/thumb，与 `SwitchRow` 同一套样式；
			* 开 = 重启时按勾选剪、下方展开参数与清单；关 = 一条都不剪。
			*/
			const headButton = (expanded, summary = null, right = null) => (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfTrimList_module_css_default.head,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MbsfConfigCard_module_css_default.rowBody,
					children: [(0, react_jsx_runtime.jsxs)("label", {
						className: MbsfConfigCard_module_css_default.switch,
						htmlFor: "mbsf-trim-enabled",
						children: [
							(0, react_jsx_runtime.jsx)("input", {
								id: "mbsf-trim-enabled",
								type: "checkbox",
								role: "switch",
								checked: expanded,
								disabled,
								onChange: toggleEnabled
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: MbsfConfigCard_module_css_default.track,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)("span", { className: MbsfConfigCard_module_css_default.thumb })
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: MbsfConfigCard_module_css_default.rowLabel,
								children: t("trimTitle")
							})
						]
					}), summary]
				}), right]
			});
			if (!open) return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfTrimList_module_css_default.wrap,
				"aria-label": t("trimTitle"),
				children: [headButton(false), (0, react_jsx_runtime.jsx)("p", {
					className: MbsfTrimList_module_css_default.note,
					children: t("trimOffHint")
				})]
			});
			if (state.status === "loading") return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfTrimList_module_css_default.wrap,
				children: [headButton(true), (0, react_jsx_runtime.jsx)("p", {
					className: MbsfTrimList_module_css_default.note,
					children: t("trimListLoading")
				})]
			});
			if (state.status === "error") return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfTrimList_module_css_default.wrap,
				children: [
					headButton(true),
					(0, react_jsx_runtime.jsx)("p", {
						className: MbsfTrimList_module_css_default.note,
						children: t("trimListFailed")
					}),
					(0, react_jsx_runtime.jsx)("button", {
						className: MbsfConfigCard_module_css_default.button,
						type: "button",
						onClick: refresh,
						children: t("retry")
					})
				]
			});
			const { data } = state;
			const locked = disabled;
			const sortOptions = [
				{
					key: "mtime",
					label: t("trimSortMtime")
				},
				{
					key: "created",
					label: t("trimSortCreated")
				},
				{
					key: "size",
					label: t("trimSortSize")
				},
				{
					key: "path",
					label: t("trimSortPath")
				}
			];
			const filterOptions = [
				{
					key: "all",
					label: t("trimFilterAll")
				},
				{
					key: "selected",
					label: t("trimFilterSelected")
				},
				{
					key: "unselected",
					label: t("trimFilterUnselected")
				}
			];
			const groupOptions = [
				{
					key: "workspace",
					label: t("trimGroupWorkspace")
				},
				{
					key: "tree",
					label: t("trimGroupTree")
				},
				{
					key: "flat",
					label: t("trimGroupFlat")
				}
			];
			const scopeOptions = [
				{
					key: "all",
					label: t("trimScopeAll")
				},
				{
					key: "main",
					label: t("trimScopeMain")
				},
				{
					key: "subagent",
					label: t("trimScopeSubagent")
				}
			];
			const archiveOptions = [
				{
					key: "hide",
					label: t("trimArchiveHide")
				},
				{
					key: "show",
					label: t("trimArchiveShow")
				},
				{
					key: "only",
					label: t("trimArchiveOnly")
				}
			];
			/** 删除按钮的禁用理由（null = 可删）。 */
			const blockedReason = (row) => {
				if (row.deletable) return null;
				if (row.deletableReason === "live") return t("trimDeleteBlockedLive");
				if (row.deletableReason === "parent") return t("trimDeleteBlockedParent");
				return t("trimDeleteBlockedActive");
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfTrimList_module_css_default.wrap,
				"aria-label": t("trimTitle"),
				children: [headButton(true, (0, react_jsx_runtime.jsx)("span", {
					className: MbsfTrimList_module_css_default.headSummary,
					children: t("trimSummary", {
						n: data.selectedCount,
						size: formatBytes(data.selectedBytes)
					})
				}), (0, react_jsx_runtime.jsx)("button", {
					className: MbsfConfigCard_module_css_default.button,
					type: "button",
					disabled: busy !== "",
					onClick: () => {
						refresh();
						if (tab === "deleted") loadDeleted();
					},
					children: t("trimRefresh")
				})), open ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					children,
					(0, react_jsx_runtime.jsx)("p", {
						className: MbsfTrimList_module_css_default.noteLead,
						children: t("trimHintLead")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: MbsfTrimList_module_css_default.note,
						children: t("trimHint")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: MbsfConfigCard_module_css_default.dangerHint,
						role: "note",
						children: t("restartCleanupDanger")
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: MbsfTrimList_module_css_default.tabs,
						role: "tablist",
						children: [(0, react_jsx_runtime.jsx)("button", {
							className: tab === "sessions" ? `${MbsfTrimList_module_css_default.tab} ${MbsfTrimList_module_css_default.tabActive}` : MbsfTrimList_module_css_default.tab,
							type: "button",
							role: "tab",
							"aria-selected": tab === "sessions",
							onClick: () => {
								setTab("sessions");
							},
							children: t("trimTabSessions")
						}), (0, react_jsx_runtime.jsx)("button", {
							className: tab === "deleted" ? `${MbsfTrimList_module_css_default.tab} ${MbsfTrimList_module_css_default.tabActive}` : MbsfTrimList_module_css_default.tab,
							type: "button",
							role: "tab",
							"aria-selected": tab === "deleted",
							onClick: () => {
								setTab("deleted");
								loadDeleted();
							},
							children: t("trimTabDeleted")
						})]
					}),
					notice === "" ? null : (0, react_jsx_runtime.jsxs)("p", {
						className: MbsfTrimList_module_css_default.notice,
						role: "status",
						children: [notice, (0, react_jsx_runtime.jsx)("button", {
							className: MbsfTrimList_module_css_default.noticeClose,
							type: "button",
							onClick: () => {
								setNotice("");
							},
							children: "×"
						})]
					}),
					tab === "deleted" ? renderDeleted() : renderSessions()
				] }) : null]
			});
			/** 「已删除」页：回收站列表 + 恢复。 */
			function renderDeleted() {
				if (deleted.status === "loading" || deleted.status === "idle") return (0, react_jsx_runtime.jsx)("p", {
					className: MbsfTrimList_module_css_default.note,
					children: t("trimListLoading")
				});
				if (deleted.status === "error") return (0, react_jsx_runtime.jsx)("p", {
					className: MbsfTrimList_module_css_default.note,
					children: t("trimListFailed")
				});
				if (deleted.entries.length === 0) return (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("p", {
					className: MbsfTrimList_module_css_default.note,
					children: t("trimDeletedEmpty")
				}), (0, react_jsx_runtime.jsx)("p", {
					className: MbsfTrimList_module_css_default.note,
					children: t("trimDeletedHint", { days: RETENTION_DAYS })
				})] });
				return (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("p", {
					className: MbsfTrimList_module_css_default.note,
					children: t("trimDeletedHint", { days: RETENTION_DAYS })
				}), (0, react_jsx_runtime.jsx)("ul", {
					className: MbsfTrimList_module_css_default.list,
					children: deleted.entries.map((entry) => (0, react_jsx_runtime.jsxs)("li", {
						className: MbsfTrimList_module_css_default.row,
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: MbsfTrimList_module_css_default.main,
							children: [
								entry.title === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
									className: MbsfTrimList_module_css_default.name,
									title: entry.title,
									children: entry.title
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: MbsfTrimList_module_css_default.path,
									title: entry.workspacePath,
									children: entry.workspacePath
								}),
								(0, react_jsx_runtime.jsxs)("span", {
									className: MbsfTrimList_module_css_default.meta,
									children: [
										(0, react_jsx_runtime.jsx)("code", {
											className: MbsfTrimList_module_css_default.id,
											title: entry.id,
											children: entry.id
										}),
										entry.role === "child" ? ` · ${t("trimBadgeSubagent")}` : "",
										` · ${formatBytes(entry.bytes)}`,
										` · ${t("trimDeletedAt", { date: new Date(entry.deletedAt).toLocaleDateString() })}`,
										` · ${t("trimDeletedRemaining", { n: entry.remainingDays })}`
									]
								})
							]
						}), (0, react_jsx_runtime.jsx)("button", {
							className: MbsfConfigCard_module_css_default.button,
							type: "button",
							disabled: busy !== "",
							onClick: () => {
								restore(entry);
							},
							children: t("trimDeletedRestore")
						})]
					}, entry.id))
				})] });
			}
			/** 「会话」页：工具条 + 分组列表 + 删除确认弹窗。 */
			function renderSessions() {
				return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: MbsfTrimList_module_css_default.toolbar,
						children: [
							(0, react_jsx_runtime.jsx)("input", {
								className: MbsfTrimList_module_css_default.search,
								type: "search",
								value: view.query,
								placeholder: t("trimSearchPlaceholder"),
								"aria-label": t("trimSearchPlaceholder"),
								onChange: (event) => {
									const query = event.currentTarget.value;
									setView((prev) => ({
										...prev,
										query
									}));
								}
							}),
							(0, react_jsx_runtime.jsx)("select", {
								className: MbsfTrimList_module_css_default.select,
								value: view.groupBy,
								"aria-label": t("trimGroupByLabel"),
								title: t("trimGroupByLabel"),
								onChange: (event) => {
									const groupBy = event.currentTarget.value;
									setView((prev) => ({
										...prev,
										groupBy
									}));
								},
								children: groupOptions.map((option) => (0, react_jsx_runtime.jsx)("option", {
									value: option.key,
									children: option.label
								}, option.key))
							}),
							(0, react_jsx_runtime.jsx)("select", {
								className: MbsfTrimList_module_css_default.select,
								value: view.scope,
								"aria-label": t("trimScopeLabel"),
								title: t("trimScopeLabel"),
								onChange: (event) => {
									const scope = event.currentTarget.value;
									setView((prev) => ({
										...prev,
										scope
									}));
								},
								children: scopeOptions.map((option) => (0, react_jsx_runtime.jsx)("option", {
									value: option.key,
									children: option.label
								}, option.key))
							}),
							(0, react_jsx_runtime.jsx)("select", {
								className: MbsfTrimList_module_css_default.select,
								value: view.archive,
								"aria-label": t("trimArchiveLabel"),
								title: t("trimArchiveLabel"),
								onChange: (event) => {
									const archive = event.currentTarget.value;
									setView((prev) => ({
										...prev,
										archive
									}));
								},
								children: archiveOptions.map((option) => (0, react_jsx_runtime.jsx)("option", {
									value: option.key,
									children: option.label
								}, option.key))
							}),
							(0, react_jsx_runtime.jsx)("select", {
								className: MbsfTrimList_module_css_default.select,
								value: view.filter,
								"aria-label": t("trimFilterAll"),
								onChange: (event) => {
									const filter = event.currentTarget.value;
									setView((prev) => ({
										...prev,
										filter
									}));
								},
								children: filterOptions.map((option) => (0, react_jsx_runtime.jsx)("option", {
									value: option.key,
									children: option.label
								}, option.key))
							}),
							(0, react_jsx_runtime.jsx)("select", {
								className: MbsfTrimList_module_css_default.select,
								value: view.sort,
								"aria-label": t("trimSortMtime"),
								onChange: (event) => {
									const sort = event.currentTarget.value;
									setView((prev) => ({
										...prev,
										sort
									}));
								},
								children: sortOptions.map((option) => (0, react_jsx_runtime.jsx)("option", {
									value: option.key,
									children: option.label
								}, option.key))
							}),
							(0, react_jsx_runtime.jsx)("button", {
								className: MbsfTrimList_module_css_default.sortButton,
								type: "button",
								"aria-label": t("trimSortToggle"),
								title: t("trimSortToggle"),
								onClick: () => {
									setView((prev) => ({
										...prev,
										desc: !prev.desc
									}));
								},
								children: view.desc ? "↓" : "↑"
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: MbsfTrimList_module_css_default.summaryRow,
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: MbsfTrimList_module_css_default.summary,
							children: [t("trimSummary", {
								n: data.selectedCount,
								size: formatBytes(data.selectedBytes)
							}), ` · ${t("trimViewSummary", {
								shown: stats.shown,
								total: stats.total
							})}`]
						}), locked ? null : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("button", {
							className: MbsfConfigCard_module_css_default.button,
							type: "button",
							disabled: busy !== "" || visible.length === 0,
							onClick: () => {
								setAll(true);
							},
							children: t("trimSelectAll")
						}), (0, react_jsx_runtime.jsx)("button", {
							className: MbsfConfigCard_module_css_default.button,
							type: "button",
							disabled: busy !== "" || visible.length === 0,
							onClick: () => {
								setAll(false);
							},
							children: t("trimClearAll")
						})] })]
					}),
					narrowed && !locked && visible.length > 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: MbsfTrimList_module_css_default.note,
						children: t("trimScopeNote")
					}) : null,
					data.rows.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: MbsfTrimList_module_css_default.note,
						children: t("trimEmpty")
					}) : visible.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: MbsfTrimList_module_css_default.note,
						children: t("trimNoMatch")
					}) : (0, react_jsx_runtime.jsx)("div", {
						className: MbsfTrimList_module_css_default.groups,
						children: groups.map((group) => {
							const isFlat = view.groupBy === "flat";
							const isCollapsed = collapsed.has(group.key);
							return (0, react_jsx_runtime.jsxs)("section", {
								className: MbsfTrimList_module_css_default.group,
								style: { marginLeft: `${group.depth * 14}px` },
								children: [isFlat ? null : (0, react_jsx_runtime.jsxs)("button", {
									className: MbsfTrimList_module_css_default.groupHead,
									type: "button",
									"aria-expanded": !isCollapsed,
									onClick: () => {
										setCollapsed((prev) => {
											const next = new Set(prev);
											if (next.has(group.key)) next.delete(group.key);
											else next.add(group.key);
											return next;
										});
									},
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: MbsfTrimList_module_css_default.groupArrow,
											children: isCollapsed ? "▸" : "▾"
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: MbsfTrimList_module_css_default.groupName,
											children: group.label
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: MbsfTrimList_module_css_default.groupCount,
											children: t("trimGroupCount", {
												n: group.rows.length,
												selected: groupSelectedCount(group)
											})
										})
									]
								}), isCollapsed ? null : (0, react_jsx_runtime.jsx)("ul", {
									className: MbsfTrimList_module_css_default.list,
									children: group.rows.map((row) => {
										const blocked = blockedReason(row);
										return (0, react_jsx_runtime.jsxs)("li", {
											className: MbsfTrimList_module_css_default.row,
											children: [
												(0, react_jsx_runtime.jsxs)("label", {
													className: MbsfTrimList_module_css_default.label,
													children: [
														(0, react_jsx_runtime.jsx)("input", {
															type: "checkbox",
															className: MbsfTrimList_module_css_default.checkbox,
															checked: row.selected,
															disabled: locked || busy !== "",
															onChange: (event) => {
																flip(row, event.currentTarget.checked);
															}
														}),
														(0, react_jsx_runtime.jsxs)("span", {
															className: MbsfTrimList_module_css_default.main,
															children: [
																row.title === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
																	className: MbsfTrimList_module_css_default.name,
																	title: row.title,
																	children: row.title
																}),
																(0, react_jsx_runtime.jsx)("span", {
																	className: MbsfTrimList_module_css_default.path,
																	title: row.workspacePath,
																	children: row.workspacePath
																}),
																(0, react_jsx_runtime.jsxs)("span", {
																	className: MbsfTrimList_module_css_default.meta,
																	children: [
																		(0, react_jsx_runtime.jsx)("code", {
																			className: MbsfTrimList_module_css_default.id,
																			title: row.id,
																			children: row.id
																		}),
																		row.origin === void 0 ? "" : ` · ${row.origin}`,
																		row.archived ? (0, react_jsx_runtime.jsx)("span", {
																			className: MbsfTrimList_module_css_default.badge,
																			children: t("trimBadgeArchived")
																		}) : row.rootArchived ? (0, react_jsx_runtime.jsx)("span", {
																			className: MbsfTrimList_module_css_default.badge,
																			title: t("trimBadgeRootArchivedHint"),
																			children: t("trimBadgeRootArchived")
																		}) : null,
																		row.orphan ? (0, react_jsx_runtime.jsx)("span", {
																			className: MbsfTrimList_module_css_default.badge,
																			children: t("trimBadgeOrphan")
																		}) : null,
																		` · ${formatBytes(row.bytes)}`,
																		` · ${relative(row.mtimeMs)}`
																	]
																})
															]
														}),
														(0, react_jsx_runtime.jsx)("span", {
															className: MbsfTrimList_module_css_default.last,
															children: row.lastTrim === null ? t("trimNeverTrimmed") : t("trimLastFreed", { size: formatBytes(row.lastTrim.freedBytes) })
														})
													]
												}),
												(0, react_jsx_runtime.jsx)("button", {
													className: copied === row.id ? `${MbsfTrimList_module_css_default.copy} ${MbsfTrimList_module_css_default.copyDone}` : MbsfTrimList_module_css_default.copy,
													type: "button",
													title: copied === row.id ? t("sessionIdCopied") : t("trimCopyId"),
													"aria-label": t("trimCopyId"),
													onClick: () => {
														copyId(row.id);
													},
													children: copied === row.id ? "✓" : "⧉"
												}),
												(0, react_jsx_runtime.jsx)("button", {
													className: MbsfTrimList_module_css_default.trash,
													type: "button",
													disabled: busy !== "" || blocked !== null,
													title: blocked ?? t("trimDelete"),
													"aria-label": blocked ?? t("trimDelete"),
													onClick: () => {
														setPending({
															row,
															children: childIndex.get(row.id) ?? 0
														});
													},
													children: "🗑"
												})
											]
										}, row.id);
									})
								})]
							}, group.key === "" ? "__flat__" : group.key);
						})
					}),
					pending === null ? null : (0, react_jsx_runtime.jsx)("div", {
						className: MbsfTrimList_module_css_default.dialogBackdrop,
						role: "dialog",
						"aria-modal": "true",
						"aria-label": t("trimDeleteConfirmTitle"),
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: MbsfTrimList_module_css_default.dialog,
							children: [
								(0, react_jsx_runtime.jsx)("strong", {
									className: MbsfTrimList_module_css_default.dialogTitle,
									children: t("trimDeleteConfirmTitle")
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: MbsfTrimList_module_css_default.dialogBody,
									children: t("trimDeleteConfirmBody", {
										title: pending.row.title ?? pending.row.id,
										days: RETENTION_DAYS
									})
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: MbsfTrimList_module_css_default.path,
									children: pending.row.workspacePath
								}),
								pending.children === 0 ? null : (0, react_jsx_runtime.jsx)("p", {
									className: MbsfConfigCard_module_css_default.dangerHint ?? MbsfTrimList_module_css_default.note,
									children: t("trimDeleteChildren", { n: pending.children })
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: MbsfTrimList_module_css_default.dialogActions,
									children: [(0, react_jsx_runtime.jsx)("button", {
										className: MbsfConfigCard_module_css_default.button,
										type: "button",
										onClick: () => {
											setPending(null);
										},
										children: t("trimDeleteCancel")
									}), (0, react_jsx_runtime.jsx)("button", {
										className: MbsfTrimList_module_css_default.dangerButton,
										type: "button",
										onClick: confirmDelete,
										children: t("trimDeleteConfirmOk")
									})]
								})
							]
						})
					})
				] });
			}
		}
		//#endregion
		//#region lib/types/client/MbsfSettingsSection.js
		/** 未必记忆设置页——设置 → 「未必记忆」顶层页：上半功能开关（staged + save），下半只读运行状态。 */
		/** 渲染未必记忆顶层设置页。 */
		function MbsfSettingsSection(props) {
			const { t, snapshot, toggle, save, resetField, setNumber, restartDsh, reclaimMemory, trimTargets, setTrimTarget, trimDelete, trimDeleted, trimRestore } = props;
			const [restartState, setRestartState] = (0, react.useState)("idle");
			const [restartDetail, setRestartDetail] = (0, react.useState)("");
			const [reclaimState, setReclaimState] = (0, react.useState)("idle");
			const [reclaimDetail, setReclaimDetail] = (0, react.useState)("");
			const card = props.useMbsfCard((current) => current);
			const [request, setRequest] = (0, react.useState)(0);
			const [trimSelected, setTrimSelected] = (0, react.useState)(0);
			const [state, setState] = (0, react.useState)({ status: "loading" });
			(0, react.useEffect)(() => {
				let current = true;
				Promise.resolve().then(() => snapshot()).then((data) => {
					if (current) setState({
						status: "ready",
						snapshot: data
					});
				}, () => {
					if (current) setState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [snapshot, request]);
			const retry = () => {
				setState({ status: "loading" });
				setRequest((value) => value + 1);
			};
			const available = card.available;
			const disabled = !available || !card.writable;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfSettingsSection_module_css_default.page,
				children: [
					(0, react_jsx_runtime.jsxs)("section", {
						className: MbsfConfigCard_module_css_default.card,
						"aria-label": t("configurableCardTitle"),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: MbsfConfigCard_module_css_default.header,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: MbsfConfigCard_module_css_default.heading,
									children: [(0, react_jsx_runtime.jsx)("strong", { children: t("configurableCardTitle") }), (0, react_jsx_runtime.jsx)("span", {
										className: MbsfConfigCard_module_css_default.description,
										children: t("configurableCardDescription")
									})]
								}), (0, react_jsx_runtime.jsx)("span", {
									className: MbsfConfigCard_module_css_default.hint,
									children: t("cardHint")
								})]
							}),
							available ? (0, react_jsx_runtime.jsxs)("div", {
								className: MbsfConfigCard_module_css_default.fields,
								children: [
									(0, react_jsx_runtime.jsx)(SwitchRow, {
										id: "mbsf-date-anchor-enabled",
										label: t("dateAnchorEnabled"),
										hint: t("dateAnchorEnabledHint"),
										disabled,
										value: card.dateAnchorEnabled.value,
										onToggle: () => {
											toggle("dateAnchorEnabled");
										}
									}),
									(0, react_jsx_runtime.jsx)(SwitchRow, {
										id: "mbsf-auto-compact",
										label: t("autoCompact"),
										hint: t("autoCompactHint"),
										disabled,
										value: card.autoCompact.value,
										onToggle: () => {
											toggle("autoCompact");
										}
									}),
									(0, react_jsx_runtime.jsx)(NumberRow, {
										id: "mbsf-compact-tail-messages",
										label: t("compactTailMessages"),
										hint: t("compactTailMessagesHint"),
										disabled,
										min: 8,
										normalize: normalizeCompactTailMessages,
										value: card.compactTailMessages.value,
										onCommit: (value) => {
											setNumber("compactTailMessages", value);
										}
									}),
									(0, react_jsx_runtime.jsx)(SwitchRow, {
										id: "mbsf-restart-button-visible",
										label: t("restartButtonVisible"),
										hint: t("restartButtonVisibleHint"),
										disabled,
										value: card.restartButtonVisible.value,
										onToggle: () => {
											toggle("restartButtonVisible");
										}
									}),
									(0, react_jsx_runtime.jsx)(SwitchRow, {
										id: "mbsf-activity-indicator",
										label: t("activityIndicator"),
										hint: t("activityIndicatorHint"),
										disabled,
										value: card.activityIndicatorEnabled.value,
										onToggle: () => {
											toggle("activityIndicatorEnabled");
										}
									}),
									(0, react_jsx_runtime.jsx)(SwitchRow, {
										id: "mbsf-activity-label",
										label: t("activityLabel"),
										hint: t("activityLabelHint"),
										disabled,
										value: card.activityLabelEnabled.value,
										onToggle: () => {
											toggle("activityLabelEnabled");
										}
									}),
									card.restartButtonVisible.value ? (0, react_jsx_runtime.jsx)(MbsfTrimList, {
										t,
										trimTargets,
										setTrimTarget,
										trimDelete,
										trimDeleted,
										trimRestore,
										trimEnabled: card.restartCleanupEnabled.value,
										onToggleEnabled: () => {
											toggle("restartCleanupEnabled");
										},
										disabled,
										onSelectionChange: setTrimSelected,
										children: (0, react_jsx_runtime.jsxs)("div", {
											className: MbsfConfigCard_module_css_default.group,
											children: [
												(0, react_jsx_runtime.jsx)(NumberRow, {
													id: "mbsf-cleanup-prune-turns",
													label: t("cleanupPruneTurns"),
													hint: t("cleanupPruneTurnsHint"),
													disabled,
													min: 0,
													normalize: normalizeCleanupPruneTurns,
													value: card.cleanupPruneTurns.value,
													onCommit: (value) => {
														setNumber("cleanupPruneTurns", value);
													}
												}),
												(0, react_jsx_runtime.jsx)(NumberRow, {
													id: "mbsf-backup-keep-count",
													label: t("backupKeepCount"),
													hint: t("backupKeepCountHint"),
													disabled,
													min: 0,
													value: card.backupKeepCount.value,
													onCommit: (value) => {
														setNumber("backupKeepCount", value);
													}
												}),
												(0, react_jsx_runtime.jsx)(NumberRow, {
													id: "mbsf-session-stream-keep-count",
													label: t("sessionStreamKeepCount"),
													hint: t("sessionStreamKeepCountHint"),
													disabled,
													min: 0,
													value: card.sessionStreamKeepCount.value,
													onCommit: (value) => {
														setNumber("sessionStreamKeepCount", value);
													}
												})
											]
										})
									}) : null,
									card.restartButtonVisible.value ? (0, react_jsx_runtime.jsxs)("div", {
										className: MbsfConfigCard_module_css_default.row,
										children: [(0, react_jsx_runtime.jsxs)("div", {
											className: MbsfConfigCard_module_css_default.rowBody,
											children: [(0, react_jsx_runtime.jsx)("label", {
												className: MbsfConfigCard_module_css_default.rowLabel,
												children: t("restartDsh")
											}), (0, react_jsx_runtime.jsx)("button", {
												className: MbsfConfigCard_module_css_default.button,
												type: "button",
												disabled: disabled || restartState === "sent",
												onClick: () => {
													if (card.restartCleanupEnabled.value && trimSelected > 0) try {
														const w = window.open("", "_blank");
														if (w !== null) {
															try {
																w.document.write("<p style=\"font-family:system-ui;padding:40px;color:#666\">正在启动清理进度页…</p>");
															} catch {}
															const started = Date.now();
															const lang = document.documentElement.lang;
															const progressUrl = lang === "" ? "http://127.0.0.1:3081/" : `http://127.0.0.1:3081/?lang=${encodeURIComponent(lang)}`;
															const probe = () => {
																fetch(progressUrl, {
																	mode: "no-cors",
																	signal: AbortSignal.timeout(1500)
																}).then(() => {
																	try {
																		w.location.href = progressUrl;
																	} catch {}
																}, () => {
																	if (Date.now() - started < 2e4) setTimeout(probe, 400);
																	else try {
																		w.document.write("<p style=\"font-family:system-ui;padding:40px;color:#666\">未能连接进度页（清理可能已跳过或已完成）。DSH 就绪后本页可关闭。</p>");
																	} catch {}
																});
															};
															setTimeout(probe, 300);
														}
													} catch {}
													setRestartState("sent");
													restartDsh().then((result) => {
														setRestartState(result.ok ? "sent" : "failed");
														setRestartDetail(result.detail ?? "");
													}, (error) => {
														setRestartState("failed");
														setRestartDetail(String(error));
													});
												},
												children: restartState === "sent" ? t("restartSent") : t("restartDsh")
											})]
										}), (0, react_jsx_runtime.jsx)("p", {
											className: MbsfConfigCard_module_css_default.rowHint,
											children: restartState === "failed" ? `${t("restartFailed")}：${restartDetail}` : t("restartDshHint")
										})]
									}) : null,
									state.status === "ready" && state.snapshot.heap !== void 0 ? (0, react_jsx_runtime.jsx)(HeapStatus, {
										heap: state.snapshot.heap,
										catalog: state.snapshot.catalog,
										verifier: state.snapshot.verifier,
										t
									}) : null,
									(0, react_jsx_runtime.jsxs)("div", {
										className: MbsfConfigCard_module_css_default.row,
										children: [(0, react_jsx_runtime.jsxs)("div", {
											className: MbsfConfigCard_module_css_default.rowBody,
											children: [(0, react_jsx_runtime.jsx)("label", {
												className: MbsfConfigCard_module_css_default.rowLabel,
												children: t("reclaimTitle")
											}), (0, react_jsx_runtime.jsx)("button", {
												className: MbsfConfigCard_module_css_default.button,
												type: "button",
												disabled: disabled || reclaimState === "running",
												onClick: () => {
													setReclaimState("running");
													setReclaimDetail("");
													reclaimMemory().then((result) => {
														setReclaimState(result.ok ? "done" : "failed");
														setReclaimDetail(result.detail ?? "");
														setRequest((value) => value + 1);
													}, (error) => {
														setReclaimState("failed");
														setReclaimDetail(String(error));
													});
												},
												children: reclaimState === "running" ? t("reclaimRunning") : t("reclaimButton")
											})]
										}), (0, react_jsx_runtime.jsx)("p", {
											className: MbsfConfigCard_module_css_default.rowHint,
											children: reclaimState === "failed" ? `${t("reclaimFailed")}：${reclaimDetail}` : reclaimState === "done" ? reclaimDetail : t("reclaimHint")
										})]
									})
								]
							}) : (0, react_jsx_runtime.jsxs)("p", {
								className: MbsfConfigCard_module_css_default.description,
								"data-debug": true,
								children: [
									"[diag] scope=",
									card.status,
									" writable=",
									String(card.writable)
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: MbsfConfigCard_module_css_default.actions,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: MbsfConfigCard_module_css_default.status,
									"data-failed": card.failed ? "true" : void 0,
									children: card.failed ? t("saveFailed") : card.saving ? t("saving") : card.dirty ? t("unsaved") : t("saved")
								}), card.failed ? (0, react_jsx_runtime.jsx)("button", {
									className: MbsfConfigCard_module_css_default.button,
									type: "button",
									disabled: disabled || card.saving,
									onClick: () => {
										save();
									},
									children: t("retrySave")
								}) : null]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: MbsfStatusTab_module_css_default.section,
						"aria-busy": state.status === "loading",
						children: [
							state.status === "loading" ? (0, react_jsx_runtime.jsx)("p", {
								className: MbsfStatusTab_module_css_default.status,
								children: t("loading")
							}) : null,
							state.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
								className: MbsfStatusTab_module_css_default.failure,
								children: [(0, react_jsx_runtime.jsx)("p", {
									role: "alert",
									children: t("error")
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: retry,
									children: t("retry")
								})]
							}) : null,
							state.status === "ready" ? (0, react_jsx_runtime.jsx)(StatusBody, {
								snapshot: state.snapshot,
								t,
								showVersion: false
							}) : null
						]
					}),
					(0, react_jsx_runtime.jsx)(BrandCard, {
						t,
						version: state.status === "ready" ? state.snapshot.version : "—"
					})
				]
			});
		}
		/** 堆现状（只读）：已用/上限进度条 + 配置≠生效提示。
		*
		*  `usedRatio ≥ 0.85` 标红——这是**提示不是判定**（余量告急时用户该调大
		*  并重启；阈值是工程窗口，非结构量）。 */
		function HeapStatus({ heap, catalog, verifier, t }) {
			const usedMb = heap.usedMb ?? 0;
			const limitMb = heap.limitMb ?? 0;
			const ratio = heap.usedRatio ?? (limitMb > 0 ? usedMb / limitMb : 0);
			const warn = ratio >= .85;
			const configured = heap.configuredMb ?? 0;
			const pending = configured > 0 && configured !== limitMb;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfConfigCard_module_css_default.row,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: MbsfConfigCard_module_css_default.heapLine,
						children: [
							(0, react_jsx_runtime.jsx)("span", { children: t("dshHeapUsed") }),
							(0, react_jsx_runtime.jsxs)("span", { children: [
								(usedMb / 1024).toFixed(1),
								" / ",
								(limitMb / 1024).toFixed(1),
								" GB"
							] }),
							(0, react_jsx_runtime.jsxs)("span", {
								className: MbsfConfigCard_module_css_default.muted,
								children: [Math.round(ratio * 100), "%"]
							}),
							warn ? (0, react_jsx_runtime.jsx)("span", {
								className: MbsfConfigCard_module_css_default.muted,
								children: t("dshHeapAtLimit")
							}) : null
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: MbsfConfigCard_module_css_default.heapBar,
						children: (0, react_jsx_runtime.jsx)("div", {
							className: MbsfConfigCard_module_css_default.heapBarFill,
							"data-warn": warn ? "true" : void 0,
							style: { width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }
						})
					}),
					pending ? (0, react_jsx_runtime.jsx)("p", {
						className: MbsfConfigCard_module_css_default.rowHint,
						children: t("dshHeapRestartHint").replace("{configured}", `${configured / 1024} GB`).replace("{live}", `${(limitMb / 1024).toFixed(1)} GB`)
					}) : null,
					heap.autoReclaimActive ? (0, react_jsx_runtime.jsxs)("p", {
						className: MbsfConfigCard_module_css_default.rowHint,
						children: [
							t("autoReclaimLast"),
							"：",
							heap.autoReclaim ? `${_ago(heap.autoReclaim.at, t)} · ${(heap.autoReclaim.reclaimed / 1048576).toFixed(0)} MB` + (heap.autoReclaim.reason === "emergency" ? ` · ${t("autoReclaimReasonEmergency")}` : "") : t("autoReclaimNever")
						]
					}) : null,
					heap.idle !== void 0 || catalog !== void 0 || verifier !== void 0 ? (0, react_jsx_runtime.jsxs)("p", {
						className: MbsfConfigCard_module_css_default.rowHint,
						"data-diag": true,
						children: [
							heap.idle !== void 0 ? `${t("diagIdle")}：${heap.idle.idle ? t("diagFree") : t("diagBusy")} · ${t("diagInflight")} ${heap.idle.inflight} · ${t("diagPhase")} ${heap.idle.phase}` : null,
							heap.idle !== void 0 && (catalog !== void 0 || verifier !== void 0) ? " ｜ " : null,
							catalog !== void 0 ? `catalog：${catalog.effective ?? "—"}` + (catalog.probed !== null && catalog.probed !== void 0 ? ` (${t("diagHost")} ${catalog.probed})` : ` (${t("diagHostNone")})`) + (catalog.historical === true ? ` · ${t("diagHistorical")}` : "") : null,
							catalog !== void 0 && verifier !== void 0 ? " ｜ " : null,
							verifier !== void 0 ? `verifier：${verifier.sessionTypes ?? "—"} ${t("diagSessionTypes")} · ${verifier.knowsNewTypes === true ? t("diagKnowsNew") : t("diagUnknownNew")}` + _pathTail(verifier.sessionPath) : null
						]
					}) : null
				]
			});
		}
		/** 相对时间（「X 分钟前」）——只用于展示，精度到分钟足够。
		*  `t` 由调用方传入（本文件是模块级函数，拿不到 locale 座位）。 */
		/** 品牌卡片：合体图 + 三行文字（名字/版权/公司）。
		*
		* **高度为什么用 JS 量**（2026-11-07 一帆：logo 要和右边文字一样高）：
		* 第一版写的是 `align-self: stretch`，以为 flex 会把图拉到与右侧文字同高——
		* 实测**不成立**：`stretch` 拉向的是 flex 容器的 cross size，而这个容器的高度
		* 恰恰由图自己的固有高度决定（168×160 的图 + `max-height` 上限），于是图比
		* 文字高一截，还把整张卡片撑高。纯 CSS 没有「取兄弟元素高度」的写法，
		* 所以这里量一次 `brandMeta` 的盒高，把图的高度设成同一个值，宽度按固有比例走；
		* 语言换了、文案折行变了，`ResizeObserver` 会重新量。
		* 量不到（SSR / 没有 ResizeObserver）就退回 CSS 的固定高度——不是关键路径。 */
		function BrandCard({ t, version }) {
			const metaRef = (0, react.useRef)(null);
			const [logoHeight, setLogoHeight] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const el = metaRef.current;
				if (el === null || typeof ResizeObserver === "undefined") return;
				const measure = () => {
					const height = Math.round(el.getBoundingClientRect().height);
					setLogoHeight((prev) => prev === height ? prev : height);
				};
				measure();
				const observer = new ResizeObserver(measure);
				observer.observe(el);
				return () => {
					observer.disconnect();
				};
			}, []);
			return (0, react_jsx_runtime.jsxs)("section", {
				className: MbsfSettingsSection_module_css_default.brand,
				"aria-label": t("nav"),
				children: [(0, react_jsx_runtime.jsx)("img", {
					className: MbsfSettingsSection_module_css_default.brandLogo,
					src: MBSF_LOGO_LOCKUP_DATA_URL,
					alt: t("nav"),
					draggable: false,
					style: logoHeight > 0 ? {
						height: `${logoHeight}px`,
						width: "auto"
					} : void 0
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: MbsfSettingsSection_module_css_default.brandMeta,
					ref: metaRef,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: MbsfSettingsSection_module_css_default.brandTitleRow,
							children: [(0, react_jsx_runtime.jsx)("strong", {
								className: MbsfSettingsSection_module_css_default.brandName,
								children: t("nav")
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: MbsfSettingsSection_module_css_default.brandVersion,
								children: [
									t("version"),
									" ",
									(0, react_jsx_runtime.jsx)("code", { children: version })
								]
							})]
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: MbsfSettingsSection_module_css_default.brandLine,
							children: t("brandCopyright")
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: MbsfSettingsSection_module_css_default.brandSmall,
							children: t("brandCompany")
						})
					]
				})]
			});
		}
		function _ago(at, t) {
			const s = Math.max(0, Math.round((Date.now() - at) / 1e3));
			if (s < 60) return t("timeSecondsAgo", { n: s });
			const m = Math.round(s / 60);
			if (m < 60) return `${m} 分钟前`;
			return `${Math.round(m / 60)} 小时前`;
		}
		/** 路径末两段（`…/dsh-session/lib/index.js`）——诊断行只显示这个，
		*  完整路径会撑爆行宽；但足以区分「asar 里那份」与「0.1.5 检出那份」。 */
		function _pathTail(path) {
			if (typeof path !== "string" || path === "") return "";
			return ` · ${path.split("/").filter((p) => p !== "").slice(-3).join("/")}`;
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Copy dictionaries for the MBSF settings surface.
		*
		*  **文案原则（一帆 2026-11-07 定）**：只写「效果」，不写内部术语。
		*
		*  理由不是文风偏好，是**可翻译性**：术语（γ 记忆 / 灰区 / 真止 / 片段归并）
		*  在任何语言里都没有现成对应词，翻译时只能硬造一个，读的人不懂、译的人心虚。
		*  效果描述（「对话太长时自动把早先的部分压成摘要，省下上下文」）在任何语言里
		*  都有现成说法 —— 翻译就退化成如实复述，容错率极高。
		*
		*  推论：
		*  - 品牌名（未必科幻 / MAYBE SCI-FI）与版权行**不进翻译**（locales-intl.ts 里
		*    逐字复用 `brandCopyright` / `brandCompany` / `configurableCardTitle`）。
		*  - 新增文案先问一句：这句话换个语言还能直译吗？不能 → 说明写的是术语，改。
		*/
		/** Simplified Chinese dictionary and key source of truth. */
		const zh = {
			nav: "未必科幻MBSF",
			configurableCardTitle: "未必科幻",
			configurableCardDescription: "本地运行设置——改完立即生效，只有标了「重启后生效」的才需要重启。",
			loading: "正在读取…",
			error: "读取失败，稍后再试。",
			retry: "重试",
			version: "版本",
			brain: "记忆库",
			encoder: "语言编码",
			sessions: "会话",
			seeded: "已导入旧记忆",
			trackedSessions: "已记录会话",
			globalEma: "全局平均",
			none: "无",
			compression: "压缩",
			never: "还没有压缩过",
			messages: "消息",
			compressed: "压缩",
			preserved: "保留",
			tailFpSegments: "片段",
			textChars: "字符",
			compressions: "压缩次数",
			emaMs: "平均耗时",
			lastMs: "最近耗时",
			compressionLine: "压缩",
			compressionLineHint: "本会话累计压缩：次数 · 折叠条数 · 最近耗时 · 距今时间",
			compressionJustNow: "刚刚",
			compressionMinutesAgo: "{n} 分钟前",
			compressionHoursAgo: "{n} 小时前",
			compressionHistory: "压缩记录",
			historyEmpty: "本会话还没有压缩过",
			memoryIndex: "记忆索引",
			topics: "话题",
			totalRefs: "条目",
			sessionRefs: "来自会话",
			fileRefs: "来自文件",
			nestedTopics: "已合并话题",
			initialized: "已就绪",
			segments: "内容",
			segmentCount: "段数",
			totalLines: "行数",
			totalBytes: "大小",
			injection: "记忆浮现",
			calls: "判定次数",
			needInjected: "直接浮现",
			weakInjected: "部分浮现",
			injected: "浮现条数",
			injectedChars: "浮现字符",
			recall: "回想",
			needTrue: "直接浮现",
			needFalse: "部分浮现",
			expanded: "展开",
			expandedChars: "展开字符",
			growth: "记忆增长",
			gMessages: "记住的消息",
			gDuplicate: "重复合并",
			gChainMerge: "相似合并",
			gNewTopic: "新话题",
			gShadowed: "被跳过",
			gNestEdge: "建立了关联",
			gNestHot: "与常用话题关联",
			gNestArch: "与历史话题关联",
			injectEnabled: "记忆浮现",
			injectEnabledHint: "每步之前，按之前聊过的内容自动带出相关记忆。默认关。",
			autoCompact: "自动压缩",
			autoCompactHint: "对话变长时，自动把较早的部分压成摘要，省下上下文。关掉后只有快放不下时才压缩。",
			compactTailMessages: "压缩时保留最近几条",
			compactTailMessagesHint: "压缩时永远保留原文的最近消息条数（8–256，默认 64）。这是硬底线：最近的这些消息不会被压进摘要，只有更早的才可能被压。",
			dateAnchorEnabled: "日期提示",
			dateAnchorEnabledHint: "每天第一次对话时告诉模型今天是哪天，避免它按上下文往前猜。默认开。",
			restartCleanupEnabled: "重启时清理",
			restartCleanupEnabledHint: "点重启时顺便瘦身：删掉助手的旧输出，再裁掉较早的对话，范围是所有会话。关掉就只是重启，更快。",
			cleanupPruneTurns: "至少保留多少轮对话",
			cleanupPruneTurnsHint: "0 = 不动对话，只删助手旧输出。设 N 则至少保留最近 N 轮（实际通常更多）。",
			backupKeepCount: "每个会话留几份备份",
			backupKeepCountHint: "改动之前先备份，这里设保留几份，方便改坏了回滚。0 = 全部保留。",
			restartButtonVisible: "显示「重启 DSH」按钮",
			restartButtonVisibleHint: "在本页显示重启按钮，用来手动释放内存或载入新版本。重启期间所有会话会短暂断开。",
			sessionStreamKeepCount: "保留最近多少条助手输出",
			sessionStreamKeepCountHint: "清理时留下最近的这么多条（默认 200），方便重启后还能查刚才几轮。0 = 全删。",
			restartDsh: "重启 DSH",
			restartDshHint: "立即重启。所有会话会短暂断开，正在进行的回答会中断。上面的清理如果开着，会一并执行。",
			restartSent: "已发出重启请求…",
			restartFailed: "重启请求失败",
			dshHeapMb: "内存上限",
			dshHeapMbHint: "重启时给 DSH 分配的内存上限。历史太多时默认额度会撑爆导致崩溃。改完要重启才生效。0 = 用系统默认。",
			autoReclaimEnabled: "空闲时自动省内存",
			autoReclaimEnabledHint: "只在没活干的时候，清掉可以重算的临时数据。忙的时候清没用——下一次回想立刻又建回来。不删数据，只是清完第一次回想稍慢。默认关。",
			autoReclaimThresholdPct: "省内存的触发点",
			autoReclaimThresholdPctHint: "内存用到这个比例就开始清理，按实际可用上限算，所以不同安装方式都自动适配。太低会频繁清，太高就快崩溃才动手。建议 60%。",
			autoReclaimNever: "还没有触发过",
			autoReclaimReasonEmergency: "内存吃紧，没等空闲就清了",
			autoReclaimLast: "上次自动省内存",
			reclaimTitle: "立即省内存",
			reclaimButton: "省内存",
			reclaimRunning: "正在清理…",
			reclaimHint: "清掉可以重算的临时数据，腾出内存（实测约 1.3 GB，用时约 0.1 秒）。清完第一次回想会稍慢（约 1.4 秒），之后恢复正常。不删任何数据。",
			reclaimFailed: "清理失败",
			dshHeapUsed: "当前内存占用",
			dshHeapRestartHint: "已设 {configured}，当前实际 {live}——重启后才会生效。",
			dshHeapAtLimit: "快满了，建议调大后重启",
			overridden: "已改过",
			save: "保存",
			discard: "放弃",
			saved: "已保存",
			saving: "保存中…",
			unsaved: "有改动未保存",
			saveFailed: "保存失败",
			retrySave: "重试保存",
			brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
			brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
			restartCleanupDanger: "⚠️ 剪裁会删掉勾中会话的历史输出和较早的对话。删掉的内容找不回来——摘要和记忆只留大意，不是原文。",
			cardHint: "设置保存在 ~/.mbsf/config.json，改完立即生效。",
			trimTitle: "会话历史剪裁",
			trimHintLead: "⚠ 只在重启时剪裁——重启时才动手，运行中完全不动。",
			trimHint: "勾中的会话会在重启时瘦身：删掉助手的旧输出，再裁掉较早的对话，只留最近的。没勾的会话完全不动。",
			trimOn: "开",
			trimOff: "关",
			trimOffHint: "已关闭——重启时不会剪裁任何会话。打开这个开关即可启用并设置。",
			trimGlobalWins: "上面的「重启时清理」已开着，会清理所有会话——这里勾了也不影响结果。要按会话清理，请先把上面的开关关掉。",
			trimListLoading: "正在列出会话…",
			trimListFailed: "读取会话清单失败",
			trimEmpty: "没有可剪裁的会话",
			trimSelectAll: "全选",
			trimClearAll: "全不选",
			trimSummary: "已勾 {n} 个会话 · 共 {size}",
			trimNeverTrimmed: "没剪过",
			trimLastFreed: "释放 {size}",
			trimRefresh: "刷新",
			trimSearchPlaceholder: "搜索 会话 ID / 工作区",
			trimFilterAll: "全部",
			trimFilterSelected: "已勾选",
			trimFilterUnselected: "未勾选",
			trimSortMtime: "最近活动",
			trimSortCreated: "创建时间",
			trimSortSize: "大小",
			trimSortPath: "工作区",
			trimSortToggle: "切换正序/倒序",
			trimNoMatch: "没有符合筛选条件的会话",
			trimViewSummary: "显示 {shown} / 共 {total} 条",
			trimCopyId: "复制会话 ID",
			trimScopeNote: "勾选只作用于列出的会话——搜索或筛选后碰不到看不见的",
			sessionIdLabel: "会话",
			sessionIdCopy: "复制会话 ID",
			sessionIdCopied: "已复制",
			sessionIdCopyFailed: "复制失败，请手动选中",
			close: "关闭",
			floatingPanelButton: "会话开关",
			floatingPanelTitle: "未必科幻MBSF",
			sessionInject: "记忆浮现",
			sessionInjectHint: "本会话是否自动带出相关记忆。没改过就跟随父会话或全局设置。",
			sessionDateAnchor: "日期提示",
			sessionDateAnchorHint: "本会话是否告诉模型今天是哪天。没改过就跟随父会话或全局设置。",
			sessionAutoCompact: "自动压缩",
			sessionAutoCompactHint: "本会话对话变长时是否自动压成摘要。没改过就跟随父会话或全局设置；关掉后只有快放不下时才压缩。",
			sessionInheritedParent: "跟随父会话",
			sessionInheritedGlobal: "跟随全局设置",
			sessionInheritedHint: "当前是跟随来的值；点一下开关就是给本会话单独设置。",
			activityRead: "回忆中",
			activityWrite: "落位中",
			activityCompact: "压缩中",
			activityHint: "正在进行的操作——读＝展开 / 写＝落位 / 压＝归并",
			activityIndicator: "活动动画",
			activityIndicatorHint: "在图标上显示正在进行的操作：水滴绕图标转圈。关闭后图标静止。",
			activityLabel: "活动文字",
			activityLabelHint: "在图标旁显示当前动作的文字。与动画开关互相独立——动画答「有没有在动」，文字答「在动什么」。",
			diagIdle: "空闲判定",
			diagFree: "真闲",
			diagBusy: "忙",
			diagInflight: "在途",
			diagPhase: "阶段",
			diagHost: "宿主",
			diagHostNone: "无宿主探测",
			diagHistorical: "有历史归档",
			diagSessionTypes: "种会话格式",
			diagKnowsNew: "认得新格式 ✓",
			diagUnknownNew: "✗ 不认新格式（剪裁会全部跳过）",
			timeSecondsAgo: "{n} 秒前",
			trimTabSessions: "会话",
			trimTabDeleted: "已删除",
			trimGroupByLabel: "分组方式",
			trimGroupWorkspace: "按工作区",
			trimGroupTree: "按工作区树",
			trimGroupFlat: "单列表",
			trimScopeLabel: "会话类型",
			trimScopeAll: "全部",
			trimScopeMain: "仅主会话",
			trimScopeSubagent: "仅子代理",
			trimArchiveLabel: "已归档",
			trimArchiveHide: "隐藏已归档",
			trimArchiveShow: "全部对话（显示已归档）",
			trimArchiveOnly: "仅显示已归档",
			trimBadgeArchived: "已归档",
			trimBadgeRootArchived: "随父归档",
			trimBadgeOrphan: "孤儿",
			trimBadgeRootArchivedHint: "它属于一个已归档的主会话（归档不会带上子代理，所以它自己的归档位没变）",
			trimBadgeSubagent: "子代理",
			trimGroupCount: "{n} 个会话 · 勾选 {selected}",
			trimDelete: "删除会话",
			trimDeleteBlockedActive: "活跃会话不能删——先在 DSH 里归档它",
			trimDeleteBlockedLive: "正在运行，不能删",
			trimDeleteBlockedParent: "主会话还没归档——先归档主会话，它的子代理才能删",
			trimDeleteConfirmTitle: "删除会话？",
			trimDeleteConfirmBody: "「{title}」会被移到回收站，{days} 天内可以恢复；到期后自动永久清理。",
			trimDeleteChildren: "它名下的 {n} 个子代理会话会一起被删（恢复时一起回来）。",
			trimDeleteConfirmOk: "移到回收站",
			trimDeleteCancel: "取消",
			trimDeleteDone: "已移到回收站：{n} 个会话，{days} 天内可恢复",
			trimDeleteFailed: "删除失败：{detail}",
			trimDeletedEmpty: "回收站是空的",
			trimDeletedHint: "删除的会话保留 {days} 天。打开这个列表时，到期的会被自动永久清理。",
			trimDeletedAt: "删除于 {date}",
			trimDeletedRemaining: "还剩 {n} 天",
			trimDeletedRestore: "恢复",
			trimRestoreDone: "已恢复 {n} 个会话",
			trimRestoreFailed: "恢复失败：{detail}",
			trimDeletedPurged: "已永久清理 {n} 项（超过 {days} 天）"
		};
		/** English dictionary (mirror of {@link zh}; typed so a missing key fails the build). */
		const en = {
			nav: "未必科幻MBSF",
			configurableCardTitle: "未必科幻",
			configurableCardDescription: "Local runtime settings — changes apply immediately; only the ones marked \"after restart\" need one.",
			loading: "Reading…",
			error: "Could not read the status. Try again later.",
			retry: "Retry",
			version: "Version",
			brain: "Memory store",
			encoder: "Language encoding",
			sessions: "Sessions",
			seeded: "Old memories imported",
			trackedSessions: "Sessions recorded",
			globalEma: "Overall average",
			none: "None",
			compression: "Compression",
			never: "Not compressed yet",
			messages: "Messages",
			compressed: "Compressed",
			preserved: "Kept",
			tailFpSegments: "Fragments",
			textChars: "Characters",
			compressions: "Compressions",
			emaMs: "Average time",
			lastMs: "Last time",
			compressionLine: "Compression",
			compressionLineHint: "Compression so far in this session: count · folded messages · last duration · how long ago",
			compressionJustNow: "just now",
			compressionMinutesAgo: "{n} min ago",
			compressionHoursAgo: "{n} h ago",
			compressionHistory: "Compression history",
			historyEmpty: "This session has not been compressed yet",
			memoryIndex: "Memory index",
			topics: "Topics",
			totalRefs: "Entries",
			sessionRefs: "From sessions",
			fileRefs: "From files",
			nestedTopics: "Merged topics",
			initialized: "Ready",
			segments: "Content",
			segmentCount: "Segments",
			totalLines: "Lines",
			totalBytes: "Size",
			injection: "Memory recall",
			calls: "Judgements",
			needInjected: "Recalled directly",
			weakInjected: "Partly recalled",
			injected: "Items recalled",
			injectedChars: "Characters recalled",
			recall: "Lookup",
			needTrue: "Recalled directly",
			needFalse: "Partly recalled",
			expanded: "Expanded",
			expandedChars: "Characters expanded",
			growth: "Memory growth",
			gMessages: "Messages remembered",
			gDuplicate: "Repeats merged",
			gChainMerge: "Similar items merged",
			gNewTopic: "New topics",
			gShadowed: "Skipped",
			gNestEdge: "Links made",
			gNestHot: "Linked to frequent topics",
			gNestArch: "Linked to past topics",
			injectEnabled: "Memory recall",
			injectEnabledHint: "Before each step, bring back memories related to what was discussed earlier. Off by default.",
			autoCompact: "Automatic compression",
			autoCompactHint: "When the conversation grows long, earlier parts are summarised to save context. If off, compression only happens when space runs out.",
			compactTailMessages: "Recent messages kept",
			compactTailMessagesHint: "How many recent messages always stay as original text (8–256, default 64). A hard floor: the latest messages are never folded into the summary — only older ones can be compacted.",
			dateAnchorEnabled: "Today's date",
			dateAnchorEnabledHint: "Tell the model the date at the first exchange each day, so it does not guess from context. On by default.",
			restartCleanupEnabled: "Clean up on restart",
			restartCleanupEnabledHint: "While restarting, also slim things down: drop the assistant's old output and trim older conversation, for every session. Turn off to just restart — faster.",
			cleanupPruneTurns: "Conversation turns to keep",
			cleanupPruneTurnsHint: "0 = leave conversations alone, only drop old assistant output. Set N to keep at least the last N turns (usually more).",
			backupKeepCount: "Backups kept per session",
			backupKeepCountHint: "A backup is made before any change; this is how many to keep so you can roll back. 0 = keep all.",
			restartButtonVisible: "Show the \"Restart DSH\" button",
			restartButtonVisibleHint: "Shows a restart button on this page, to free memory by hand or load a new version. Every session disconnects briefly.",
			sessionStreamKeepCount: "Assistant output to keep",
			sessionStreamKeepCountHint: "How many of the most recent entries to keep when cleaning (default 200), so you can still check the last few turns. 0 = drop all.",
			restartDsh: "Restart DSH",
			restartDshHint: "Restart now. Every session disconnects briefly and any answer in progress is interrupted. The cleanup above runs too, if it is on.",
			restartSent: "Restart requested…",
			restartFailed: "Restart request failed",
			dshHeapMb: "Memory limit",
			dshHeapMbHint: "How much memory DSH may use after a restart. With long histories the default is not enough and the process crashes. Takes effect after a restart. 0 = system default.",
			autoReclaimEnabled: "Free memory when idle",
			autoReclaimEnabledHint: "Only while nothing is running, drop temporary data that can be rebuilt. Clearing it during work is pointless — the next lookup builds it again. No data is deleted; only the first lookup afterwards is slower. Off by default.",
			autoReclaimThresholdPct: "When to free memory",
			autoReclaimThresholdPctHint: "Start clearing at this share of the memory actually available, so every setup adapts on its own. Too low clears constantly; too high waits until a crash is near. 60% is a good value.",
			autoReclaimNever: "Not triggered yet",
			autoReclaimReasonEmergency: "Memory was tight, ran without waiting for idle",
			autoReclaimLast: "Last automatic free-up",
			reclaimTitle: "Free memory now",
			reclaimButton: "Free memory",
			reclaimRunning: "Clearing…",
			reclaimHint: "Drop temporary data that can be rebuilt, to free memory (about 1.3 GB, roughly 0.1 s). The first lookup afterwards is slower (about 1.4 s). No data is deleted.",
			reclaimFailed: "Clearing failed",
			dshHeapUsed: "Memory in use",
			dshHeapRestartHint: "Set to {configured}, currently {live} — takes effect after a restart.",
			dshHeapAtLimit: "Nearly full — raise the limit and restart",
			overridden: "Changed",
			save: "Save",
			discard: "Discard",
			saved: "Saved",
			saving: "Saving…",
			unsaved: "Unsaved changes",
			saveFailed: "Save failed",
			retrySave: "Retry save",
			brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
			brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
			restartCleanupDanger: "⚠️ Trimming removes the older history output and earlier conversation of the ticked sessions. What is removed cannot be recovered — summaries and memories keep only the gist, not the original text.",
			cardHint: "Settings live in ~/.mbsf/config.json and apply immediately.",
			trimTitle: "Trim conversation history",
			trimHintLead: "⚠ Only on restart — trimming runs when you restart, not while the app is running.",
			trimHint: "Ticked sessions get slimmed down on restart: the assistant's old output is dropped and older conversation trimmed, keeping only the recent part. Unticked sessions are left untouched.",
			trimOn: "On",
			trimOff: "Off",
			trimOffHint: "Off — no conversation is trimmed on restart. Turn this switch on to enable and configure it.",
			trimGlobalWins: "\"Clean up on restart\" above is on, so every session is cleaned and ticking here makes no difference. Turn that switch off first to clean per session.",
			trimListLoading: "Listing sessions…",
			trimListFailed: "Could not read the session list",
			trimEmpty: "No sessions to trim",
			trimSelectAll: "Select all",
			trimClearAll: "Select none",
			trimSummary: "{n} sessions ticked · {size} in total",
			trimNeverTrimmed: "Never",
			trimLastFreed: "freed {size}",
			trimRefresh: "Refresh",
			trimSearchPlaceholder: "Search session ID / workspace",
			trimFilterAll: "All",
			trimFilterSelected: "Ticked",
			trimFilterUnselected: "Unticked",
			trimSortMtime: "Last used",
			trimSortCreated: "Created",
			trimSortSize: "Size",
			trimSortPath: "Workspace",
			trimSortToggle: "Toggle ascending / descending",
			trimNoMatch: "No sessions match the filter",
			trimViewSummary: "Showing {shown} of {total}",
			trimCopyId: "Copy session ID",
			trimScopeNote: "Ticking only affects the sessions listed — nothing hidden is touched",
			sessionIdLabel: "Session",
			sessionIdCopy: "Copy session ID",
			sessionIdCopied: "Copied",
			sessionIdCopyFailed: "Copy failed — select it by hand",
			close: "Close",
			floatingPanelButton: "Session switches",
			floatingPanelTitle: "未必科幻MBSF",
			sessionInject: "Memory recall",
			sessionInjectHint: "Whether related memories are brought back in this session. Unchanged means it follows the parent session or the global setting.",
			sessionDateAnchor: "Today's date",
			sessionDateAnchorHint: "Whether the model is told the date in this session. Unchanged means it follows the parent session or the global setting.",
			sessionAutoCompact: "Automatic compression",
			sessionAutoCompactHint: "Whether long conversations in this session are summarised automatically. Unchanged follows the parent session or the global setting; once off, compression only happens when space runs out.",
			sessionInheritedParent: "Following parent session",
			sessionInheritedGlobal: "Following global setting",
			sessionInheritedHint: "The value currently comes from somewhere else; flipping a switch sets it for this session alone.",
			activityRead: "Recalling",
			activityWrite: "Writing down",
			activityCompact: "Compressing",
			activityHint: "What is running now — reading, writing, or compressing",
			activityIndicator: "Activity animation",
			activityIndicatorHint: "Show what is running as a droplet circling the icon. When off, the icon stays still.",
			activityLabel: "Activity text",
			activityLabelHint: "Show the current action as text beside the icon. Independent of the animation — one says whether something is running, the other says what.",
			diagIdle: "Idle check",
			diagFree: "idle",
			diagBusy: "busy",
			diagInflight: "in flight",
			diagPhase: "phase",
			diagHost: "host",
			diagHostNone: "no host probe",
			diagHistorical: "has archived history",
			diagSessionTypes: "session formats",
			diagKnowsNew: "knows the new format ✓",
			diagUnknownNew: "✗ does not know the new format (trimming will skip everything)",
			timeSecondsAgo: "{n} s ago",
			trimTabSessions: "Conversations",
			trimTabDeleted: "Deleted",
			trimGroupByLabel: "Group by",
			trimGroupWorkspace: "By workspace",
			trimGroupTree: "Workspace tree",
			trimGroupFlat: "One list",
			trimScopeLabel: "Conversation type",
			trimScopeAll: "All",
			trimScopeMain: "Top-level only",
			trimScopeSubagent: "Subagents only",
			trimArchiveLabel: "Archived",
			trimArchiveHide: "Hide archived",
			trimArchiveShow: "Everything (show archived)",
			trimArchiveOnly: "Archived only",
			trimBadgeArchived: "archived",
			trimBadgeRootArchived: "parent archived",
			trimBadgeOrphan: "orphan",
			trimBadgeRootArchivedHint: "Belongs to an archived main session (archiving does not cascade to subagents)",
			trimBadgeSubagent: "subagent",
			trimGroupCount: "{n} conversations · {selected} ticked",
			trimDelete: "Delete conversation",
			trimDeleteBlockedActive: "An active conversation cannot be deleted — archive it in DSH first",
			trimDeleteBlockedLive: "Running, cannot delete",
			trimDeleteBlockedParent: "Its main session is not archived yet — archive that first",
			trimDeleteConfirmTitle: "Delete this conversation?",
			trimDeleteConfirmBody: "“{title}” moves to the recycle bin and can be restored for {days} days; after that it is cleaned up for good.",
			trimDeleteChildren: "Its {n} subagent conversations are deleted with it (and come back together when restored).",
			trimDeleteConfirmOk: "Move to recycle bin",
			trimDeleteCancel: "Cancel",
			trimDeleteDone: "Moved to recycle bin: {n} conversation(s), restorable for {days} days",
			trimDeleteFailed: "Could not delete: {detail}",
			trimDeletedEmpty: "The recycle bin is empty",
			trimDeletedHint: "Deleted conversations are kept for {days} days. Opening this list permanently cleans up the expired ones.",
			trimDeletedAt: "deleted {date}",
			trimDeletedRemaining: "{n} days left",
			trimDeletedRestore: "Restore",
			trimRestoreDone: "Restored {n} conversation(s)",
			trimRestoreFailed: "Could not restore: {detail}",
			trimDeletedPurged: "Permanently cleaned up {n} item(s) older than {days} days"
		};
		//#endregion
		//#region lib/types/client/locales-intl.js
		/**
		* 未必科幻页面的**非内置语种字典**（2026-11-07）
		*
		* DSH 内置只有 `zh` / `en` 两本字典；其它语言来自客户端语言包（language pack）。
		* 我们的命名空间 `settings.electronicSheep` 也一样——`zh`/`en` 之外要说日文，
		* 就得有人把日文字典交出来。本文件就是那份"交出来的东西"：8 个语种的完整
		* 译文，**由本插件随包提供**，任何人都不需要为了看中文以外的界面去改未必科幻
		* 的代码（这是 2026-11-07 一帆定的目标：降低了人家"顺手把 logo 去掉"的动机）。
		*
		* **覆盖范围必须说清楚**：这些译文只覆盖**未必科幻自己的页面/浮窗**。DSH 自身
		* 界面文案由 DSH 或对应的第三方语言包提供；选了日文时，未必科幻页面是日文、
		* DSH 自带界面按它自己的回落链走（通常是英文）——这不是本插件能替 DSH 决定的。
		*
		* **注册方式**（`ctx.locale`）：
		*  - 字典：`register(NS, 'ja', {…})` 单语形（语言包形态）。
		*  - 语言定义：`addLanguage({ id, label, fallback: 'en' })`——**只有定义了**，
		*    用户才能在语言列表里选到它。已存在同 id（别人装了同名语言包）时
		*    `addLanguage` 会抛，调用侧吞掉：别人的包优先，我们不抢。
		*
		* **译稿状态**：`zh`/`en` 是人工维护的源；其余 8 个语种是**初版机译稿**
		* （machine-drafted，2026-11-07），文案本身是"只讲效果、不含术语"的短句，
		* 所以直译的容错率很高；但母语润色仍然欢迎——改的就是下面这些文件。
		*
		* @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/locales-intl
		*/
		/** 随包提供的非内置语种（顺序 = 语言列表里的显示顺序）。 */
		const INTL_DICTIONARIES = [
			{
				id: "zh-TW",
				label: "繁體中文",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "本機執行設定——改完立即生效，只有標示「重新啟動後生效」的才需要重新啟動。",
					loading: "正在讀取…",
					error: "讀取失敗，請稍後再試。",
					retry: "重試",
					version: "版本",
					brain: "記憶庫",
					encoder: "語言編碼",
					sessions: "工作階段",
					seeded: "已匯入舊記憶",
					trackedSessions: "已記錄工作階段",
					globalEma: "全域平均",
					none: "無",
					compression: "壓縮",
					never: "還沒有壓縮過",
					messages: "訊息",
					compressed: "壓縮",
					preserved: "保留",
					tailFpSegments: "片段",
					textChars: "字元",
					compressions: "壓縮次數",
					emaMs: "平均耗時",
					lastMs: "最近耗時",
					compressionLine: "壓縮",
					compressionLineHint: "本工作階段累計壓縮：次數 · 摺疊條數 · 最近耗時 · 距現在多久",
					compressionJustNow: "剛剛",
					compressionMinutesAgo: "{n} 分鐘前",
					compressionHoursAgo: "{n} 小時前",
					compressionHistory: "壓縮紀錄",
					historyEmpty: "本工作階段還沒有壓縮過",
					memoryIndex: "記憶索引",
					topics: "話題",
					totalRefs: "條目",
					sessionRefs: "來自工作階段",
					fileRefs: "來自檔案",
					nestedTopics: "已合併話題",
					initialized: "已就緒",
					segments: "內容",
					segmentCount: "段數",
					totalLines: "行數",
					totalBytes: "大小",
					injection: "記憶浮現",
					calls: "判定次數",
					needInjected: "直接浮現",
					weakInjected: "部分浮現",
					injected: "浮現條數",
					injectedChars: "浮現字元",
					recall: "回想",
					needTrue: "直接浮現",
					needFalse: "部分浮現",
					expanded: "展開",
					expandedChars: "展開字元",
					growth: "記憶增長",
					gMessages: "記住的訊息",
					gDuplicate: "重複合併",
					gChainMerge: "相似合併",
					gNewTopic: "新話題",
					gShadowed: "被跳過",
					gNestEdge: "建立了關聯",
					gNestHot: "與常用話題關聯",
					gNestArch: "與歷史話題關聯",
					injectEnabled: "記憶浮現",
					injectEnabledHint: "每一步之前，依照之前聊過的內容自動帶出相關記憶。預設關閉。",
					autoCompact: "自動壓縮",
					autoCompactHint: "對話變長時，會自動把較早的部分濃縮成摘要，節省上下文。關掉之後，只有在快放不下時才會壓縮。",
					compactTailMessages: "壓縮時保留最近幾則",
					compactTailMessagesHint: "壓縮時永遠保留原文的最近訊息條數（8–256，預設 64）。這是硬底線：最近的這些訊息不會被壓進摘要，只有更早的才可能被壓。",
					dateAnchorEnabled: "日期提示",
					dateAnchorEnabledHint: "每天第一次對話時告訴模型今天是哪一天，避免它按上下文往前猜。預設開啟。",
					restartCleanupEnabled: "重新啟動時清理",
					restartCleanupEnabledHint: "按下重新啟動時順便瘦身：刪掉助手的舊輸出，再裁掉較早的對話，範圍是所有工作階段。關掉就只是重新啟動，比較快。",
					cleanupPruneTurns: "至少保留多少輪對話",
					cleanupPruneTurnsHint: "0 = 不動對話，只刪助手舊輸出。設 N 則至少保留最近 N 輪（實際通常更多）。",
					backupKeepCount: "每個工作階段保留幾份備份",
					backupKeepCountHint: "改動之前先備份，這裡設定保留幾份，方便改壞了可以還原。0 = 全部保留。",
					restartButtonVisible: "顯示「重新啟動 DSH」按鈕",
					restartButtonVisibleHint: "在本頁顯示重新啟動按鈕，用來手動釋放記憶體或載入新版本。重新啟動期間所有工作階段會短暫中斷。",
					sessionStreamKeepCount: "保留最近多少條助手輸出",
					sessionStreamKeepCountHint: "清理時留下最近的這麼多條（預設 200），方便重新啟動後還能查剛才幾輪。0 = 全刪。",
					restartDsh: "重新啟動 DSH",
					restartDshHint: "立即重新啟動。所有工作階段會短暫中斷，正在進行的回答會中斷。上面的清理如果開著，會一併執行。",
					restartSent: "已送出重新啟動請求…",
					restartFailed: "重新啟動請求失敗",
					dshHeapMb: "記憶體上限",
					dshHeapMbHint: "重新啟動時給 DSH 分配的記憶體上限。歷史太多時預設額度會撐爆導致當機。改完要重新啟動才生效。0 = 用系統預設。",
					autoReclaimEnabled: "閒置時自動節省記憶體",
					autoReclaimEnabledHint: "只在沒事做的時候，清掉可以重算的暫存資料。忙的時候清沒有用——下一次回想立刻又建回來。不會刪資料，只是清完第一次回想會稍慢。預設關閉。",
					autoReclaimThresholdPct: "節省記憶體的觸發點",
					autoReclaimThresholdPctHint: "記憶體用到這個比例就開始清理，按實際可用上限計算，所以不同安裝方式都自動適用。太低會頻繁清理，太高就要等快當機才動手。建議 60%。",
					autoReclaimNever: "還沒有觸發過",
					autoReclaimReasonEmergency: "記憶體吃緊，沒等閒置就清了",
					autoReclaimLast: "上次自動節省記憶體",
					reclaimTitle: "立即節省記憶體",
					reclaimButton: "節省記憶體",
					reclaimRunning: "正在清理…",
					reclaimHint: "清掉可以重算的暫存資料，騰出記憶體（實測約 1.3 GB，耗時約 0.1 秒）。清完第一次回想會稍慢（約 1.4 秒），之後恢復正常。不會刪任何資料。",
					reclaimFailed: "清理失敗",
					dshHeapUsed: "目前記憶體用量",
					dshHeapRestartHint: "已設 {configured}，目前實際 {live}——重新啟動後才會生效。",
					dshHeapAtLimit: "快滿了，建議調高後重新啟動",
					overridden: "已變更",
					save: "儲存",
					discard: "放棄",
					saved: "已儲存",
					saving: "儲存中…",
					unsaved: "有變更尚未儲存",
					saveFailed: "儲存失敗",
					retrySave: "重試儲存",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ 清理會刪掉所有工作階段的歷史輸出和較早的對話。刪掉的內容找不回來——摘要和記憶只留大意，不是原文。",
					cardHint: "設定儲存在 ~/.mbsf/config.json，改完立即生效。",
					trimTitle: "工作階段歷史剪裁",
					trimHintLead: "⚠ 只在重新啟動時剪裁——重新啟動時才動手，執行中完全不動。",
					trimHint: "勾選的工作階段會在重新啟動時瘦身：刪掉助手的舊輸出，再裁掉較早的對話，只留最近的。不勾就不會動它。",
					trimOn: "開",
					trimOff: "關",
					trimOffHint: "已關閉——重新啟動時不會剪裁任何工作階段。打開開關即可啟用並設定。",
					trimGlobalWins: "上面的「重新啟動時清理」已經開著，會清理所有工作階段——這裡勾了也不影響結果。要按工作階段清理，請先把上面的開關關掉。",
					trimListLoading: "正在列出工作階段…",
					trimListFailed: "讀取工作階段清單失敗",
					trimEmpty: "沒有可剪裁的工作階段",
					trimSelectAll: "全選",
					trimClearAll: "全不選",
					trimSummary: "已勾選 {n} 個工作階段 · 共 {size}",
					trimNeverTrimmed: "沒剪過",
					trimLastFreed: "釋放 {size}",
					trimRefresh: "重新整理",
					sessionIdLabel: "工作階段",
					sessionIdCopy: "複製工作階段 ID",
					sessionIdCopied: "已複製",
					sessionIdCopyFailed: "複製失敗，請手動選取",
					close: "關閉",
					floatingPanelButton: "工作階段開關",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "記憶浮現",
					sessionInjectHint: "本工作階段是否自動帶出相關記憶。沒改過就跟隨父工作階段或全域設定。",
					sessionDateAnchor: "日期提示",
					sessionDateAnchorHint: "本工作階段是否告訴模型今天是哪一天。沒改過就跟隨父工作階段或全域設定。",
					sessionAutoCompact: "自動壓縮",
					sessionAutoCompactHint: "本工作階段對話變長時是否自動濃縮成摘要。沒改過就跟隨父工作階段或全域設定；關掉後只有快放不下時才會壓縮。",
					sessionInheritedParent: "跟隨父工作階段",
					sessionInheritedGlobal: "跟隨全域設定",
					sessionInheritedHint: "目前的值是跟隨來的；點一下開關，就是給本工作階段單獨設定。",
					activityRead: "回憶中",
					activityWrite: "落位中",
					activityCompact: "壓縮中",
					activityHint: "正在進行的操作——讀＝展開 / 寫＝落位 / 壓＝歸併",
					activityIndicator: "活動動畫",
					activityIndicatorHint: "在圖示上顯示正在進行的操作：水滴繞著圖示轉圈。關閉後圖示靜止。",
					activityLabel: "活動文字",
					activityLabelHint: "在圖示旁顯示目前動作的文字。與動畫開關彼此獨立——動畫答「有沒有在動」，文字答「在動什麼」。",
					diagIdle: "閒置判定",
					diagFree: "真閒",
					diagBusy: "忙",
					diagInflight: "在途",
					diagPhase: "階段",
					diagHost: "宿主",
					diagHostNone: "無宿主探測",
					diagHistorical: "有歷史歸檔",
					diagSessionTypes: "種工作階段格式",
					diagKnowsNew: "認得新格式 ✓",
					diagUnknownNew: "✗ 不認新格式（剪裁會全部跳過）",
					timeSecondsAgo: "{n} 秒前",
					trimSearchPlaceholder: "搜尋 工作階段 ID / 工作區",
					trimFilterAll: "全部",
					trimFilterSelected: "已勾選",
					trimFilterUnselected: "未勾選",
					trimSortMtime: "最近活動",
					trimSortCreated: "建立時間",
					trimSortSize: "大小",
					trimSortPath: "工作區",
					trimSortToggle: "切換正序／倒序",
					trimNoMatch: "沒有符合篩選條件的工作階段",
					trimViewSummary: "顯示 {shown} / 共 {total} 筆",
					trimCopyId: "複製工作階段 ID",
					trimScopeNote: "勾選只影響列出的工作階段——搜尋或篩選後不會動到看不見的",
					trimTabSessions: "工作階段",
					trimTabDeleted: "已刪除",
					trimGroupByLabel: "分組方式",
					trimGroupWorkspace: "依工作區",
					trimGroupTree: "依工作區樹",
					trimGroupFlat: "單一清單",
					trimScopeLabel: "工作階段類型",
					trimScopeAll: "全部",
					trimScopeMain: "僅主工作階段",
					trimScopeSubagent: "僅子代理",
					trimArchiveLabel: "已封存",
					trimArchiveHide: "隱藏已封存",
					trimArchiveShow: "全部對話（顯示已封存）",
					trimArchiveOnly: "僅顯示已封存",
					trimBadgeArchived: "已封存",
					trimBadgeRootArchived: "隨父封存",
					trimBadgeOrphan: "孤兒",
					trimBadgeRootArchivedHint: "它屬於一個已封存的主工作階段（封存不會帶上子代理，所以自己的封存位沒變）",
					trimBadgeSubagent: "子代理",
					trimGroupCount: "{n} 個工作階段 · 已勾選 {selected}",
					trimDelete: "刪除工作階段",
					trimDeleteBlockedActive: "使用中的工作階段不能刪除——請先在 DSH 中封存它",
					trimDeleteBlockedLive: "執行中，無法刪除",
					trimDeleteBlockedParent: "主工作階段還沒封存——先封存主工作階段，它的子代理才能刪",
					trimDeleteConfirmTitle: "刪除此工作階段？",
					trimDeleteConfirmBody: "「{title}」會移到資源回收筒，{days} 天內可以復原；到期後自動永久清除。",
					trimDeleteChildren: "它名下的 {n} 個子代理工作階段會一起刪除（復原時一起回來）。",
					trimDeleteConfirmOk: "移到回收筒",
					trimDeleteCancel: "取消",
					trimDeleteDone: "已移到回收筒：{n} 個工作階段，{days} 天內可復原",
					trimDeleteFailed: "刪除失敗：{detail}",
					trimDeletedEmpty: "回收筒是空的",
					trimDeletedHint: "刪除的工作階段保留 {days} 天。開啟這個清單時，到期的會自動永久清除。",
					trimDeletedAt: "刪除於 {date}",
					trimDeletedRemaining: "還剩 {n} 天",
					trimDeletedRestore: "復原",
					trimRestoreDone: "已復原 {n} 個工作階段",
					trimRestoreFailed: "復原失敗：{detail}",
					trimDeletedPurged: "已永久清除 {n} 項（超過 {days} 天）"
				}
			},
			{
				id: "ja",
				label: "日本語",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "ローカル実行の設定です。変更はすぐに反映され、「再起動後に反映」と書かれた項目だけ再起動が必要です。",
					loading: "読み込み中…",
					error: "読み込めませんでした。しばらくしてからもう一度お試しください。",
					retry: "再試行",
					version: "バージョン",
					brain: "記憶ストア",
					encoder: "言語エンコード",
					sessions: "セッション",
					seeded: "過去の記憶をインポート済み",
					trackedSessions: "記録済みセッション",
					globalEma: "全体平均",
					none: "なし",
					compression: "圧縮",
					never: "まだ圧縮していません",
					messages: "メッセージ",
					compressed: "圧縮",
					preserved: "保持",
					tailFpSegments: "断片",
					textChars: "文字数",
					compressions: "圧縮回数",
					emaMs: "平均所要時間",
					lastMs: "前回の所要時間",
					compressionLine: "圧縮",
					compressionLineHint: "このセッションの累計圧縮：回数 · 折りたたんだ件数 · 前回の所要時間 · 経過時間",
					compressionJustNow: "たった今",
					compressionMinutesAgo: "{n}分前",
					compressionHoursAgo: "{n}時間前",
					compressionHistory: "圧縮履歴",
					historyEmpty: "このセッションはまだ圧縮していません",
					memoryIndex: "記憶インデックス",
					topics: "トピック",
					totalRefs: "項目",
					sessionRefs: "セッション由来",
					fileRefs: "ファイル由来",
					nestedTopics: "統合済みトピック",
					initialized: "準備完了",
					segments: "内容",
					segmentCount: "セグメント数",
					totalLines: "行数",
					totalBytes: "サイズ",
					injection: "記憶の呼び出し",
					calls: "判定回数",
					needInjected: "直接呼び出し",
					weakInjected: "一部呼び出し",
					injected: "呼び出し件数",
					injectedChars: "呼び出し文字数",
					recall: "検索",
					needTrue: "直接呼び出し",
					needFalse: "一部呼び出し",
					expanded: "展開",
					expandedChars: "展開文字数",
					growth: "記憶の増加",
					gMessages: "記憶したメッセージ",
					gDuplicate: "重複を統合",
					gChainMerge: "類似を統合",
					gNewTopic: "新しいトピック",
					gShadowed: "スキップ",
					gNestEdge: "関連を追加",
					gNestHot: "よく使うトピックと関連付け",
					gNestArch: "過去のトピックと関連付け",
					injectEnabled: "記憶の呼び出し",
					injectEnabledHint: "各ステップの前に、これまで話した内容に関連する記憶を自動で呼び出します。初期値はオフ。",
					autoCompact: "自動圧縮",
					autoCompactHint: "会話が長くなると、古い部分を要約して文脈を節約します。オフにすると、空きが尽きそうなときだけ圧縮します。",
					compactTailMessages: "直近のメッセージを保持",
					compactTailMessagesHint: "圧縮時に原文のまま必ず残す直近メッセージ数（8–256、既定 64）。厳格な下限：直近のメッセージは要約に畳み込まれず、より古いものだけが圧縮対象になります。",
					dateAnchorEnabled: "日付の通知",
					dateAnchorEnabledHint: "毎日最初のやり取りで、今日が何日かをモデルに伝えます。文脈から推測させないためです。初期値はオン。",
					restartCleanupEnabled: "再起動時のクリーンアップ",
					restartCleanupEnabledHint: "再起動のついでに整理します。アシスタントの古い出力を削除し、古い会話も切り詰めます。対象はすべてのセッションです。オフなら再起動だけになり、そのほうが速くなります。",
					cleanupPruneTurns: "残す会話のターン数",
					cleanupPruneTurnsHint: "0 = 会話はそのまま、アシスタントの古い出力だけ削除します。N を指定すると直近 N ターン以上を残します（実際はそれより多くなります）。",
					backupKeepCount: "セッションごとに残すバックアップ数",
					backupKeepCountHint: "変更の前にバックアップを取ります。ここで残す数を決めておくと、失敗したときに戻せます。0 = すべて残します。",
					restartButtonVisible: "「DSH を再起動」ボタンを表示",
					restartButtonVisibleHint: "このページに再起動ボタンを表示します。手動でメモリを解放したり、新しいバージョンを読み込んだりするときに使います。再起動中はすべてのセッションが一時的に切断されます。",
					sessionStreamKeepCount: "残すアシスタント出力の件数",
					sessionStreamKeepCountHint: "クリーンアップ時に残す直近の件数です（初期値 200）。再起動後に直前の数ターンを確認できます。0 = すべて削除します。",
					restartDsh: "DSH を再起動",
					restartDshHint: "すぐに再起動します。すべてのセッションが一時的に切断され、進行中の回答は中断されます。上のクリーンアップがオンの場合はそれも実行されます。",
					restartSent: "再起動を要求しました…",
					restartFailed: "再起動の要求に失敗しました",
					dshHeapMb: "メモリ上限",
					dshHeapMbHint: "再起動後に DSH が使えるメモリの上限です。履歴が多すぎると初期値では足りずにクラッシュします。変更は再起動後に反映されます。0 = システムの初期値。",
					autoReclaimEnabled: "アイドル時にメモリを解放",
					autoReclaimEnabledHint: "何も動いていないときだけ、再計算できる一時データを捨てます。動作中に消しても意味がありません。次の呼び出しですぐ作り直されるためです。データは削除されず、直後の一度だけ呼び出しが少し遅くなります。初期値はオフ。",
					autoReclaimThresholdPct: "メモリ解放の開始位置",
					autoReclaimThresholdPctHint: "実際に使える上限に対してこの割合に達したら片付けを始めます。どの構成でも自動的に合う値になります。低すぎると頻繁に片付け、高すぎるとクラッシュ寸前まで動きません。60% がおすすめです。",
					autoReclaimNever: "まだ実行されていません",
					autoReclaimReasonEmergency: "メモリが逼迫したため、アイドルを待たずに解放しました",
					autoReclaimLast: "前回の自動解放",
					reclaimTitle: "今すぐメモリを解放",
					reclaimButton: "メモリを解放",
					reclaimRunning: "片付けています…",
					reclaimHint: "再計算できる一時データを捨ててメモリを空けます（実測で約 1.3 GB、所要約 0.1 秒）。直後の一度だけ呼び出しが少し遅くなり（約 1.4 秒）、その後は元に戻ります。データは何も削除しません。",
					reclaimFailed: "片付けに失敗しました",
					dshHeapUsed: "現在のメモリ使用量",
					dshHeapRestartHint: "{configured} に設定済み、現在の実際値は {live} です。再起動後に反映されます。",
					dshHeapAtLimit: "ほぼ上限です。上限を上げて再起動してください",
					overridden: "変更済み",
					save: "保存",
					discard: "破棄",
					saved: "保存しました",
					saving: "保存中…",
					unsaved: "未保存の変更があります",
					saveFailed: "保存に失敗しました",
					retrySave: "保存を再試行",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ クリーンアップすると、すべてのセッションの履歴出力と古い会話が削除されます。削除した内容は元に戻せません。要約と記憶には要点だけが残り、原文は残りません。",
					cardHint: "設定は ~/.mbsf/config.json に保存され、変更はすぐに反映されます。",
					trimTitle: "会話履歴の切り詰め",
					trimHintLead: "⚠ 再起動時のみ — 実行中は何も変わらず、再起動時にのみ剪定します。",
					trimHint: "チェックしたセッションは再起動時に整理されます。アシスタントの古い出力を削除し、古い会話を切り詰めて直近の分だけ残します。チェックしていないセッションはそのままです。",
					trimOn: "オン",
					trimOff: "オフ",
					trimOffHint: "オフ — 再起動時に会話は切り詰められません。オンにすると有効になり設定できます。",
					trimGlobalWins: "上の「再起動時のクリーンアップ」がオンなので、すべてのセッションが対象になります。ここでチェックしても結果は変わりません。セッションごとに整理するには、まず上のスイッチをオフにしてください。",
					trimListLoading: "セッションを一覧しています…",
					trimListFailed: "セッション一覧を読み込めませんでした",
					trimEmpty: "切り詰められるセッションはありません",
					trimSelectAll: "すべて選択",
					trimClearAll: "すべて解除",
					trimSummary: "{n}件のセッションを選択 · 合計 {size}",
					trimNeverTrimmed: "未実行",
					trimLastFreed: "{size} を解放",
					trimRefresh: "更新",
					sessionIdLabel: "セッション",
					sessionIdCopy: "セッション ID をコピー",
					sessionIdCopied: "コピーしました",
					sessionIdCopyFailed: "コピーできませんでした。手動で選択してください",
					close: "閉じる",
					floatingPanelButton: "セッションスイッチ",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "記憶の呼び出し",
					sessionInjectHint: "このセッションで関連する記憶を自動で呼び出すかどうか。未変更の場合は親セッションまたは全体設定に従います。",
					sessionDateAnchor: "日付の通知",
					sessionDateAnchorHint: "このセッションで今日が何日かをモデルに伝えるかどうか。未変更の場合は親セッションまたは全体設定に従います。",
					sessionAutoCompact: "自動圧縮",
					sessionAutoCompactHint: "このセッションで会話が長くなったとき自動で要約するかどうか。未変更の場合は親セッションまたは全体設定に従います。オフにすると、空きが尽きそうなときだけ圧縮します。",
					sessionInheritedParent: "親セッションに従う",
					sessionInheritedGlobal: "全体設定に従う",
					sessionInheritedHint: "現在は他の設定から引き継いだ値です。スイッチを切り替えると、このセッションだけに設定されます。",
					activityRead: "想起中",
					activityWrite: "書き込み中",
					activityCompact: "圧縮中",
					activityHint: "実行中の操作——読み取り＝展開／書き込み＝記録／圧縮＝統合",
					activityIndicator: "動作アニメーション",
					activityIndicatorHint: "実行中の操作を、アイコンの周りを回る水滴で表示します。オフにするとアイコンは静止します。",
					activityLabel: "動作の文字表示",
					activityLabelHint: "実行中の操作をアイコンの横に文字で表示します。アニメーションのスイッチとは独立で、アニメーションは「動いているか」、文字は「何をしているか」を表します。",
					diagIdle: "アイドル判定",
					diagFree: "アイドル",
					diagBusy: "ビジー",
					diagInflight: "実行中",
					diagPhase: "フェーズ",
					diagHost: "ホスト",
					diagHostNone: "ホスト検出なし",
					diagHistorical: "アーカイブ履歴あり",
					diagSessionTypes: "種のセッション形式",
					diagKnowsNew: "新しい形式を認識 ✓",
					diagUnknownNew: "✗ 新しい形式を認識せず（切り詰めはすべてスキップ）",
					timeSecondsAgo: "{n} 秒前",
					trimSearchPlaceholder: "セッション ID / ワークスペースを検索",
					trimFilterAll: "すべて",
					trimFilterSelected: "選択済み",
					trimFilterUnselected: "未選択",
					trimSortMtime: "最終使用",
					trimSortCreated: "作成日時",
					trimSortSize: "サイズ",
					trimSortPath: "ワークスペース",
					trimSortToggle: "昇順／降順を切り替え",
					trimNoMatch: "条件に合うセッションはありません",
					trimViewSummary: "{total} 件中 {shown} 件を表示",
					trimCopyId: "セッション ID をコピー",
					trimScopeNote: "選択は一覧に表示されているセッションだけに適用されます",
					trimTabSessions: "会話",
					trimTabDeleted: "削除済み",
					trimGroupByLabel: "グループ化",
					trimGroupWorkspace: "ワークスペース別",
					trimGroupTree: "ワークスペースツリー",
					trimGroupFlat: "ひとつのリスト",
					trimScopeLabel: "会話の種類",
					trimScopeAll: "すべて",
					trimScopeMain: "メインのみ",
					trimScopeSubagent: "サブエージェントのみ",
					trimArchiveLabel: "アーカイブ",
					trimArchiveHide: "アーカイブを非表示",
					trimArchiveShow: "すべての会話（アーカイブを表示）",
					trimArchiveOnly: "アーカイブのみ",
					trimBadgeArchived: "アーカイブ",
					trimBadgeRootArchived: "親と共にアーカイブ",
					trimBadgeOrphan: "孤児",
					trimBadgeRootArchivedHint: "アーカイブ済みのメイン会話に属しています（アーカイブは子エージェントに及びません）",
					trimBadgeSubagent: "サブエージェント",
					trimGroupCount: "{n} 件 · 選択 {selected}",
					trimDelete: "会話を削除",
					trimDeleteBlockedActive: "使用中の会話は削除できません。先に DSH でアーカイブしてください",
					trimDeleteBlockedLive: "実行中のため削除できません",
					trimDeleteBlockedParent: "メイン会話がまだアーカイブされていません。先にアーカイブしてください",
					trimDeleteConfirmTitle: "この会話を削除しますか？",
					trimDeleteConfirmBody: "「{title}」はゴミ箱に移され、{days} 日間は復元できます。期限を過ぎると自動的に完全削除されます。",
					trimDeleteChildren: "この会話の {n} 件のサブエージェント会話も一緒に削除されます（復元時はまとめて戻ります）。",
					trimDeleteConfirmOk: "ゴミ箱へ移動",
					trimDeleteCancel: "キャンセル",
					trimDeleteDone: "ゴミ箱に移動しました：{n} 件、{days} 日間は復元できます",
					trimDeleteFailed: "削除できませんでした：{detail}",
					trimDeletedEmpty: "ゴミ箱は空です",
					trimDeletedHint: "削除した会話は {days} 日間保持されます。この一覧を開くと期限切れが自動で完全削除されます。",
					trimDeletedAt: "{date} に削除",
					trimDeletedRemaining: "残り {n} 日",
					trimDeletedRestore: "復元",
					trimRestoreDone: "{n} 件を復元しました",
					trimRestoreFailed: "復元できませんでした：{detail}",
					trimDeletedPurged: "{days} 日を過ぎた {n} 件を完全削除しました"
				}
			},
			{
				id: "ko",
				label: "한국어",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "로컬 실행 설정 — 변경하면 바로 적용되고, \"다시 시작 후 적용\"이라고 표시된 항목만 다시 시작이 필요합니다.",
					loading: "읽는 중…",
					error: "상태를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
					retry: "다시 시도",
					version: "버전",
					brain: "기억 저장소",
					encoder: "언어 인코딩",
					sessions: "세션",
					seeded: "이전 기억 가져옴",
					trackedSessions: "기록된 세션",
					globalEma: "전체 평균",
					none: "없음",
					compression: "압축",
					never: "아직 압축한 적 없음",
					messages: "메시지",
					compressed: "압축됨",
					preserved: "보존됨",
					tailFpSegments: "조각",
					textChars: "문자",
					compressions: "압축 횟수",
					emaMs: "평균 소요 시간",
					lastMs: "최근 소요 시간",
					compressionLine: "압축",
					compressionLineHint: "이 세션의 누적 압축: 횟수 · 접힌 메시지 수 · 최근 소요 시간 · 경과 시간",
					compressionJustNow: "방금",
					compressionMinutesAgo: "{n}분 전",
					compressionHoursAgo: "{n}시간 전",
					compressionHistory: "압축 기록",
					historyEmpty: "이 세션은 아직 압축한 적이 없습니다",
					memoryIndex: "기억 색인",
					topics: "주제",
					totalRefs: "항목",
					sessionRefs: "세션에서",
					fileRefs: "파일에서",
					nestedTopics: "병합된 주제",
					initialized: "준비됨",
					segments: "내용",
					segmentCount: "구간 수",
					totalLines: "줄 수",
					totalBytes: "크기",
					injection: "기억 소환",
					calls: "판정 횟수",
					needInjected: "바로 소환",
					weakInjected: "부분 소환",
					injected: "소환된 항목",
					injectedChars: "소환된 문자",
					recall: "조회",
					needTrue: "바로 소환",
					needFalse: "부분 소환",
					expanded: "펼침",
					expandedChars: "펼친 문자",
					growth: "기억 성장",
					gMessages: "기억한 메시지",
					gDuplicate: "중복 병합",
					gChainMerge: "유사 항목 병합",
					gNewTopic: "새 주제",
					gShadowed: "건너뜀",
					gNestEdge: "연결 생성",
					gNestHot: "자주 쓰는 주제와 연결",
					gNestArch: "지난 주제와 연결",
					injectEnabled: "기억 소환",
					injectEnabledHint: "매 단계 전에 앞서 나눈 대화와 관련된 기억을 자동으로 불러옵니다. 기본값은 꺼짐입니다.",
					autoCompact: "자동 압축",
					autoCompactHint: "대화가 길어지면 이전 부분을 요약해 문맥을 절약합니다. 끄면 공간이 거의 다 찰 때만 압축합니다.",
					compactTailMessages: "최근 메시지 유지",
					compactTailMessagesHint: "압축 시 원문 그대로 항상 유지할 최근 메시지 수(8–256, 기본 12). 엄격한 하한: 최근 메시지는 요약으로 접히지 않고 더 오래된 것만 압축됩니다.",
					dateAnchorEnabled: "오늘 날짜",
					dateAnchorEnabledHint: "매일 첫 대화에서 모델에게 오늘 날짜를 알려 주어 문맥으로 추측하지 않게 합니다. 기본값은 켜짐입니다.",
					restartCleanupEnabled: "다시 시작 시 정리",
					restartCleanupEnabledHint: "다시 시작할 때 함께 가볍게 만듭니다. 모든 세션에서 어시스턴트의 이전 출력을 지우고 오래된 대화를 잘라냅니다. 끄면 다시 시작만 하므로 더 빠릅니다.",
					cleanupPruneTurns: "남길 대화 턴 수",
					cleanupPruneTurnsHint: "0 = 대화는 그대로 두고 어시스턴트의 이전 출력만 지웁니다. N으로 설정하면 최근 N턴을 최소한 남깁니다(보통은 그보다 더 남습니다).",
					backupKeepCount: "세션당 보관할 백업 수",
					backupKeepCountHint: "변경하기 전에 백업하며, 여기서 보관할 개수를 정합니다. 잘못됐을 때 되돌리기 위한 것입니다. 0 = 모두 보관.",
					restartButtonVisible: "\"DSH 다시 시작\" 버튼 표시",
					restartButtonVisibleHint: "이 페이지에 다시 시작 버튼을 표시해 메모리를 직접 확보하거나 새 버전을 불러올 수 있습니다. 다시 시작하는 동안 모든 세션이 잠시 끊깁니다.",
					sessionStreamKeepCount: "보관할 어시스턴트 출력 수",
					sessionStreamKeepCountHint: "정리할 때 최근 항목을 몇 개까지 남길지 정합니다(기본 200). 다시 시작한 뒤에도 최근 몇 턴을 확인할 수 있습니다. 0 = 모두 삭제.",
					restartDsh: "DSH 다시 시작",
					restartDshHint: "지금 다시 시작합니다. 모든 세션이 잠시 끊기고 진행 중인 답변은 중단됩니다. 위의 정리가 켜져 있으면 함께 실행됩니다.",
					restartSent: "다시 시작을 요청했습니다…",
					restartFailed: "다시 시작 요청 실패",
					dshHeapMb: "메모리 상한",
					dshHeapMbHint: "다시 시작할 때 DSH에 허용할 메모리 상한입니다. 기록이 많으면 기본값으로는 부족해 프로세스가 종료될 수 있습니다. 다시 시작해야 적용됩니다. 0 = 시스템 기본값.",
					autoReclaimEnabled: "유휴 시 메모리 확보",
					autoReclaimEnabledHint: "아무 작업도 없을 때만 다시 계산할 수 있는 임시 데이터를 지웁니다. 작업 중에 지우면 다음 조회에서 곧바로 다시 만들어지므로 소용이 없습니다. 데이터는 삭제되지 않고, 이후 첫 조회만 조금 느립니다. 기본값은 꺼짐입니다.",
					autoReclaimThresholdPct: "메모리 확보 시작 지점",
					autoReclaimThresholdPctHint: "실제 사용 가능한 메모리를 기준으로 이 비율에 이르면 정리를 시작하므로 어떤 설치 방식에서도 알아서 맞춰집니다. 너무 낮으면 자주 정리하고, 너무 높으면 거의 넘칠 때에야 정리합니다. 60%를 권합니다.",
					autoReclaimNever: "아직 실행된 적 없음",
					autoReclaimReasonEmergency: "메모리가 빠듯해 유휴를 기다리지 않고 정리했습니다",
					autoReclaimLast: "마지막 자동 메모리 확보",
					reclaimTitle: "지금 메모리 확보",
					reclaimButton: "메모리 확보",
					reclaimRunning: "정리 중…",
					reclaimHint: "다시 계산할 수 있는 임시 데이터를 지워 메모리를 확보합니다(약 1.3 GB, 약 0.1초). 이후 첫 조회는 조금 느리고(약 1.4초), 그다음부터는 정상입니다. 데이터는 삭제되지 않습니다.",
					reclaimFailed: "정리 실패",
					dshHeapUsed: "현재 메모리 사용량",
					dshHeapRestartHint: "{configured}로 설정되어 있고 현재 실제값은 {live}입니다 — 다시 시작해야 적용됩니다.",
					dshHeapAtLimit: "거의 가득 찼습니다 — 상한을 올린 뒤 다시 시작하세요",
					overridden: "변경됨",
					save: "저장",
					discard: "되돌리기",
					saved: "저장됨",
					saving: "저장 중…",
					unsaved: "저장하지 않은 변경 있음",
					saveFailed: "저장 실패",
					retrySave: "저장 다시 시도",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ 정리하면 모든 세션의 이전 출력과 오래된 대화가 삭제됩니다. 삭제된 내용은 되찾을 수 없습니다 — 요약과 기억에는 원문이 아니라 요지만 남습니다.",
					cardHint: "설정은 ~/.mbsf/config.json에 저장되며 변경하면 바로 적용됩니다.",
					trimTitle: "대화 기록 다듬기",
					trimHintLead: "⚠ 다시 시작할 때만 — 실행 중에는 아무것도 바뀌지 않고 다시 시작할 때만 정리합니다.",
					trimHint: "체크한 세션은 다시 시작할 때 가볍게 만들어집니다. 어시스턴트의 이전 출력을 지우고 오래된 대화를 잘라 최근 것만 남깁니다. 체크하지 않은 세션은 그대로 둡니다.",
					trimOn: "켬",
					trimOff: "끔",
					trimOffHint: "꺼짐 — 다시 시작할 때 대화가 잘리지 않습니다. 켜면 활성화되고 설정할 수 있습니다.",
					trimGlobalWins: "위의 \"다시 시작 시 정리\"가 켜져 있어 모든 세션이 정리됩니다 — 여기서 체크해도 결과는 달라지지 않습니다. 세션별로 정리하려면 먼저 위 스위치를 끄세요.",
					trimListLoading: "세션 목록을 불러오는 중…",
					trimListFailed: "세션 목록을 읽지 못했습니다",
					trimEmpty: "다듬을 세션이 없습니다",
					trimSelectAll: "모두 선택",
					trimClearAll: "모두 해제",
					trimSummary: "세션 {n}개 선택 · 총 {size}",
					trimNeverTrimmed: "없음",
					trimLastFreed: "{size} 확보",
					trimRefresh: "새로 고침",
					sessionIdLabel: "세션",
					sessionIdCopy: "세션 ID 복사",
					sessionIdCopied: "복사됨",
					sessionIdCopyFailed: "복사하지 못했습니다 — 직접 선택해 주세요",
					close: "닫기",
					floatingPanelButton: "세션 스위치",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "기억 소환",
					sessionInjectHint: "이 세션에서 관련 기억을 자동으로 불러올지 정합니다. 변경하지 않으면 상위 세션이나 전역 설정을 따릅니다.",
					sessionDateAnchor: "오늘 날짜",
					sessionDateAnchorHint: "이 세션에서 모델에게 오늘 날짜를 알려 줄지 정합니다. 변경하지 않으면 상위 세션이나 전역 설정을 따릅니다.",
					sessionAutoCompact: "자동 압축",
					sessionAutoCompactHint: "이 세션에서 대화가 길어지면 자동으로 요약할지 정합니다. 변경하지 않으면 상위 세션이나 전역 설정을 따르며, 끄면 공간이 거의 다 찰 때만 압축합니다.",
					sessionInheritedParent: "상위 세션 따름",
					sessionInheritedGlobal: "전역 설정 따름",
					sessionInheritedHint: "현재 값은 다른 곳에서 온 것입니다. 스위치를 누르면 이 세션에만 따로 설정됩니다.",
					activityRead: "회상 중",
					activityWrite: "기록 중",
					activityCompact: "압축하는 중",
					activityHint: "지금 진행 중인 작업 — 읽기, 쓰기, 압축",
					activityIndicator: "활동 애니메이션",
					activityIndicatorHint: "아이콘 위에 진행 중인 작업을 표시합니다. 아이콘 주위를 물방울이 돕니다. 끄면 아이콘이 멈춰 있습니다.",
					activityLabel: "활동 텍스트",
					activityLabelHint: "아이콘 옆에 현재 동작을 글로 표시합니다. 애니메이션과는 별개이며, 애니메이션은 움직이는지 여부를, 글은 무엇을 하는지를 알려 줍니다.",
					diagIdle: "대기 판정",
					diagFree: "유휴",
					diagBusy: "사용 중",
					diagInflight: "진행 중",
					diagPhase: "단계",
					diagHost: "호스트",
					diagHostNone: "호스트 감지 없음",
					diagHistorical: "보관 기록 있음",
					diagSessionTypes: "가지 세션 형식",
					diagKnowsNew: "새 형식 인식 ✓",
					diagUnknownNew: "✗ 새 형식을 모름(다듬기는 모두 건너뜀)",
					timeSecondsAgo: "{n}초 전",
					trimSearchPlaceholder: "세션 ID / 작업 공간 검색",
					trimFilterAll: "전체",
					trimFilterSelected: "선택됨",
					trimFilterUnselected: "선택 안 됨",
					trimSortMtime: "최근 사용",
					trimSortCreated: "생성 시각",
					trimSortSize: "크기",
					trimSortPath: "작업 공간",
					trimSortToggle: "오름차순/내림차순 전환",
					trimNoMatch: "조건에 맞는 세션이 없습니다",
					trimViewSummary: "전체 {total}개 중 {shown}개 표시",
					trimCopyId: "세션 ID 복사",
					trimScopeNote: "선택은 목록에 표시된 세션에만 적용됩니다",
					trimTabSessions: "대화",
					trimTabDeleted: "삭제됨",
					trimGroupByLabel: "그룹화",
					trimGroupWorkspace: "워크스페이스별",
					trimGroupTree: "워크스페이스 트리",
					trimGroupFlat: "하나의 목록",
					trimScopeLabel: "대화 유형",
					trimScopeAll: "전체",
					trimScopeMain: "메인만",
					trimScopeSubagent: "서브에이전트만",
					trimArchiveLabel: "보관",
					trimArchiveHide: "보관된 항목 숨기기",
					trimArchiveShow: "모든 대화(보관 포함)",
					trimArchiveOnly: "보관된 항목만",
					trimBadgeArchived: "보관됨",
					trimBadgeRootArchived: "상위와 함께 보관됨",
					trimBadgeOrphan: "고아",
					trimBadgeRootArchivedHint: "보관된 메인 대화에 속합니다(보관은 하위 에이전트에 적용되지 않습니다)",
					trimBadgeSubagent: "서브에이전트",
					trimGroupCount: "대화 {n}개 · 선택 {selected}",
					trimDelete: "대화 삭제",
					trimDeleteBlockedActive: "활성 대화는 삭제할 수 없습니다. 먼저 DSH에서 보관하세요",
					trimDeleteBlockedLive: "실행 중이라 삭제할 수 없습니다",
					trimDeleteBlockedParent: "메인 대화가 아직 보관되지 않았습니다. 먼저 보관하세요",
					trimDeleteConfirmTitle: "이 대화를 삭제할까요?",
					trimDeleteConfirmBody: "“{title}”이(가) 휴지통으로 이동하며 {days}일 동안 복원할 수 있습니다. 기간이 지나면 자동으로 완전 삭제됩니다.",
					trimDeleteChildren: "이 대화의 서브에이전트 대화 {n}개도 함께 삭제됩니다(복원 시 함께 돌아옵니다).",
					trimDeleteConfirmOk: "휴지통으로 이동",
					trimDeleteCancel: "취소",
					trimDeleteDone: "휴지통으로 이동했습니다: 대화 {n}개, {days}일 동안 복원 가능",
					trimDeleteFailed: "삭제하지 못했습니다: {detail}",
					trimDeletedEmpty: "휴지통이 비어 있습니다",
					trimDeletedHint: "삭제한 대화는 {days}일 동안 보관됩니다. 이 목록을 열면 만료된 항목이 자동으로 완전 삭제됩니다.",
					trimDeletedAt: "{date}에 삭제",
					trimDeletedRemaining: "{n}일 남음",
					trimDeletedRestore: "복원",
					trimRestoreDone: "대화 {n}개를 복원했습니다",
					trimRestoreFailed: "복원하지 못했습니다: {detail}",
					trimDeletedPurged: "{days}일이 지난 {n}개를 완전 삭제했습니다"
				}
			},
			{
				id: "de",
				label: "Deutsch",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "Lokale Laufzeiteinstellungen — Änderungen wirken sofort; nur die mit „nach Neustart“ markierten brauchen einen Neustart.",
					loading: "Wird gelesen…",
					error: "Der Status konnte nicht gelesen werden. Bitte später erneut versuchen.",
					retry: "Erneut versuchen",
					version: "Version",
					brain: "Gedächtnisspeicher",
					encoder: "Sprachkodierung",
					sessions: "Sitzungen",
					seeded: "Alte Erinnerungen importiert",
					trackedSessions: "Erfasste Sitzungen",
					globalEma: "Gesamtdurchschnitt",
					none: "Keine",
					compression: "Komprimierung",
					never: "Noch nicht komprimiert",
					messages: "Nachrichten",
					compressed: "Komprimiert",
					preserved: "Behalten",
					tailFpSegments: "Fragmente",
					textChars: "Zeichen",
					compressions: "Komprimierungen",
					emaMs: "Durchschnittliche Dauer",
					lastMs: "Letzte Dauer",
					compressionLine: "Komprimierung",
					compressionLineHint: "Bisherige Komprimierungen in dieser Sitzung: Anzahl · zusammengefasste Nachrichten · letzte Dauer · vor wie langer Zeit",
					compressionJustNow: "gerade eben",
					compressionMinutesAgo: "vor {n} Minuten",
					compressionHoursAgo: "vor {n} Stunden",
					compressionHistory: "Komprimierungsverlauf",
					historyEmpty: "Diese Sitzung wurde noch nicht komprimiert",
					memoryIndex: "Gedächtnisindex",
					topics: "Themen",
					totalRefs: "Einträge",
					sessionRefs: "Aus Sitzungen",
					fileRefs: "Aus Dateien",
					nestedTopics: "Zusammengeführte Themen",
					initialized: "Bereit",
					segments: "Inhalt",
					segmentCount: "Segmente",
					totalLines: "Zeilen",
					totalBytes: "Größe",
					injection: "Erinnerungsabruf",
					calls: "Prüfungen",
					needInjected: "Direkt erinnert",
					weakInjected: "Teilweise erinnert",
					injected: "Erinnerte Einträge",
					injectedChars: "Erinnerte Zeichen",
					recall: "Nachschlagen",
					needTrue: "Direkt erinnert",
					needFalse: "Teilweise erinnert",
					expanded: "Erweiterungen",
					expandedChars: "Erweiterte Zeichen",
					growth: "Gedächtniswachstum",
					gMessages: "Erinnerte Nachrichten",
					gDuplicate: "Duplikate zusammengeführt",
					gChainMerge: "Ähnliche zusammengeführt",
					gNewTopic: "Neue Themen",
					gShadowed: "Übersprungen",
					gNestEdge: "Verknüpfungen erstellt",
					gNestHot: "Mit häufigen Themen verknüpft",
					gNestArch: "Mit früheren Themen verknüpft",
					injectEnabled: "Erinnerungsabruf",
					injectEnabledHint: "Vor jedem Schritt werden automatisch Erinnerungen zum bisher Gesagten herangezogen. Standardmäßig aus.",
					autoCompact: "Automatische Komprimierung",
					autoCompactHint: "Wird das Gespräch lang, werden frühere Teile zusammengefasst, um Kontext zu sparen. Ausgeschaltet wird erst komprimiert, wenn der Platz knapp wird.",
					compactTailMessages: "Neueste Nachrichten behalten",
					compactTailMessagesHint: "Wie viele der neuesten Nachrichten immer als Originaltext bleiben (8–256, Standard 12). Eine harte Untergrenze: die neuesten Nachrichten werden nie in die Zusammenfassung gefaltet, nur ältere können verdichtet werden.",
					dateAnchorEnabled: "Heutiges Datum",
					dateAnchorEnabledHint: "Beim ersten Austausch eines Tages wird dem Modell das Datum mitgeteilt, damit es nicht aus dem Kontext rät. Standardmäßig an.",
					restartCleanupEnabled: "Beim Neustart aufräumen",
					restartCleanupEnabledHint: "Beim Neustart wird zusätzlich ausgedünnt: alte Ausgaben des Assistenten entfallen und ältere Gesprächsteile werden gekürzt, in allen Sitzungen. Ausgeschaltet wird nur neu gestartet — das geht schneller.",
					cleanupPruneTurns: "Aufzubewahrende Gesprächsrunden",
					cleanupPruneTurnsHint: "0 = Gespräche bleiben unangetastet, nur alte Ausgaben des Assistenten entfallen. Bei N bleiben mindestens die letzten N Runden erhalten (meist mehr).",
					backupKeepCount: "Aufbewahrte Sicherungen pro Sitzung",
					backupKeepCountHint: "Vor jeder Änderung wird eine Sicherung angelegt; hier legen Sie fest, wie viele aufbewahrt werden, um bei Bedarf zurückzurollen. 0 = alle behalten.",
					restartButtonVisible: "Schaltfläche „DSH neu starten“ anzeigen",
					restartButtonVisibleHint: "Zeigt auf dieser Seite eine Schaltfläche zum Neustart, um Speicher von Hand freizugeben oder eine neue Version zu laden. Alle Sitzungen trennen sich dabei kurz.",
					sessionStreamKeepCount: "Aufzubewahrende Ausgaben des Assistenten",
					sessionStreamKeepCountHint: "Wie viele der jüngsten Einträge beim Aufräumen bleiben (Standard 200), damit Sie die letzten Runden noch nachsehen können. 0 = alle entfernen.",
					restartDsh: "DSH neu starten",
					restartDshHint: "Startet sofort neu. Alle Sitzungen trennen sich kurz, laufende Antworten werden unterbrochen. Das Aufräumen oben wird, wenn eingeschaltet, mit ausgeführt.",
					restartSent: "Neustart angefordert…",
					restartFailed: "Neustart-Anforderung fehlgeschlagen",
					dshHeapMb: "Speicherobergrenze",
					dshHeapMbHint: "Wie viel Speicher DSH nach einem Neustart nutzen darf. Bei langen Verläufen reicht der Standard nicht und der Prozess stürzt ab. Wirkt erst nach einem Neustart. 0 = Systemstandard.",
					autoReclaimEnabled: "Bei Leerlauf Speicher freigeben",
					autoReclaimEnabledHint: "Nur wenn nichts läuft, werden temporäre Daten verworfen, die sich neu aufbauen lassen. Während der Arbeit bringt das nichts — der nächste Abruf baut sie sofort wieder auf. Es werden keine Daten gelöscht, nur der erste Abruf danach ist langsamer. Standardmäßig aus.",
					autoReclaimThresholdPct: "Wann Speicher freigegeben wird",
					autoReclaimThresholdPctHint: "Ab diesem Anteil des tatsächlich verfügbaren Speichers wird aufgeräumt — jede Installation passt sich so selbst an. Zu niedrig räumt ständig auf, zu hoch erst kurz vor dem Absturz. 60 % ist ein guter Wert.",
					autoReclaimNever: "Noch nicht ausgelöst",
					autoReclaimReasonEmergency: "Der Speicher war knapp, es wurde ohne Warten auf Leerlauf aufgeräumt",
					autoReclaimLast: "Letzte automatische Freigabe",
					reclaimTitle: "Jetzt Speicher freigeben",
					reclaimButton: "Speicher freigeben",
					reclaimRunning: "Wird aufgeräumt…",
					reclaimHint: "Verwirft temporäre Daten, die sich neu aufbauen lassen, und gibt so Speicher frei (etwa 1,3 GB in rund 0,1 s). Der erste Abruf danach ist langsamer (etwa 1,4 s), danach läuft es wieder normal. Es werden keine Daten gelöscht.",
					reclaimFailed: "Aufräumen fehlgeschlagen",
					dshHeapUsed: "Aktuell belegter Speicher",
					dshHeapRestartHint: "Eingestellt: {configured}, aktuell: {live} — wirkt erst nach einem Neustart.",
					dshHeapAtLimit: "Fast voll — Grenze erhöhen und neu starten",
					overridden: "Geändert",
					save: "Speichern",
					discard: "Verwerfen",
					saved: "Gespeichert",
					saving: "Wird gespeichert…",
					unsaved: "Ungespeicherte Änderungen",
					saveFailed: "Speichern fehlgeschlagen",
					retrySave: "Erneut speichern",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ Das Aufräumen entfernt in allen Sitzungen die Ausgaben aus dem Verlauf und ältere Gesprächsteile. Entferntes lässt sich nicht wiederherstellen — Zusammenfassungen und Erinnerungen behalten nur den Sinn, nicht den Wortlaut.",
					cardHint: "Die Einstellungen liegen in ~/.mbsf/config.json und wirken sofort.",
					trimTitle: "Gesprächsverlauf kürzen",
					trimHintLead: "⚠ Nur beim Neustart — gekürzt wird beim Neustart, im laufenden Betrieb passiert nichts.",
					trimHint: "Angehakte Sitzungen werden beim Neustart ausgedünnt: alte Ausgaben des Assistenten entfallen und ältere Gesprächsteile werden gekürzt, nur der jüngste Teil bleibt. Nicht angehakte Sitzungen bleiben unberührt.",
					trimOn: "Ein",
					trimOff: "Aus",
					trimOffHint: "Aus — beim Neustart wird kein Gespräch gekürzt. Einschalten, um es zu aktivieren und einzurichten.",
					trimGlobalWins: "Das Aufräumen beim Neustart oben ist eingeschaltet, daher werden alle Sitzungen aufgeräumt und ein Haken hier ändert nichts. Schalten Sie zuerst diesen Schalter aus, um je Sitzung aufzuräumen.",
					trimListLoading: "Sitzungen werden aufgelistet…",
					trimListFailed: "Die Sitzungsliste konnte nicht gelesen werden",
					trimEmpty: "Keine Sitzungen zum Kürzen",
					trimSelectAll: "Alle auswählen",
					trimClearAll: "Keine auswählen",
					trimSummary: "{n} Sitzungen ausgewählt · insgesamt {size}",
					trimNeverTrimmed: "Nie",
					trimLastFreed: "{size} freigegeben",
					trimRefresh: "Aktualisieren",
					sessionIdLabel: "Sitzung",
					sessionIdCopy: "Sitzungs-ID kopieren",
					sessionIdCopied: "Kopiert",
					sessionIdCopyFailed: "Kopieren fehlgeschlagen — bitte von Hand markieren",
					close: "Schließen",
					floatingPanelButton: "Sitzungsschalter",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "Erinnerungsabruf",
					sessionInjectHint: "Ob in dieser Sitzung passende Erinnerungen herangezogen werden. Ohne Änderung gilt die übergeordnete Sitzung oder die globale Einstellung.",
					sessionDateAnchor: "Heutiges Datum",
					sessionDateAnchorHint: "Ob dem Modell in dieser Sitzung das Datum mitgeteilt wird. Ohne Änderung gilt die übergeordnete Sitzung oder die globale Einstellung.",
					sessionAutoCompact: "Automatische Komprimierung",
					sessionAutoCompactHint: "Ob lange Gespräche in dieser Sitzung automatisch zusammengefasst werden. Ohne Änderung gilt die übergeordnete Sitzung oder die globale Einstellung; ausgeschaltet wird erst komprimiert, wenn der Platz knapp wird.",
					sessionInheritedParent: "Folgt der übergeordneten Sitzung",
					sessionInheritedGlobal: "Folgt der globalen Einstellung",
					sessionInheritedHint: "Der Wert kommt derzeit von woanders; ein Klick auf den Schalter setzt ihn nur für diese Sitzung.",
					activityRead: "Erinnert",
					activityWrite: "Ablegen",
					activityCompact: "Komprimiert",
					activityHint: "Was gerade läuft — Lesen, Schreiben oder Komprimieren",
					activityIndicator: "Aktivitätsanimation",
					activityIndicatorHint: "Zeigt laufende Vorgänge als Tropfen, der um das Symbol kreist. Ausgeschaltet bleibt das Symbol still.",
					activityLabel: "Aktivitätstext",
					activityLabelHint: "Zeigt die aktuelle Aktion als Text neben dem Symbol. Unabhängig von der Animation — die Animation sagt, ob etwas läuft, der Text, was.",
					diagIdle: "Leerlaufprüfung",
					diagFree: "untätig",
					diagBusy: "beschäftigt",
					diagInflight: "in Arbeit",
					diagPhase: "Phase",
					diagHost: "Host",
					diagHostNone: "keine Host-Erkennung",
					diagHistorical: "Archiv vorhanden",
					diagSessionTypes: "Sitzungsformate",
					diagKnowsNew: "kennt das neue Format ✓",
					diagUnknownNew: "✗ kennt das neue Format nicht (Kürzen überspringt alles)",
					timeSecondsAgo: "vor {n} s",
					trimSearchPlaceholder: "Sitzungs-ID / Arbeitsbereich suchen",
					trimFilterAll: "Alle",
					trimFilterSelected: "Ausgewählt",
					trimFilterUnselected: "Nicht ausgewählt",
					trimSortMtime: "Zuletzt verwendet",
					trimSortCreated: "Erstellt",
					trimSortSize: "Größe",
					trimSortPath: "Arbeitsbereich",
					trimSortToggle: "Auf-/absteigend umschalten",
					trimNoMatch: "Keine Sitzung passt zum Filter",
					trimViewSummary: "{shown} von {total} angezeigt",
					trimCopyId: "Sitzungs-ID kopieren",
					trimScopeNote: "Auswahl gilt nur für die aufgeführten Sitzungen",
					trimTabSessions: "Unterhaltungen",
					trimTabDeleted: "Gelöscht",
					trimGroupByLabel: "Gruppieren",
					trimGroupWorkspace: "Nach Arbeitsbereich",
					trimGroupTree: "Arbeitsbereichsbaum",
					trimGroupFlat: "Eine Liste",
					trimScopeLabel: "Art der Unterhaltung",
					trimScopeAll: "Alle",
					trimScopeMain: "Nur Haupt",
					trimScopeSubagent: "Nur Subagenten",
					trimArchiveLabel: "Archiviert",
					trimArchiveHide: "Archivierte ausblenden",
					trimArchiveShow: "Alles (Archivierte zeigen)",
					trimArchiveOnly: "Nur Archivierte",
					trimBadgeArchived: "archiviert",
					trimBadgeRootArchived: "mit-archiviert",
					trimBadgeOrphan: "Waise",
					trimBadgeRootArchivedHint: "Gehört zu einer archivierten Hauptsitzung (Archivierung erfasst keine Subagenten)",
					trimBadgeSubagent: "Subagent",
					trimGroupCount: "{n} Unterhaltungen · {selected} markiert",
					trimDelete: "Unterhaltung löschen",
					trimDeleteBlockedActive: "Eine aktive Unterhaltung lässt sich nicht löschen – zuerst in DSH archivieren",
					trimDeleteBlockedLive: "Läuft gerade, nicht löschbar",
					trimDeleteBlockedParent: "Die Hauptsitzung ist noch nicht archiviert – archiviere sie zuerst",
					trimDeleteConfirmTitle: "Diese Unterhaltung löschen?",
					trimDeleteConfirmBody: "„{title}“ wandert in den Papierkorb und lässt sich {days} Tage lang wiederherstellen; danach wird sie endgültig entfernt.",
					trimDeleteChildren: "Die {n} Subagenten-Unterhaltungen werden mitgelöscht (und beim Wiederherstellen mit zurückgebracht).",
					trimDeleteConfirmOk: "In den Papierkorb",
					trimDeleteCancel: "Abbrechen",
					trimDeleteDone: "In den Papierkorb verschoben: {n} Unterhaltung(en), {days} Tage wiederherstellbar",
					trimDeleteFailed: "Löschen fehlgeschlagen: {detail}",
					trimDeletedEmpty: "Der Papierkorb ist leer",
					trimDeletedHint: "Gelöschte Unterhaltungen bleiben {days} Tage. Beim Öffnen dieser Liste werden abgelaufene endgültig entfernt.",
					trimDeletedAt: "gelöscht am {date}",
					trimDeletedRemaining: "noch {n} Tage",
					trimDeletedRestore: "Wiederherstellen",
					trimRestoreDone: "{n} Unterhaltung(en) wiederhergestellt",
					trimRestoreFailed: "Wiederherstellen fehlgeschlagen: {detail}",
					trimDeletedPurged: "{n} Eintrag/Einträge älter als {days} Tage endgültig entfernt"
				}
			},
			{
				id: "fr",
				label: "Français",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "Réglages du moteur local — les modifications prennent effet immédiatement ; seuls ceux marqués « après redémarrage » nécessitent un redémarrage.",
					loading: "Lecture…",
					error: "Impossible de lire l'état. Réessayez plus tard.",
					retry: "Réessayer",
					version: "Version",
					brain: "Base de mémoire",
					encoder: "Encodage linguistique",
					sessions: "Sessions",
					seeded: "Anciennes mémoires importées",
					trackedSessions: "Sessions enregistrées",
					globalEma: "Moyenne globale",
					none: "Aucun",
					compression: "Compression",
					never: "Pas encore compressé",
					messages: "Messages",
					compressed: "Compressés",
					preserved: "Conservés",
					tailFpSegments: "Fragments",
					textChars: "Caractères",
					compressions: "Compressions",
					emaMs: "Durée moyenne",
					lastMs: "Dernière durée",
					compressionLine: "Compression",
					compressionLineHint: "Compressions cumulées dans cette session : nombre · messages repliés · dernière durée · ancienneté",
					compressionJustNow: "à l'instant",
					compressionMinutesAgo: "il y a {n} min",
					compressionHoursAgo: "il y a {n} h",
					compressionHistory: "Historique des compressions",
					historyEmpty: "Cette session n'a pas encore été compressée",
					memoryIndex: "Index de mémoire",
					topics: "Sujets",
					totalRefs: "Entrées",
					sessionRefs: "Depuis les sessions",
					fileRefs: "Depuis les fichiers",
					nestedTopics: "Sujets fusionnés",
					initialized: "Prêt",
					segments: "Contenu",
					segmentCount: "Segments",
					totalLines: "Lignes",
					totalBytes: "Taille",
					injection: "Rappel de mémoire",
					calls: "Vérifications",
					needInjected: "Rappelés directement",
					weakInjected: "Partiellement rappelés",
					injected: "Éléments rappelés",
					injectedChars: "Caractères rappelés",
					recall: "Recherche",
					needTrue: "Rappelés directement",
					needFalse: "Partiellement rappelés",
					expanded: "Développés",
					expandedChars: "Caractères développés",
					growth: "Croissance de la mémoire",
					gMessages: "Messages mémorisés",
					gDuplicate: "Doublons fusionnés",
					gChainMerge: "Éléments similaires fusionnés",
					gNewTopic: "Nouveaux sujets",
					gShadowed: "Ignorés",
					gNestEdge: "Liens créés",
					gNestHot: "Liés aux sujets fréquents",
					gNestArch: "Liés aux sujets anciens",
					injectEnabled: "Rappel de mémoire",
					injectEnabledHint: "Avant chaque étape, les souvenirs liés à ce qui a été dit plus tôt sont ramenés automatiquement. Désactivé par défaut.",
					autoCompact: "Compression automatique",
					autoCompactHint: "Quand la conversation s'allonge, les parties anciennes sont résumées pour économiser le contexte. Désactivé, la compression n'a lieu que lorsque la place manque.",
					compactTailMessages: "Messages récents conservés",
					compactTailMessagesHint: "Combien de messages récents restent toujours en texte original (8–256, par défaut 12). Un plancher strict : les messages les plus récents ne sont jamais repliés dans le résumé, seuls les plus anciens peuvent être compactés.",
					dateAnchorEnabled: "Date du jour",
					dateAnchorEnabledHint: "Indique la date au modèle au premier échange de chaque journée, pour qu'il ne la devine pas d'après le contexte. Activé par défaut.",
					restartCleanupEnabled: "Nettoyage au redémarrage",
					restartCleanupEnabledHint: "Pendant le redémarrage, allège aussi les choses : supprime les anciennes sorties de l'assistant et raccourcit les conversations anciennes, pour toutes les sessions. Désactivé, le redémarrage se contente de redémarrer, et va plus vite.",
					cleanupPruneTurns: "Tours de conversation à conserver",
					cleanupPruneTurnsHint: "0 = ne touche pas aux conversations et supprime seulement les anciennes sorties de l'assistant. Une valeur N conserve au moins les N derniers tours (souvent davantage).",
					backupKeepCount: "Sauvegardes conservées par session",
					backupKeepCountHint: "Une sauvegarde est faite avant chaque modification ; indiquez ici combien en garder pour pouvoir revenir en arrière. 0 = tout conserver.",
					restartButtonVisible: "Afficher le bouton « Redémarrer DSH »",
					restartButtonVisibleHint: "Affiche un bouton de redémarrage sur cette page, pour libérer de la mémoire à la main ou charger une nouvelle version. Toutes les sessions se déconnectent brièvement.",
					sessionStreamKeepCount: "Sorties de l'assistant à conserver",
					sessionStreamKeepCountHint: "Combien des entrées les plus récentes garder lors du nettoyage (200 par défaut), pour pouvoir relire les derniers tours. 0 = tout supprimer.",
					restartDsh: "Redémarrer DSH",
					restartDshHint: "Redémarre maintenant. Toutes les sessions se déconnectent brièvement et toute réponse en cours est interrompue. Le nettoyage ci-dessus s'exécute aussi s'il est activé.",
					restartSent: "Redémarrage demandé…",
					restartFailed: "Échec de la demande de redémarrage",
					dshHeapMb: "Limite de mémoire",
					dshHeapMbHint: "Mémoire que DSH peut utiliser après un redémarrage. Avec un long historique, la valeur par défaut ne suffit pas et le processus plante. Prend effet après un redémarrage. 0 = valeur par défaut du système.",
					autoReclaimEnabled: "Libérer la mémoire au repos",
					autoReclaimEnabledHint: "Uniquement quand rien ne tourne, supprime les données temporaires qui peuvent être recalculées. Les effacer pendant le travail ne sert à rien : la recherche suivante les recrée aussitôt. Aucune donnée n'est supprimée ; seule la première recherche qui suit est un peu plus lente. Désactivé par défaut.",
					autoReclaimThresholdPct: "Seuil de libération de mémoire",
					autoReclaimThresholdPctHint: "Le nettoyage démarre à cette part de la mémoire réellement disponible, si bien que chaque installation s'adapte d'elle-même. Trop bas, il nettoie sans arrêt ; trop haut, il attend d'être au bord du plantage. 60 % est une bonne valeur.",
					autoReclaimNever: "Pas encore déclenché",
					autoReclaimReasonEmergency: "Mémoire saturée : nettoyage lancé sans attendre le repos",
					autoReclaimLast: "Dernière libération automatique",
					reclaimTitle: "Libérer de la mémoire",
					reclaimButton: "Libérer",
					reclaimRunning: "Nettoyage…",
					reclaimHint: "Supprime les données temporaires recalculables pour libérer de la mémoire (environ 1,3 Go, en 0,1 s environ). La première recherche qui suit est plus lente (environ 1,4 s), puis tout redevient normal. Aucune donnée n'est supprimée.",
					reclaimFailed: "Échec du nettoyage",
					dshHeapUsed: "Mémoire utilisée",
					dshHeapRestartHint: "Réglé sur {configured}, actuellement {live} — prend effet après un redémarrage.",
					dshHeapAtLimit: "Presque plein — augmentez la limite puis redémarrez",
					overridden: "Modifié",
					save: "Enregistrer",
					discard: "Annuler",
					saved: "Enregistré",
					saving: "Enregistrement…",
					unsaved: "Modifications non enregistrées",
					saveFailed: "Échec de l'enregistrement",
					retrySave: "Réessayer l'enregistrement",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ Le nettoyage supprime l'historique des sorties et les conversations anciennes de toutes les sessions. Ce qui est supprimé ne peut pas être récupéré — les résumés et les mémoires ne gardent que l'essentiel, pas le texte d'origine.",
					cardHint: "Les réglages se trouvent dans ~/.mbsf/config.json et s'appliquent immédiatement.",
					trimTitle: "Élaguer l'historique des conversations",
					trimHintLead: "⚠ Uniquement au redémarrage : l'élagage se fait au redémarrage, pas en cours d'exécution.",
					trimHint: "Les sessions cochées sont allégées au redémarrage : les anciennes sorties de l'assistant sont supprimées et les conversations anciennes raccourcies, en ne gardant que la partie récente. Les sessions non cochées restent intactes.",
					trimGlobalWins: "Le « Nettoyage au redémarrage » ci-dessus est activé : toutes les sessions sont nettoyées et cocher ici ne change rien. Désactivez d'abord ce réglage pour nettoyer session par session.",
					trimOn: "Activé",
					trimOff: "Désactivé",
					trimOffHint: "Désactivé — aucune conversation n'est élaguée au redémarrage. Activez pour configurer.",
					trimListLoading: "Liste des sessions en cours…",
					trimListFailed: "Impossible de lire la liste des sessions",
					trimEmpty: "Aucune session à élaguer",
					trimSelectAll: "Tout sélectionner",
					trimClearAll: "Tout désélectionner",
					trimSummary: "{n} sessions cochées · {size} au total",
					trimNeverTrimmed: "Jamais",
					trimLastFreed: "{size} libérés",
					trimRefresh: "Actualiser",
					sessionIdLabel: "Session",
					sessionIdCopy: "Copier l'ID de session",
					sessionIdCopied: "Copié",
					sessionIdCopyFailed: "Échec de la copie — sélectionnez-la à la main",
					close: "Fermer",
					floatingPanelButton: "Interrupteurs de session",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "Rappel de mémoire",
					sessionInjectHint: "Indique si les souvenirs liés sont ramenés dans cette session. Sans modification, la valeur suit la session parente ou le réglage global.",
					sessionDateAnchor: "Date du jour",
					sessionDateAnchorHint: "Indique si la date est communiquée au modèle dans cette session. Sans modification, la valeur suit la session parente ou le réglage global.",
					sessionAutoCompact: "Compression automatique",
					sessionAutoCompactHint: "Indique si les longues conversations de cette session sont résumées automatiquement. Sans modification, la valeur suit la session parente ou le réglage global ; une fois désactivé, la compression n'a lieu que lorsque la place manque.",
					sessionInheritedParent: "Suit la session parente",
					sessionInheritedGlobal: "Suit le réglage global",
					sessionInheritedHint: "La valeur vient actuellement d'ailleurs ; basculer un interrupteur la définit pour cette seule session.",
					activityRead: "Rappel en cours",
					activityWrite: "Écriture en cours",
					activityCompact: "Compression en cours",
					activityHint: "L'opération en cours — lecture, écriture ou compression",
					activityIndicator: "Animation d'activité",
					activityIndicatorHint: "Affiche l'opération en cours par une goutte qui tourne autour de l'icône. Désactivé, l'icône reste immobile.",
					activityLabel: "Texte d'activité",
					activityLabelHint: "Affiche l'action en cours en texte à côté de l'icône. Indépendant de l'animation : l'une dit si quelque chose tourne, l'autre dit quoi.",
					diagIdle: "Test d'inactivité",
					diagFree: "inactif",
					diagBusy: "occupé",
					diagInflight: "en cours",
					diagPhase: "phase",
					diagHost: "hôte",
					diagHostNone: "aucune détection d'hôte",
					diagHistorical: "historique archivé",
					diagSessionTypes: "formats de session",
					diagKnowsNew: "connaît le nouveau format ✓",
					diagUnknownNew: "✗ ne connaît pas le nouveau format (l'élagage sautera tout)",
					timeSecondsAgo: "il y a {n} s",
					trimSearchPlaceholder: "Rechercher un ID de session / un espace de travail",
					trimFilterAll: "Toutes",
					trimFilterSelected: "Cochées",
					trimFilterUnselected: "Non cochées",
					trimSortMtime: "Dernière utilisation",
					trimSortCreated: "Création",
					trimSortSize: "Taille",
					trimSortPath: "Espace de travail",
					trimSortToggle: "Inverser l’ordre",
					trimNoMatch: "Aucune session ne correspond au filtre",
					trimViewSummary: "{shown} sur {total} affichées",
					trimCopyId: "Copier l’ID de session",
					trimScopeNote: "La sélection ne concerne que les sessions affichées",
					trimTabSessions: "Conversations",
					trimTabDeleted: "Supprimées",
					trimGroupByLabel: "Regrouper",
					trimGroupWorkspace: "Par espace de travail",
					trimGroupTree: "Arborescence des espaces",
					trimGroupFlat: "Une seule liste",
					trimScopeLabel: "Type de conversation",
					trimScopeAll: "Toutes",
					trimScopeMain: "Principales seulement",
					trimScopeSubagent: "Sous-agents seulement",
					trimArchiveLabel: "Archivées",
					trimArchiveHide: "Masquer les archivées",
					trimArchiveShow: "Tout (afficher les archivées)",
					trimArchiveOnly: "Archivées seulement",
					trimBadgeArchived: "archivée",
					trimBadgeRootArchived: "archivée avec la principale",
					trimBadgeOrphan: "orpheline",
					trimBadgeRootArchivedHint: "Appartient à une conversation principale archivée (l’archivage ne concerne pas les sous-agents)",
					trimBadgeSubagent: "sous-agent",
					trimGroupCount: "{n} conversations · {selected} cochées",
					trimDelete: "Supprimer la conversation",
					trimDeleteBlockedActive: "Une conversation active ne peut pas être supprimée — archivez-la d’abord dans DSH",
					trimDeleteBlockedLive: "En cours, suppression impossible",
					trimDeleteBlockedParent: "La conversation principale n’est pas encore archivée — archivez-la d’abord",
					trimDeleteConfirmTitle: "Supprimer cette conversation ?",
					trimDeleteConfirmBody: "« {title} » ira dans la corbeille et pourra être restaurée pendant {days} jours ; ensuite elle sera effacée définitivement.",
					trimDeleteChildren: "Ses {n} conversations de sous-agents seront supprimées aussi (et restaurées ensemble).",
					trimDeleteConfirmOk: "Mettre à la corbeille",
					trimDeleteCancel: "Annuler",
					trimDeleteDone: "Mise à la corbeille : {n} conversation(s), restaurables {days} jours",
					trimDeleteFailed: "Suppression impossible : {detail}",
					trimDeletedEmpty: "La corbeille est vide",
					trimDeletedHint: "Les conversations supprimées sont conservées {days} jours. À l’ouverture de cette liste, les échéances sont effacées définitivement.",
					trimDeletedAt: "supprimée le {date}",
					trimDeletedRemaining: "{n} jours restants",
					trimDeletedRestore: "Restaurer",
					trimRestoreDone: "{n} conversation(s) restaurée(s)",
					trimRestoreFailed: "Restauration impossible : {detail}",
					trimDeletedPurged: "{n} élément(s) de plus de {days} jours effacé(s) définitivement"
				}
			},
			{
				id: "es",
				label: "Español",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "Ajustes del entorno local — los cambios se aplican al instante; solo los marcados como «tras reiniciar» necesitan reinicio.",
					loading: "Leyendo…",
					error: "No se pudo leer. Inténtalo de nuevo más tarde.",
					retry: "Reintentar",
					version: "Versión",
					brain: "Base de memoria",
					encoder: "Codificación de lenguaje",
					sessions: "Sesiones",
					seeded: "Memorias antiguas importadas",
					trackedSessions: "Sesiones registradas",
					globalEma: "Media global",
					none: "Ninguno",
					compression: "Compresión",
					never: "Aún sin comprimir",
					messages: "Mensajes",
					compressed: "Comprimidos",
					preserved: "Conservados",
					tailFpSegments: "Fragmentos",
					textChars: "Caracteres",
					compressions: "Compresiones",
					emaMs: "Tiempo medio",
					lastMs: "Último tiempo",
					compressionLine: "Compresión",
					compressionLineHint: "Compresión acumulada en esta sesión: veces · mensajes plegados · última duración · hace cuánto",
					compressionJustNow: "ahora mismo",
					compressionMinutesAgo: "hace {n} min",
					compressionHoursAgo: "hace {n} h",
					compressionHistory: "Historial de compresión",
					historyEmpty: "Esta sesión aún no se ha comprimido",
					memoryIndex: "Índice de memoria",
					topics: "Temas",
					totalRefs: "Entradas",
					sessionRefs: "De sesiones",
					fileRefs: "De archivos",
					nestedTopics: "Temas fusionados",
					initialized: "Listo",
					segments: "Contenido",
					segmentCount: "Segmentos",
					totalLines: "Líneas",
					totalBytes: "Tamaño",
					injection: "Recuerdo automático",
					calls: "Evaluaciones",
					needInjected: "Evocado directo",
					weakInjected: "Evocado en parte",
					injected: "Evocados",
					injectedChars: "Caracteres evocados",
					recall: "Consulta",
					needTrue: "Evocado directo",
					needFalse: "Evocado en parte",
					expanded: "Expandido",
					expandedChars: "Caracteres expandidos",
					growth: "Crecimiento de la memoria",
					gMessages: "Mensajes recordados",
					gDuplicate: "Repeticiones fusionadas",
					gChainMerge: "Similares fusionados",
					gNewTopic: "Temas nuevos",
					gShadowed: "Omitidos",
					gNestEdge: "Vínculos creados",
					gNestHot: "Vinculado a temas frecuentes",
					gNestArch: "Vinculado a temas antiguos",
					injectEnabled: "Recuerdo automático",
					injectEnabledHint: "Antes de cada paso, trae los recuerdos relacionados con lo que se habló antes. Desactivado de forma predeterminada.",
					autoCompact: "Compresión automática",
					autoCompactHint: "Cuando la conversación se alarga, las partes antiguas se resumen para ahorrar contexto. Si está desactivada, solo se comprime cuando falta espacio.",
					compactTailMessages: "Mensajes recientes conservados",
					compactTailMessagesHint: "Cuántos mensajes recientes se conservan siempre como texto original (8–256, por defecto 12). Un mínimo estricto: los mensajes más recientes nunca se pliegan en el resumen; solo los más antiguos pueden compactarse.",
					dateAnchorEnabled: "Fecha de hoy",
					dateAnchorEnabledHint: "Le dice al modelo la fecha en el primer intercambio de cada día, para que no la adivine por el contexto. Activada de forma predeterminada.",
					restartCleanupEnabled: "Limpiar al reiniciar",
					restartCleanupEnabledHint: "Al reiniciar, también aligera todo: elimina la salida antigua del asistente y recorta la conversación más antigua, en todas las sesiones. Si lo desactivas, solo reinicia, y es más rápido.",
					cleanupPruneTurns: "Turnos de conversación que conservar",
					cleanupPruneTurnsHint: "0 = no toca la conversación, solo elimina la salida antigua del asistente. Con N se conservan al menos los últimos N turnos (normalmente más).",
					backupKeepCount: "Copias de seguridad por sesión",
					backupKeepCountHint: "Antes de cada cambio se hace una copia; aquí eliges cuántas conservar para poder volver atrás si algo sale mal. 0 = conservarlas todas.",
					restartButtonVisible: "Mostrar el botón «Reiniciar DSH»",
					restartButtonVisibleHint: "Muestra un botón para reiniciar en esta página, para liberar memoria a mano o cargar una versión nueva. Durante el reinicio, todas las sesiones se desconectan un momento.",
					sessionStreamKeepCount: "Salida del asistente que conservar",
					sessionStreamKeepCountHint: "Cuántas entradas recientes se conservan al limpiar (200 por defecto), para que puedas revisar los últimos turnos tras reiniciar. 0 = eliminarlas todas.",
					restartDsh: "Reiniciar DSH",
					restartDshHint: "Reinicia ahora. Todas las sesiones se desconectan un momento y la respuesta en curso se interrumpe. Si la limpieza de arriba está activada, también se ejecuta.",
					restartSent: "Reinicio solicitado…",
					restartFailed: "No se pudo solicitar el reinicio",
					dshHeapMb: "Límite de memoria",
					dshHeapMbHint: "Cuánta memoria puede usar DSH después de reiniciar. Con historiales largos, el valor predeterminado no basta y el proceso se cae. Se aplica tras reiniciar. 0 = valor del sistema.",
					autoReclaimEnabled: "Liberar memoria cuando está inactivo",
					autoReclaimEnabledHint: "Solo cuando no hay nada en marcha, descarta datos temporales que se pueden recalcular. Limpiarlos mientras trabaja no sirve: la siguiente consulta los reconstruye al instante. No se borra ningún dato; solo la primera consulta después tarda un poco más. Desactivado de forma predeterminada.",
					autoReclaimThresholdPct: "Cuándo liberar memoria",
					autoReclaimThresholdPctHint: "Empieza a limpiar al llegar a esta proporción de la memoria realmente disponible, así se adapta a cualquier instalación. Demasiado bajo limpia sin parar; demasiado alto espera a estar al borde del fallo. 60 % es un buen valor.",
					autoReclaimNever: "Aún no se ha activado",
					autoReclaimReasonEmergency: "La memoria estaba al límite y se limpió sin esperar a estar inactivo",
					autoReclaimLast: "Última liberación automática",
					reclaimTitle: "Liberar memoria ahora",
					reclaimButton: "Liberar memoria",
					reclaimRunning: "Liberando…",
					reclaimHint: "Descarta datos temporales que se pueden recalcular para liberar memoria (unos 1,3 GB en unos 0,1 s). La primera consulta después tarda algo más (unos 1,4 s). No se borra ningún dato.",
					reclaimFailed: "No se pudo liberar memoria",
					dshHeapUsed: "Memoria en uso",
					dshHeapRestartHint: "Configurado en {configured}; ahora mismo {live}: se aplicará tras reiniciar.",
					dshHeapAtLimit: "Casi lleno: sube el límite y reinicia",
					overridden: "Cambiado",
					save: "Guardar",
					discard: "Descartar",
					saved: "Guardado",
					saving: "Guardando…",
					unsaved: "Cambios sin guardar",
					saveFailed: "No se pudo guardar",
					retrySave: "Reintentar guardar",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ La limpieza elimina la salida histórica y la conversación antigua de todas las sesiones. Lo eliminado no se puede recuperar: los resúmenes y recuerdos guardan solo la idea general, no el texto original.",
					cardHint: "Los ajustes se guardan en ~/.mbsf/config.json y se aplican al instante.",
					trimTitle: "Recortar el historial de sesiones",
					trimHintLead: "⚠ Solo al reiniciar: el recorte ocurre al reiniciar y no mientras la app está en marcha.",
					trimHint: "Las sesiones marcadas se aligeran al reiniciar: se elimina la salida antigua del asistente y se recorta la conversación más antigua, dejando solo lo reciente. Las no marcadas no se tocan.",
					trimGlobalWins: "La opción «Limpiar al reiniciar» de arriba está activada, así que se limpian todas las sesiones y marcar aquí no cambia nada. Desactívala primero para limpiar sesión por sesión.",
					trimOn: "Activado",
					trimOff: "Desactivado",
					trimOffHint: "Desactivado — no se recorta ninguna conversación al reiniciar. Actívalo para configurar.",
					trimListLoading: "Cargando sesiones…",
					trimListFailed: "No se pudo leer la lista de sesiones",
					trimEmpty: "No hay sesiones que recortar",
					trimSelectAll: "Seleccionar todo",
					trimClearAll: "No seleccionar nada",
					trimSummary: "{n} sesiones marcadas · {size} en total",
					trimNeverTrimmed: "Nunca",
					trimLastFreed: "{size} liberados",
					trimRefresh: "Actualizar",
					sessionIdLabel: "Sesión",
					sessionIdCopy: "Copiar el ID de la sesión",
					sessionIdCopied: "Copiado",
					sessionIdCopyFailed: "No se pudo copiar; selecciónalo a mano",
					close: "Cerrar",
					floatingPanelButton: "Interruptores de sesión",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "Recuerdo automático",
					sessionInjectHint: "Si en esta sesión se traen automáticamente los recuerdos relacionados. Sin cambios, sigue a la sesión padre o al ajuste global.",
					sessionDateAnchor: "Fecha de hoy",
					sessionDateAnchorHint: "Si en esta sesión se le dice al modelo qué día es hoy. Sin cambios, sigue a la sesión padre o al ajuste global.",
					sessionAutoCompact: "Compresión automática",
					sessionAutoCompactHint: "Si las conversaciones largas de esta sesión se resumen automáticamente. Sin cambios, sigue a la sesión padre o al ajuste global; desactivada, solo se comprime cuando falta espacio.",
					sessionInheritedParent: "Siguiendo a la sesión padre",
					sessionInheritedGlobal: "Siguiendo el ajuste global",
					sessionInheritedHint: "El valor viene de otro sitio; al tocar un interruptor, se fija solo para esta sesión.",
					activityRead: "Recordando",
					activityWrite: "Guardando",
					activityCompact: "Comprimiendo",
					activityHint: "Lo que está en marcha ahora — leer = expandir / escribir = fijar / comprimir = fusionar",
					activityIndicator: "Animación de actividad",
					activityIndicatorHint: "Muestra lo que está en marcha con una gota que gira alrededor del icono. Si lo desactivas, el icono se queda quieto.",
					activityLabel: "Texto de actividad",
					activityLabelHint: "Muestra la acción actual como texto junto al icono. Es independiente de la animación: una dice si hay algo en marcha, la otra qué es.",
					diagIdle: "Test de inactividad",
					diagFree: "libre",
					diagBusy: "ocupado",
					diagInflight: "en curso",
					diagPhase: "fase",
					diagHost: "host",
					diagHostNone: "sin sondeo de host",
					diagHistorical: "historial archivado",
					diagSessionTypes: "formatos de sesión",
					diagKnowsNew: "reconoce el formato nuevo ✓",
					diagUnknownNew: "✗ no reconoce el formato nuevo (el recorte saltará todo)",
					timeSecondsAgo: "hace {n} s",
					trimSearchPlaceholder: "Buscar ID de sesión / espacio de trabajo",
					trimFilterAll: "Todas",
					trimFilterSelected: "Marcadas",
					trimFilterUnselected: "Sin marcar",
					trimSortMtime: "Último uso",
					trimSortCreated: "Creación",
					trimSortSize: "Tamaño",
					trimSortPath: "Espacio de trabajo",
					trimSortToggle: "Cambiar orden ascendente/descendente",
					trimNoMatch: "Ninguna sesión coincide con el filtro",
					trimViewSummary: "Mostrando {shown} de {total}",
					trimCopyId: "Copiar ID de sesión",
					trimScopeNote: "La selección solo afecta a las sesiones mostradas",
					trimTabSessions: "Conversaciones",
					trimTabDeleted: "Eliminadas",
					trimGroupByLabel: "Agrupar",
					trimGroupWorkspace: "Por espacio de trabajo",
					trimGroupTree: "Árbol de espacios",
					trimGroupFlat: "Una sola lista",
					trimScopeLabel: "Tipo de conversación",
					trimScopeAll: "Todas",
					trimScopeMain: "Solo principales",
					trimScopeSubagent: "Solo subagentes",
					trimArchiveLabel: "Archivadas",
					trimArchiveHide: "Ocultar archivadas",
					trimArchiveShow: "Todo (mostrar archivadas)",
					trimArchiveOnly: "Solo archivadas",
					trimBadgeArchived: "archivada",
					trimBadgeRootArchived: "archivada con la principal",
					trimBadgeOrphan: "huérfana",
					trimBadgeRootArchivedHint: "Pertenece a una conversación principal archivada (el archivado no incluye a los subagentes)",
					trimBadgeSubagent: "subagente",
					trimGroupCount: "{n} conversaciones · {selected} marcadas",
					trimDelete: "Eliminar conversación",
					trimDeleteBlockedActive: "Una conversación activa no se puede eliminar: archívala primero en DSH",
					trimDeleteBlockedLive: "En ejecución, no se puede eliminar",
					trimDeleteBlockedParent: "La conversación principal aún no está archivada: archívala primero",
					trimDeleteConfirmTitle: "¿Eliminar esta conversación?",
					trimDeleteConfirmBody: "«{title}» pasará a la papelera y podrá restaurarse durante {days} días; después se borrará definitivamente.",
					trimDeleteChildren: "Sus {n} conversaciones de subagentes se eliminarán también (y volverán juntas al restaurar).",
					trimDeleteConfirmOk: "Mover a la papelera",
					trimDeleteCancel: "Cancelar",
					trimDeleteDone: "Movida a la papelera: {n} conversación(es), restaurable(s) {days} días",
					trimDeleteFailed: "No se pudo eliminar: {detail}",
					trimDeletedEmpty: "La papelera está vacía",
					trimDeletedHint: "Las conversaciones eliminadas se guardan {days} días. Al abrir esta lista, las caducadas se borran definitivamente.",
					trimDeletedAt: "eliminada el {date}",
					trimDeletedRemaining: "quedan {n} días",
					trimDeletedRestore: "Restaurar",
					trimRestoreDone: "{n} conversación(es) restaurada(s)",
					trimRestoreFailed: "No se pudo restaurar: {detail}",
					trimDeletedPurged: "Se borraron definitivamente {n} elemento(s) con más de {days} días"
				}
			},
			{
				id: "ru",
				label: "Русский",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "Локальные настройки работы — изменения применяются сразу, перезапуск нужен только для пунктов с пометкой «после перезапуска».",
					loading: "Чтение…",
					error: "Не удалось прочитать статус. Повторите попытку позже.",
					retry: "Повторить",
					version: "Версия",
					brain: "Хранилище памяти",
					encoder: "Языковое кодирование",
					sessions: "Сессии",
					seeded: "Старые воспоминания импортированы",
					trackedSessions: "Записанные сессии",
					globalEma: "Общее среднее",
					none: "Нет",
					compression: "Сжатие",
					never: "Сжатия ещё не было",
					messages: "Сообщения",
					compressed: "Сжато",
					preserved: "Сохранено",
					tailFpSegments: "Фрагменты",
					textChars: "Символы",
					compressions: "Число сжатий",
					emaMs: "Среднее время",
					lastMs: "Последнее время",
					compressionLine: "Сжатие",
					compressionLineHint: "Сжатие за эту сессию: число · свёрнуто сообщений · последнее время · сколько прошло",
					compressionJustNow: "только что",
					compressionMinutesAgo: "{n} мин назад",
					compressionHoursAgo: "{n} ч назад",
					compressionHistory: "История сжатий",
					historyEmpty: "В этой сессии сжатия ещё не было",
					memoryIndex: "Индекс памяти",
					topics: "Темы",
					totalRefs: "Записи",
					sessionRefs: "Из сессий",
					fileRefs: "Из файлов",
					nestedTopics: "Объединённые темы",
					initialized: "Готово",
					segments: "Содержимое",
					segmentCount: "Сегментов",
					totalLines: "Строк",
					totalBytes: "Размер",
					injection: "Подсказки из памяти",
					calls: "Проверок",
					needInjected: "Подсказано сразу",
					weakInjected: "Подсказано частично",
					injected: "Подсказано записей",
					injectedChars: "Символов подсказано",
					recall: "Обращение к памяти",
					needTrue: "Подсказано сразу",
					needFalse: "Подсказано частично",
					expanded: "Развёрнуто",
					expandedChars: "Символов развёрнуто",
					growth: "Рост памяти",
					gMessages: "Запомнено сообщений",
					gDuplicate: "Объединено повторов",
					gChainMerge: "Объединено похожих",
					gNewTopic: "Новые темы",
					gShadowed: "Пропущено",
					gNestEdge: "Создано связей",
					gNestHot: "Связь с частыми темами",
					gNestArch: "Связь с прошлыми темами",
					injectEnabled: "Подсказки из памяти",
					injectEnabledHint: "Перед каждым шагом автоматически подтягивать воспоминания, связанные с тем, что обсуждалось раньше. По умолчанию выключено.",
					autoCompact: "Автосжатие",
					autoCompactHint: "Когда диалог становится длинным, старые части сжимаются в краткое изложение, чтобы экономить контекст. Если выключено, сжатие происходит только когда место заканчивается.",
					compactTailMessages: "Хранить последние сообщения",
					compactTailMessagesHint: "Сколько последних сообщений всегда остаются исходным текстом (8–256, по умолчанию 12). Жёсткий минимум: последние сообщения никогда не сворачиваются в сводку — сжимаются только более старые.",
					dateAnchorEnabled: "Подсказка даты",
					dateAnchorEnabledHint: "В первом обмене сообщениями за день сообщать модели, какое сегодня число, чтобы она не угадывала дату по контексту. По умолчанию включено.",
					restartCleanupEnabled: "Очистка при перезапуске",
					restartCleanupEnabledHint: "При перезапуске заодно сократить объём: удалить старые ответы ассистента и обрезать ранние части диалога — во всех сессиях. Если выключить, будет только перезапуск, и это быстрее.",
					cleanupPruneTurns: "Сколько реплик диалога сохранять",
					cleanupPruneTurnsHint: "0 = не трогать диалоги, удалять только старые ответы ассистента. Если задать N, сохраняются как минимум последние N реплик (обычно больше).",
					backupKeepCount: "Сколько резервных копий хранить на сессию",
					backupKeepCountHint: "Перед изменениями создаётся резервная копия; здесь задаётся, сколько копий хранить, чтобы можно было откатиться. 0 = хранить все.",
					restartButtonVisible: "Показывать кнопку «Перезапустить DSH»",
					restartButtonVisibleHint: "Показывает на этой странице кнопку перезапуска, чтобы вручную освободить память или загрузить новую версию. Во время перезапуска все сессии ненадолго отключаются.",
					sessionStreamKeepCount: "Сколько последних ответов ассистента сохранять",
					sessionStreamKeepCountHint: "Сколько последних записей оставлять при очистке (по умолчанию 200), чтобы после перезапуска можно было посмотреть недавние реплики. 0 = удалить все.",
					restartDsh: "Перезапустить DSH",
					restartDshHint: "Перезапустить сразу. Все сессии ненадолго отключатся, текущие ответы прервутся. Если очистка выше включена, она тоже выполнится.",
					restartSent: "Запрос на перезапуск отправлен…",
					restartFailed: "Не удалось отправить запрос на перезапуск",
					dshHeapMb: "Предел памяти",
					dshHeapMbHint: "Сколько памяти может использовать DSH после перезапуска. При большой истории значения по умолчанию не хватает, и процесс падает. Изменение вступает в силу после перезапуска. 0 = системное значение по умолчанию.",
					autoReclaimEnabled: "Освобождать память в простое",
					autoReclaimEnabledHint: "Только когда ничего не выполняется, очищать временные данные, которые можно восстановить. Чистить их во время работы бессмысленно — при следующем обращении они создадутся снова. Данные не удаляются; только первое обращение после очистки будет медленнее. По умолчанию выключено.",
					autoReclaimThresholdPct: "Порог освобождения памяти",
					autoReclaimThresholdPctHint: "Очистка начинается при такой доле фактически доступной памяти, поэтому любая установка подстраивается сама. Слишком мало — очистка идёт постоянно; слишком много — ждём почти до падения. Рекомендуется 60%.",
					autoReclaimNever: "Ещё не срабатывало",
					autoReclaimReasonEmergency: "Памяти не хватало — очистка прошла, не дожидаясь простоя",
					autoReclaimLast: "Последнее автоосвобождение",
					reclaimTitle: "Освободить память сейчас",
					reclaimButton: "Освободить память",
					reclaimRunning: "Очистка…",
					reclaimHint: "Удаляет временные данные, которые можно восстановить, освобождая память (около 1,3 ГБ, примерно 0,1 с). Первое обращение после очистки будет медленнее (около 1,4 с), дальше всё как обычно. Данные не удаляются.",
					reclaimFailed: "Не удалось очистить",
					dshHeapUsed: "Занято памяти",
					dshHeapRestartHint: "Задано {configured}, сейчас фактически {live} — вступит в силу после перезапуска.",
					dshHeapAtLimit: "Почти заполнено — увеличьте предел и перезапустите",
					overridden: "Изменено",
					save: "Сохранить",
					discard: "Отменить",
					saved: "Сохранено",
					saving: "Сохранение…",
					unsaved: "Есть несохранённые изменения",
					saveFailed: "Не удалось сохранить",
					retrySave: "Повторить сохранение",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ Очистка удаляет историю ответов и ранние части диалога во всех сессиях. Удалённое не восстановить: краткие изложения и воспоминания сохраняют только суть, а не исходный текст.",
					cardHint: "Настройки хранятся в ~/.mbsf/config.json и применяются сразу.",
					trimTitle: "Сокращение истории диалога",
					trimHintLead: "⚠ Только при перезапуске — обрезка происходит при перезапуске, а не во время работы.",
					trimHint: "Отмеченные сессии сокращаются при перезапуске: удаляются старые ответы ассистента и обрезается ранняя часть диалога, остаётся только недавнее. Неотмеченные сессии не трогаются.",
					trimGlobalWins: "Пункт «Очистка при перезапуске» выше включён, поэтому очищаются все сессии и отметки здесь ничего не меняют. Чтобы очищать по сессиям, сначала выключите тот переключатель.",
					trimOn: "Вкл",
					trimOff: "Выкл",
					trimOffHint: "Выкл — при перезапуске диалоги не сокращаются. Включите, чтобы включить и настроить.",
					trimListLoading: "Получение списка сессий…",
					trimListFailed: "Не удалось прочитать список сессий",
					trimEmpty: "Нет сессий для сокращения",
					trimSelectAll: "Выбрать все",
					trimClearAll: "Снять все",
					trimSummary: "Отмечено сессий: {n} · всего {size}",
					trimNeverTrimmed: "Не сокращалась",
					trimLastFreed: "освобождено {size}",
					trimRefresh: "Обновить",
					sessionIdLabel: "Сессия",
					sessionIdCopy: "Скопировать ID сессии",
					sessionIdCopied: "Скопировано",
					sessionIdCopyFailed: "Не удалось скопировать — выделите вручную",
					close: "Закрыть",
					floatingPanelButton: "Переключатели сессии",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "Подсказки из памяти",
					sessionInjectHint: "Подтягивать ли связанные воспоминания в этой сессии. Если не менять, значение наследуется от родительской сессии или общей настройки.",
					sessionDateAnchor: "Подсказка даты",
					sessionDateAnchorHint: "Сообщать ли модели дату в этой сессии. Если не менять, значение наследуется от родительской сессии или общей настройки.",
					sessionAutoCompact: "Автосжатие",
					sessionAutoCompactHint: "Сжимать ли длинные диалоги в этой сессии автоматически. Если не менять, значение наследуется от родительской сессии или общей настройки; после выключения сжатие будет только когда место заканчивается.",
					sessionInheritedParent: "Наследуется от родительской сессии",
					sessionInheritedGlobal: "Наследуется из общей настройки",
					sessionInheritedHint: "Сейчас значение унаследовано; переключите его, чтобы задать только для этой сессии.",
					activityRead: "Вспоминает",
					activityWrite: "Записывает",
					activityCompact: "Сжимает",
					activityHint: "Что идёт прямо сейчас — чтение, запись или сжатие",
					activityIndicator: "Анимация активности",
					activityIndicatorHint: "Показывать текущее действие как каплю, обходящую значок. Если выключено, значок остаётся неподвижным.",
					activityLabel: "Текст активности",
					activityLabelHint: "Показывать текущее действие текстом рядом со значком. Не зависит от анимации: анимация отвечает «идёт ли что-то», текст — «что именно».",
					diagIdle: "Проверка простоя",
					diagFree: "свободно",
					diagBusy: "занято",
					diagInflight: "в работе",
					diagPhase: "фаза",
					diagHost: "хост",
					diagHostNone: "без опроса хоста",
					diagHistorical: "есть архив истории",
					diagSessionTypes: "форматов сессии",
					diagKnowsNew: "знает новый формат ✓",
					diagUnknownNew: "✗ не знает новый формат (сокращение пропустит всё)",
					timeSecondsAgo: "{n} с назад",
					trimSearchPlaceholder: "Поиск по ID сессии / рабочему пространству",
					trimFilterAll: "Все",
					trimFilterSelected: "Отмеченные",
					trimFilterUnselected: "Неотмеченные",
					trimSortMtime: "Последнее использование",
					trimSortCreated: "Создана",
					trimSortSize: "Размер",
					trimSortPath: "Рабочее пространство",
					trimSortToggle: "Переключить порядок",
					trimNoMatch: "Нет сессий, подходящих под фильтр",
					trimViewSummary: "Показано {shown} из {total}",
					trimCopyId: "Копировать ID сессии",
					trimScopeNote: "Выбор действует только на показанные сессии",
					trimTabSessions: "Беседы",
					trimTabDeleted: "Удалённые",
					trimGroupByLabel: "Группировка",
					trimGroupWorkspace: "По рабочей области",
					trimGroupTree: "Дерево рабочих областей",
					trimGroupFlat: "Одним списком",
					trimScopeLabel: "Тип беседы",
					trimScopeAll: "Все",
					trimScopeMain: "Только основные",
					trimScopeSubagent: "Только субагенты",
					trimArchiveLabel: "Архив",
					trimArchiveHide: "Скрыть архивные",
					trimArchiveShow: "Все беседы (с архивом)",
					trimArchiveOnly: "Только архивные",
					trimBadgeArchived: "архив",
					trimBadgeRootArchived: "архив вместе с основной",
					trimBadgeOrphan: "сирота",
					trimBadgeRootArchivedHint: "Относится к архивной основной беседе (архивация не затрагивает субагентов)",
					trimBadgeSubagent: "субагент",
					trimGroupCount: "Бесед: {n} · отмечено {selected}",
					trimDelete: "Удалить беседу",
					trimDeleteBlockedActive: "Активную беседу удалить нельзя — сначала отправьте её в архив в DSH",
					trimDeleteBlockedLive: "Выполняется, удалить нельзя",
					trimDeleteBlockedParent: "Основная беседа ещё не в архиве — сначала заархивируйте её",
					trimDeleteConfirmTitle: "Удалить эту беседу?",
					trimDeleteConfirmBody: "«{title}» переместится в корзину и её можно будет восстановить в течение {days} дней; затем она будет удалена окончательно.",
					trimDeleteChildren: "Её субагентские беседы ({n}) удалятся вместе с ней (и вернутся вместе при восстановлении).",
					trimDeleteConfirmOk: "В корзину",
					trimDeleteCancel: "Отмена",
					trimDeleteDone: "Перемещено в корзину: {n} бесед(ы), восстановление доступно {days} дней",
					trimDeleteFailed: "Не удалось удалить: {detail}",
					trimDeletedEmpty: "Корзина пуста",
					trimDeletedHint: "Удалённые беседы хранятся {days} дней. При открытии этого списка просроченные удаляются окончательно.",
					trimDeletedAt: "удалено {date}",
					trimDeletedRemaining: "осталось {n} дн.",
					trimDeletedRestore: "Восстановить",
					trimRestoreDone: "Восстановлено бесед: {n}",
					trimRestoreFailed: "Не удалось восстановить: {detail}",
					trimDeletedPurged: "Окончательно удалено {n} элемент(ов) старше {days} дней"
				}
			},
			{
				id: "pt",
				label: "Português (Brasil)",
				dict: {
					nav: "未必科幻MBSF",
					configurableCardTitle: "未必科幻",
					configurableCardDescription: "Configurações locais de execução — as mudanças valem na hora; só as marcadas com “após reiniciar” precisam de reinício.",
					loading: "Lendo…",
					error: "Falha ao ler. Tente de novo mais tarde.",
					retry: "Tentar de novo",
					version: "Versão",
					brain: "Banco de memórias",
					encoder: "Codificação de linguagem",
					sessions: "Sessões",
					seeded: "Memórias antigas importadas",
					trackedSessions: "Sessões registradas",
					globalEma: "Média geral",
					none: "Nenhum",
					compression: "Compressão",
					never: "Ainda não comprimido",
					messages: "Mensagens",
					compressed: "Comprimidas",
					preserved: "Mantidas",
					tailFpSegments: "Fragmentos",
					textChars: "Caracteres",
					compressions: "Compressões",
					emaMs: "Tempo médio",
					lastMs: "Último tempo",
					compressionLine: "Compressão",
					compressionLineHint: "Compressões acumuladas nesta sessão: vezes · mensagens dobradas · último tempo · há quanto tempo",
					compressionJustNow: "agora mesmo",
					compressionMinutesAgo: "há {n} min",
					compressionHoursAgo: "há {n} h",
					compressionHistory: "Histórico de compressões",
					historyEmpty: "Esta sessão ainda não foi comprimida",
					memoryIndex: "Índice de memória",
					topics: "Tópicos",
					totalRefs: "Entradas",
					sessionRefs: "De sessões",
					fileRefs: "De arquivos",
					nestedTopics: "Tópicos mesclados",
					initialized: "Pronto",
					segments: "Conteúdo",
					segmentCount: "Segmentos",
					totalLines: "Linhas",
					totalBytes: "Tamanho",
					injection: "Memórias trazidas",
					calls: "Avaliações",
					needInjected: "Trazida direto",
					weakInjected: "Trazida em parte",
					injected: "Itens trazidos",
					injectedChars: "Caracteres trazidos",
					recall: "Consultas",
					needTrue: "Trazida direto",
					needFalse: "Trazida em parte",
					expanded: "Expandido",
					expandedChars: "Caracteres expandidos",
					growth: "Crescimento da memória",
					gMessages: "Mensagens guardadas",
					gDuplicate: "Repetições mescladas",
					gChainMerge: "Similares mesclados",
					gNewTopic: "Tópicos novos",
					gShadowed: "Ignoradas",
					gNestEdge: "Vínculos criados",
					gNestHot: "Ligado a tópicos frequentes",
					gNestArch: "Ligado a tópicos antigos",
					injectEnabled: "Trazer memórias",
					injectEnabledHint: "Antes de cada passo, traz de volta memórias relacionadas ao que já foi conversado. Desligado por padrão.",
					autoCompact: "Compressão automática",
					autoCompactHint: "Quando a conversa fica longa, as partes antigas são resumidas para economizar contexto. Desligado, a compressão só acontece quando o espaço acaba.",
					compactTailMessages: "Mensagens recentes mantidas",
					compactTailMessagesHint: "Quantas mensagens recentes permanecem sempre como texto original (8–256, padrão 12). Um piso rígido: as mensagens mais recentes nunca são dobradas no resumo; apenas as mais antigas podem ser compactadas.",
					dateAnchorEnabled: "Data de hoje",
					dateAnchorEnabledHint: "Na primeira conversa do dia, avisa o modelo de que dia é hoje, para ele não adivinhar pelo contexto. Ligado por padrão.",
					restartCleanupEnabled: "Limpar ao reiniciar",
					restartCleanupEnabledHint: "Ao reiniciar, também enxuga tudo: apaga as saídas antigas do assistente e corta a conversa mais antiga, em todas as sessões. Desligado, é só reiniciar — mais rápido.",
					cleanupPruneTurns: "Turnos de conversa a manter",
					cleanupPruneTurnsHint: "0 = não mexe na conversa, só apaga as saídas antigas do assistente. Com N, mantém pelo menos os últimos N turnos (na prática costuma ser mais).",
					backupKeepCount: "Backups por sessão",
					backupKeepCountHint: "Antes de qualquer mudança é feito um backup; aqui você define quantos guardar, para poder voltar atrás se algo quebrar. 0 = guarda todos.",
					restartButtonVisible: "Mostrar o botão “Reiniciar DSH”",
					restartButtonVisibleHint: "Mostra um botão de reiniciar nesta página, para liberar memória na mão ou carregar uma versão nova. Todas as sessões caem por um instante.",
					sessionStreamKeepCount: "Saídas do assistente a manter",
					sessionStreamKeepCountHint: "Quantas das saídas mais recentes ficam na limpeza (padrão 200), para você ainda conferir os últimos turnos. 0 = apaga todas.",
					restartDsh: "Reiniciar DSH",
					restartDshHint: "Reinicia agora. Todas as sessões caem por um instante e a resposta em andamento é interrompida. A limpeza acima também roda, se estiver ligada.",
					restartSent: "Reinício solicitado…",
					restartFailed: "Falha ao pedir o reinício",
					dshHeapMb: "Limite de memória",
					dshHeapMbHint: "Quanta memória o DSH pode usar depois de reiniciar. Com históricos longos o padrão não basta e o processo quebra. Vale depois de reiniciar. 0 = padrão do sistema.",
					autoReclaimEnabled: "Liberar memória quando ocioso",
					autoReclaimEnabledHint: "Só quando nada está rodando, descarta dados temporários que podem ser refeitos. Limpar durante o trabalho não adianta — a próxima consulta já os reconstrói. Nada é apagado; só a primeira consulta depois fica mais lenta. Desligado por padrão.",
					autoReclaimThresholdPct: "Quando liberar memória",
					autoReclaimThresholdPctHint: "Começa a limpar neste percentual da memória realmente disponível, então cada instalação se ajusta sozinha. Baixo demais limpa o tempo todo; alto demais só age quando a queda é iminente. 60% é um bom valor.",
					autoReclaimNever: "Ainda não disparou",
					autoReclaimReasonEmergency: "Memória apertada: limpou sem esperar a ociosidade",
					autoReclaimLast: "Última liberação automática",
					reclaimTitle: "Liberar memória agora",
					reclaimButton: "Liberar memória",
					reclaimRunning: "Limpando…",
					reclaimHint: "Descarta dados temporários que podem ser refeitos, liberando memória (cerca de 1,3 GB, em uns 0,1 s). A primeira consulta depois fica mais lenta (cerca de 1,4 s) e então volta ao normal. Nada é apagado.",
					reclaimFailed: "Falha na limpeza",
					dshHeapUsed: "Memória em uso",
					dshHeapRestartHint: "Definido {configured}, em uso agora {live} — vale depois de reiniciar.",
					dshHeapAtLimit: "Quase cheio — aumente o limite e reinicie",
					overridden: "Alterado",
					save: "Salvar",
					discard: "Descartar",
					saved: "Salvo",
					saving: "Salvando…",
					unsaved: "Alterações não salvas",
					saveFailed: "Falha ao salvar",
					retrySave: "Tentar guardar novamente",
					brandCopyright: "© 2026 未必科幻 MAYBE SCI-FI",
					brandCompany: "宁夏未必科幻文化有限公司 · 保留所有权利",
					restartCleanupDanger: "⚠️ A limpeza apaga o histórico de saídas e a conversa mais antiga de todas as sessões. O que for apagado não volta — resumos e memórias guardam só a ideia geral, não o texto original.",
					cardHint: "As configurações ficam em ~/.mbsf/config.json e valem na hora.",
					trimTitle: "Enxugar histórico da conversa",
					trimHintLead: "⚠ Somente ao reiniciar: o corte acontece ao reiniciar, não durante a execução.",
					trimHint: "As sessões marcadas são enxugadas ao reiniciar: as saídas antigas do assistente são apagadas e a conversa mais antiga é cortada, ficando só a parte recente. As não marcadas não são tocadas.",
					trimGlobalWins: "A opção “Limpar ao reiniciar” acima está ligada, então todas as sessões são limpas e marcar aqui não muda nada. Desligue aquela opção primeiro para limpar por sessão.",
					trimOn: "Ativado",
					trimOff: "Desativado",
					trimOffHint: "Desativado — nenhuma conversa é cortada ao reiniciar. Ative para configurar.",
					trimListLoading: "Listando sessões…",
					trimListFailed: "Não foi possível ler a lista de sessões",
					trimEmpty: "Nenhuma sessão para enxugar",
					trimSelectAll: "Marcar todas",
					trimClearAll: "Desmarcar todas",
					trimSummary: "{n} sessões marcadas · {size} no total",
					trimNeverTrimmed: "Nunca",
					trimLastFreed: "{size} liberados",
					trimRefresh: "Atualizar",
					sessionIdLabel: "Sessão",
					sessionIdCopy: "Copiar ID da sessão",
					sessionIdCopied: "Copiado",
					sessionIdCopyFailed: "Falha ao copiar — selecione manualmente",
					close: "Fechar",
					floatingPanelButton: "Ajustes da sessão",
					floatingPanelTitle: "未必科幻MBSF",
					sessionInject: "Trazer memórias",
					sessionInjectHint: "Se memórias relacionadas são trazidas nesta sessão. Sem alteração, segue a sessão pai ou a configuração global.",
					sessionDateAnchor: "Data de hoje",
					sessionDateAnchorHint: "Se o modelo é avisado da data nesta sessão. Sem alteração, segue a sessão pai ou a configuração global.",
					sessionAutoCompact: "Compressão automática",
					sessionAutoCompactHint: "Se conversas longas nesta sessão são resumidas automaticamente. Sem alteração, segue a sessão pai ou a configuração global; desligado, a compressão só acontece quando o espaço acaba.",
					sessionInheritedParent: "Seguindo a sessão pai",
					sessionInheritedGlobal: "Seguindo a configuração global",
					sessionInheritedHint: "O valor atual vem de outro lugar; tocar num interruptor define isso só para esta sessão.",
					activityRead: "Recordando",
					activityWrite: "Gravando",
					activityCompact: "Comprimindo",
					activityHint: "O que está acontecendo agora — leitura, escrita ou compressão",
					activityIndicator: "Animação de atividade",
					activityIndicatorHint: "Mostra o que está rodando como uma gota girando em volta do ícone. Desligado, o ícone fica parado.",
					activityLabel: "Texto da atividade",
					activityLabelHint: "Mostra a ação atual em texto ao lado do ícone. Independente da animação — uma diz se algo está rodando, a outra diz o quê.",
					diagIdle: "Teste de inatividade",
					diagFree: "livre",
					diagBusy: "ocupado",
					diagInflight: "em curso",
					diagPhase: "fase",
					diagHost: "host",
					diagHostNone: "sem sondagem de host",
					diagHistorical: "histórico arquivado",
					diagSessionTypes: "formatos de sessão",
					diagKnowsNew: "reconhece o formato novo ✓",
					diagUnknownNew: "✗ não reconhece o formato novo (o enxugar vai pular tudo)",
					timeSecondsAgo: "há {n} s",
					trimSearchPlaceholder: "Buscar ID da sessão / área de trabalho",
					trimFilterAll: "Todas",
					trimFilterSelected: "Marcadas",
					trimFilterUnselected: "Não marcadas",
					trimSortMtime: "Último uso",
					trimSortCreated: "Criação",
					trimSortSize: "Tamanho",
					trimSortPath: "Área de trabalho",
					trimSortToggle: "Alternar ordem crescente/decrescente",
					trimNoMatch: "Nenhuma sessão corresponde ao filtro",
					trimViewSummary: "Mostrando {shown} de {total}",
					trimCopyId: "Copiar ID da sessão",
					trimScopeNote: "A seleção vale apenas para as sessões listadas",
					trimTabSessions: "Conversas",
					trimTabDeleted: "Excluídas",
					trimGroupByLabel: "Agrupar",
					trimGroupWorkspace: "Por espaço de trabalho",
					trimGroupTree: "Árvore de espaços",
					trimGroupFlat: "Uma única lista",
					trimScopeLabel: "Tipo de conversa",
					trimScopeAll: "Todas",
					trimScopeMain: "Somente principais",
					trimScopeSubagent: "Somente subagentes",
					trimArchiveLabel: "Arquivadas",
					trimArchiveHide: "Ocultar arquivadas",
					trimArchiveShow: "Tudo (mostrar arquivadas)",
					trimArchiveOnly: "Somente arquivadas",
					trimBadgeArchived: "arquivada",
					trimBadgeRootArchived: "arquivada com a principal",
					trimBadgeOrphan: "órfã",
					trimBadgeRootArchivedHint: "Pertence a uma conversa principal arquivada (o arquivamento não inclui subagentes)",
					trimBadgeSubagent: "subagente",
					trimGroupCount: "{n} conversas · {selected} marcadas",
					trimDelete: "Excluir conversa",
					trimDeleteBlockedActive: "Uma conversa ativa não pode ser excluída — arquive-a no DSH primeiro",
					trimDeleteBlockedLive: "Em execução, não pode excluir",
					trimDeleteBlockedParent: "A conversa principal ainda não foi arquivada — arquive-a primeiro",
					trimDeleteConfirmTitle: "Excluir esta conversa?",
					trimDeleteConfirmBody: "“{title}” vai para a lixeira e pode ser restaurada por {days} dias; depois é apagada de vez.",
					trimDeleteChildren: "As {n} conversas de subagentes dela também serão excluídas (e voltam juntas ao restaurar).",
					trimDeleteConfirmOk: "Mover para a lixeira",
					trimDeleteCancel: "Cancelar",
					trimDeleteDone: "Movida para a lixeira: {n} conversa(s), restaurável por {days} dias",
					trimDeleteFailed: "Não foi possível excluir: {detail}",
					trimDeletedEmpty: "A lixeira está vazia",
					trimDeletedHint: "Conversas excluídas ficam por {days} dias. Ao abrir esta lista, as vencidas são apagadas de vez.",
					trimDeletedAt: "excluída em {date}",
					trimDeletedRemaining: "faltam {n} dias",
					trimDeletedRestore: "Restaurar",
					trimRestoreDone: "{n} conversa(s) restaurada(s)",
					trimRestoreFailed: "Não foi possível restaurar: {detail}",
					trimDeletedPurged: "{n} item(ns) com mais de {days} dias apagado(s) de vez"
				}
			}
		];
		//#endregion
		//#region lib/types/client/SessionSwitches.js
		/**
		* 会话级注入开关——控制器与类型（UI 落点见 MbsfFloatingPanel 🐾 浮窗）
		*
		* 会话配置覆盖（2026-09-02 一帆固化——子代理/分叉会话默认继承父会话设置）：
		*  - 两个开关：记忆浮现（injectEnabled）、日期锚（dateAnchorEnabled）。
		*  - 即时保存：切换即经 sessionConfig/set 写 host（sessions.json），回读
		*    确认生效值。
		*  - 继承指示：effective 值来自本会话覆盖时显示开关；来自父链/全局时显示
		*    「继承」badge，点击开关即为本会话写入覆盖（反相生效值）。
		*  - 引擎解析链：会话显式覆盖 > parentSession 链 > 全局 config.json。
		*
		* 2026-09-02 落点修正：原「选项卡环 trailing seat」在官方 ui-conversation
		* 无渲染位（插件侧 declare 的 slot 名 shell 不 renderSlot，组件永不渲染），
		* UI 已迁至官方 `conversation.input.left` 浮窗（MbsfFloatingPanel）；
		* 本文件保留控制器/状态类型供两处共用。
		*
		* Remote 契约与 engine status-gateway 的 STATUS_CONTRIBUTION 对称
		* （见 mbsf-remote.ts）。远程不可用 → available=false → UI 不渲染。
		*/
		/** 首拉完成前的占位生效值（与全局默认同向：注入关、锚开、自动压缩开、指示器开）。 */
		const EMPTY_EFFECTIVE = {
			injectEnabled: false,
			dateAnchorEnabled: true,
			autoCompact: true,
			activityIndicatorEnabled: true,
			activityLabelEnabled: true
		};
		/** 一个会话的开关控制器：持有 Remote + sessionId，即时读写并广播快照。 */
		var SessionSwitchesController = class {
			remote;
			sessionId;
			listeners = /* @__PURE__ */ new Set();
			state = {
				available: false,
				loading: true,
				saving: false,
				failed: false,
				effective: EMPTY_EFFECTIVE,
				inheritedFrom: "global",
				compressionBrief: null
			};
			/** 请求序号：并发刷新只采纳最新（去抖过期响应）。 */
			seq = 0;
			constructor(remote, sessionId) {
				this.remote = remote;
				this.sessionId = sessionId;
			}
			/** 构建快照 store 并触发首拉。 */
			bind() {
				const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.state);
				this.listeners.add(() => {
					store.set(this.state);
				});
				this.refresh();
				return store;
			}
			/** 把一次「全局档位可能变了」的信号接进来（订阅设置文档的变更）。
			*
			*  ── 为什么需要（2026-10-14 修「关掉还在动」的第三个成因）──────────────
			*  `bind()` 只在**首次挂载**时拉一次 `sessionState`，之后再不刷新。而
			*  `activityIndicatorEnabled` / `activityLabelEnabled` 是**全局档**（不做
			*  会话覆盖，见 session-override.ts），改它们走的是设置页 → settings 文档
			*  → 引擎 runtime-config 那条路——**与浮窗的 Remote 拉取无关**。
			*
			*  ⟹ 结果：用户在设置页关掉动画，浮窗**毫不知情**，`state.effective` 还是
			*  挂载那一刻的旧值，动画照旧播——「关掉了还在动」。这不是渲染 bug，是
			*  **状态新鲜度**问题：数据源变了，消费方没有重新取。
			*
			*  ── 为什么刷两次（不是一次）────────────────────────────────────────
			*  写入链路是**跨层**的，有先后：
			*    设置页 → settings 文档（`scope.set` 解析）
			*           → loader `_commitVolatile()` 更新 volatile 引用
			*           → 引擎 `syncLiveConfig()` → `setRuntimeConfig()` 更新内存单例
			*  `sessionState()` 读的是**最后那步**的内存单例。若 `scope.set()` 一解析
			*  就立刻拉，可能拿到**同步尚未完成**的旧值（时序取决于 loader 实现，不是
			*  契约保证的）。
			*
			*  所以：**立即拉一次**（快路径——多数情况下同步已完成）+ **延迟再拉一次**
			*  （兜底——覆盖「同步稍后完成」）。两次都是单次往返，且只在用户改配置时
			*  发生（不是轮询）；设置改动本就低频，多一次往返换确定性，值得。 */
			watchSettings(scope) {
				if (scope === void 0) return;
				let pending = false;
				scope.subscribe(() => {
					if (pending) return;
					pending = true;
					this.refresh();
					window.setTimeout(() => {
						pending = false;
						this.refresh();
					}, 150);
				});
			}
			/** 拉取最新会话配置状态。 */
			async refresh() {
				if (this.remote === void 0) return;
				const seq = ++this.seq;
				try {
					const result = await this.remote.sessionState(this.sessionId);
					if (seq !== this.seq) return;
					if (result.ok) this.apply(result.value);
					else this.state = {
						...this.state,
						available: false,
						loading: false,
						failed: true
					};
				} catch {
					if (seq === this.seq) this.state = {
						...this.state,
						loading: false,
						failed: true
					};
				}
				this.publish();
			}
			/** 切换一个开关（写覆盖，即时生效）。 */
			async toggle(field) {
				if (this.remote === void 0 || this.state.saving) return;
				this.state = {
					...this.state,
					saving: true,
					failed: false
				};
				this.publish();
				const partial = { [field]: !this.state.effective[field] };
				try {
					const result = await this.remote.sessionSet(this.sessionId, partial);
					if (result.ok) this.apply(result.value);
					else this.state = {
						...this.state,
						saving: false,
						failed: true
					};
				} catch {
					this.state = {
						...this.state,
						saving: false,
						failed: true
					};
				}
				this.publish();
			}
			/** 清除本会话覆盖（恢复继承/全局）。 */
			async clear() {
				if (this.remote === void 0 || this.state.saving) return;
				this.state = {
					...this.state,
					saving: true,
					failed: false
				};
				this.publish();
				try {
					const result = await this.remote.sessionClear(this.sessionId);
					if (result.ok) this.apply(result.value);
					else this.state = {
						...this.state,
						saving: false,
						failed: true
					};
				} catch {
					this.state = {
						...this.state,
						saving: false,
						failed: true
					};
				}
				this.publish();
			}
			/** 应用 host 返回的配置状态（可用即消除失败标记）。 */
			apply(value) {
				this.state = {
					available: true,
					loading: false,
					saving: false,
					failed: false,
					effective: value.effective,
					inheritedFrom: value.inheritedFrom,
					compressionBrief: value.compressionBrief ?? null
				};
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region lib/types/client/brand.js
		/**
		* 品牌资源按界面语言选择（2026-11-07 一帆：「双语言界面根据中英文自动换中英文 logo」）。
		*
		* 不猜语言、不读 navigator.language——语言只有一处真相：DSH 的 locale 服务。
		* 注册侧把它的 getSnapshot / subscribe 注入进来（`ctx.locale`），组件这里只做
		* `useSyncExternalStore` 订阅：用户在设置里切语言 → 立刻换图，不需要刷新。
		*/
		/** 当前语言对应的品牌 logo（data URL）。中文 = 未必科幻，英文 = MBSF，其余回落中文。 */
		function useBrandLogo(face) {
			return selectBrandLogo((0, react.useSyncExternalStore)(face.subscribe, face.getId, face.getId));
		}
		/** 纯函数形态（测试与无 React 场景用）。 */
		function selectBrandLogo(localeId) {
			return localeId.trim().toLowerCase().startsWith("en") ? MBSF_LOGO_EN_DATA_URL : MBSF_LOGO_ZH_DATA_URL;
		}
		/** 球半径。 */
		const DOT = 1.9;
		/** 球心轨道半径 = 13 + 1.6 + 1.9 = 16.5px。 */
		const ORB_R = 16.5;
		/** 尾宽剖面指数：1 = 直线尖锥（水滴）。 */
		const TAIL_P = .9;
		/** 尾尖宽度 / 球半径。 */
		const TIP_W = .05;
		/** 整条水滴的不透明度。 */
		const HEAD_A = .88;
		/** 渐淡时尾尖的残余不透明度。 */
		const TIP_A = .06;
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
		const INK_LIGHT = "24,24,27";
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
		const K_SQ = 1.7;
		/** 压缩形变周期（ms）——与轨道周期不同，避免两通道锁相。 */
		const SQ_MS = 1400;
		/** 淡入时长（秒）。 */
		const FADE_IN = .25;
		/**
		* 淡出时长的**下限**（秒）——「边动态边淡」的最短观感长度。
		*
		* ⚠ 三轮起余韵时长**不再是常数**：球要从当前位置走到**下一个顶部**，
		* 走多久就淡多久（`fadeOut = max(FADE_OUT_MIN, 距离 × SEC_PER_TURN)`）
		* ⟹ 走到顶部与淡到 0 **同时发生**（终点必然在正上方）。
		* 距离很短时用这个下限兜底，避免「一闪就没」。
		*/
		const FADE_OUT_MIN = .45;
		/** 尾长生长起点（秒）——T₀ 之前只有基础尾。 */
		const T0 = 3.5;
		/** 基础尾出生时长（秒）——「一动就有尾巴」。 */
		const T_BORN = .25;
		/** 文字亮度上升时间常数（秒）——快。 */
		const GLOW_ATTACK = .1;
		/** 文字亮度下降时间常数（秒）——比上升慢（一帆：「暗的时候可以比明的时候稍慢些」）。 */
		const GLOW_RELEASE = .3;
		/** 一圈秒数——对齐 DSH 既有指示器节奏（1.2s）。 */
		const SEC_PER_TURN = 1.2;
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
		const TOP_PHASE = .75;
		/** 到达顶部的容差（圈）——小于它即视为已到达（浮点累积误差）。 */
		const TOP_EPS = 1e-6;
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
		const MIN_COMPACT_MS = SQ_MS;
		/**
		* 按动作取「最短显示时长」——形态不同，该看的时长也不同。
		*
		* @param act - 动作形态（`idle` 无意义——调用方不应在空闲时问）。
		* @returns 该动作至少应显示的毫秒数。
		*/
		function minActMs(act) {
			return act === "compact" ? MIN_COMPACT_MS : 400;
		}
		/** 方向：读顺时针（屏幕坐标 y 向下 ⟹ 角度递增 = 视觉顺时针）/ 写逆时针 / 压不动。 */
		const DIRS = {
			read: 1,
			write: -1,
			compact: 0,
			idle: 0
		};
		/**
		* 从 `u` 沿 **+1** 方向走，遇到的第一个顶部相位（≥ u，含自身）。
		*
		* 「顶部」= `TOP_PHASE + 整数`（相位每加 1 圈回到同一点）。
		* `TOP_EPS` 让「已经在顶部」判定不受浮点累积影响（否则会白走一整圈）。
		*/
		function topAtOrAfter(u) {
			return TOP_PHASE + Math.ceil(u - TOP_PHASE - TOP_EPS);
		}
		/** 从 `u` 沿 **−1** 方向走，遇到的第一个顶部相位（≤ u，含自身）。 */
		function topAtOrBefore(u) {
			return TOP_PHASE - Math.ceil(TOP_PHASE - u - TOP_EPS);
		}
		/** 是否已在顶部（含浮点容差）。 */
		function atTop(u) {
			const d = ((u - TOP_PHASE) % 1 + 1) % 1;
			return d < TOP_EPS || d > 1 - TOP_EPS;
		}
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
		function settled(s) {
			return !s.active && s.vis <= 0;
		}
		/**
		* 从 `u` 到顶部**最短**该走哪个方向（+1 / −1）；已在顶部 ⟹ 0。
		*
		* 压缩自己没有方向（`DIRS.compact = 0`），但「压缩要发生在顶部」——
		* 若球不在顶部（读/写途中切到压缩），就走最短的那半圈上去。
		*/
		function shortestToTop(u) {
			const d = ((u - TOP_PHASE) % 1 + 1) % 1;
			if (d < TOP_EPS || d > 1 - TOP_EPS) return 0;
			return d <= .5 ? -1 : 1;
		}
		/** 新状态（未启动）。 */
		function createState() {
			return {
				u: TOP_PHASE,
				vis: 0,
				active: false,
				act: "idle",
				dir: 0,
				arc: 0,
				frozenArc: 0,
				elapsed: 0,
				clock: 0,
				glow: 0,
				fadeOut: FADE_OUT_MIN,
				fadeFrom: TOP_PHASE,
				fadeTurns: 0,
				fadeElapsed: 0,
				fadeVis0: 0
			};
		}
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
		function tailLen(T) {
			if (T <= 0) return 0;
			const born = Math.min(T / T_BORN, 1);
			const grow = Math.sqrt(Math.min(Math.max((T - T0) / (30 - T0), 0), 1));
			const base = 26 / 150;
			return born * (base + (1 - base) * grow);
		}
		/**
		* 尾长 → 实际跨角（度）。
		* @param T - 已进行秒数。
		* @returns 跨角（度）。
		*/
		function tailArc(T) {
			return 150 * tailLen(T);
		}
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
		function glowAt(u) {
			const toward = Math.max(0, Math.cos(u * 2 * Math.PI));
			return Math.pow(toward, 3);
		}
		/**
		* 平面圆周上的位置（单位圆）。
		* @param u - 相位（圈，可为负）。
		* @returns 单位圆上的点。
		*/
		function orbitAt(u) {
			const th = u * 2 * Math.PI;
			return {
				x: Math.cos(th),
				y: Math.sin(th)
			};
		}
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
		function beginActivity(s, act) {
			if (act === "idle") return;
			s.active = true;
			s.act = act;
			s.dir = act === "compact" ? shortestToTop(s.u) : DIRS[act];
			s.elapsed = 0;
			s.arc = null;
			s.frozenArc = 0;
		}
		/**
		* 动作结束（活动投影回到「无」）——冻结尾跨角，进入余韵。
		*
		* 冻结的意义：尾形**不塌回光球**。淡出期继续按上一动作的方向走，
		* 但尾巴长度停在动作末帧的值（「余韵留在运动里，不是停在静止里」）。
		*
		* @param s - 状态。
		*/
		function endActivity(s) {
			if (!s.active) return;
			s.active = false;
			s.arc = s.frozenArc;
			const dir = s.dir !== 0 ? s.dir : 0;
			const target = dir > 0 ? topAtOrAfter(s.u) : dir < 0 ? topAtOrBefore(s.u) : s.u;
			s.fadeFrom = s.u;
			s.fadeTurns = target - s.u;
			s.fadeElapsed = 0;
			s.fadeVis0 = s.vis;
			s.fadeOut = Math.max(FADE_OUT_MIN, Math.abs(s.fadeTurns) * SEC_PER_TURN);
		}
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
		function advance(s, dt) {
			s.clock += dt;
			if (s.active) {
				s.elapsed += dt;
				s.frozenArc = s.act === "read" || s.act === "write" ? tailArc(s.elapsed) : 0;
				s.vis = Math.min(1, s.vis + dt / FADE_IN);
				if (s.act === "compact") {
					if (!atTop(s.u)) {
						s.u += dt * s.dir / SEC_PER_TURN;
						if (atTop(s.u)) {
							s.u = TOP_PHASE + Math.round(s.u - TOP_PHASE);
							s.dir = 0;
						}
					}
				} else if (s.dir !== 0) s.u += dt * s.dir / SEC_PER_TURN;
			} else if (s.vis > 0) {
				s.fadeElapsed += dt;
				const p = Math.min(1, s.fadeElapsed / s.fadeOut);
				s.u = s.fadeFrom + s.fadeTurns * p;
				s.vis = s.fadeVis0 * (1 - p);
				if (p >= 1) {
					s.u = s.fadeFrom + s.fadeTurns;
					s.vis = 0;
				}
			}
			const glowTarget = s.vis > 0 ? glowAt(s.u) : 0;
			const glowRate = dt / (glowTarget > s.glow ? GLOW_ATTACK : GLOW_RELEASE);
			s.glow = glowTarget > s.glow ? Math.min(glowTarget, s.glow + glowRate) : Math.max(glowTarget, s.glow - glowRate);
		}
		/** 画球（可带形变）。`sx`/`sy` = 横/竖半轴相对 DOT 的倍率。 */
		function drawBall(ctx, c, R, u, alpha, sx, sy, ink) {
			if (alpha <= .004) return;
			const p = orbitAt(u);
			ctx.beginPath();
			ctx.ellipse(c + p.x * R, c + p.y * R, DOT * sx, DOT * sy, 0, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(${ink},${(HEAD_A * alpha).toFixed(3)})`;
			ctx.fill();
		}
		/**
		* 画水滴 = 球 ∪ 尾巴。
		*
		* **单条闭合路径、单次 fill**——分两次画会让重叠处 alpha 叠深，接缝处留
		* 一条黑边。`dir` = +1 顺时针 / −1 逆时针：尾巴永远拖在行进反方向。
		*/
		function drawDrop(ctx, c, R, uHead, arcTail, dir, alpha, ink) {
			if (alpha <= .004) return;
			const steps = Math.max(24, Math.round(arcTail / 1.5));
			const span = arcTail / 360 * 2 * Math.PI;
			const a0 = uHead * 2 * Math.PI;
			const aTip = a0 - dir * span;
			const OUT = [];
			const IN = [];
			let tipCx = 0, tipCy = 0, tipHw = 0;
			for (let i = 0; i <= steps; i++) {
				const t = i / steps;
				const ang = a0 - dir * span * (1 - t);
				const cx = c + Math.cos(ang) * R;
				const cy = c + Math.sin(ang) * R;
				const hw = DOT * (TIP_W + (1 - TIP_W) * Math.pow(t, TAIL_P));
				const nx = Math.cos(ang);
				const ny = Math.sin(ang);
				OUT.push([cx + nx * hw, cy + ny * hw]);
				IN.push([cx - nx * hw, cy - ny * hw]);
				if (i === 0) {
					tipCx = cx;
					tipCy = cy;
					tipHw = hw;
				}
			}
			const hx = c + Math.cos(a0) * R;
			const hy = c + Math.sin(a0) * R;
			ctx.beginPath();
			const out0 = OUT[0];
			ctx.moveTo(out0[0], out0[1]);
			for (let i = 1; i <= steps; i++) {
				const p = OUT[i];
				ctx.lineTo(p[0], p[1]);
			}
			ctx.arc(hx, hy, DOT, a0, a0 + dir * Math.PI, dir < 0);
			for (let i = steps; i >= 0; i--) {
				const p = IN[i];
				ctx.lineTo(p[0], p[1]);
			}
			ctx.arc(tipCx, tipCy, tipHw, aTip, aTip - dir * Math.PI, dir > 0);
			ctx.closePath();
			const g = ctx.createLinearGradient(tipCx, tipCy, hx, hy);
			g.addColorStop(0, `rgba(${ink},${(HEAD_A * TIP_A * alpha).toFixed(3)})`);
			g.addColorStop(1, `rgba(${ink},${(HEAD_A * alpha).toFixed(3)})`);
			ctx.fillStyle = g;
			ctx.fill();
		}
		/**
		* 画一帧。
		*
		* @param ctx - 2D 上下文。
		* @param size - canvas 逻辑边长（= `CV`）。
		* @param eff - backing store 倍率（devicePixelRatio × 放大倍数）。
		* @param s - 状态。
		*/
		function drawFrame(ctx, size, eff, s, ink = INK_LIGHT) {
			ctx.setTransform(eff, 0, 0, eff, 0, 0);
			ctx.clearRect(0, 0, size, size);
			if (s.vis <= .004) return;
			const c = size / 2;
			const R = ORB_R;
			if (s.act === "compact") {
				if (atTop(s.u)) {
					const e = Math.cos(s.clock / (SQ_MS / 1e3) * 2 * Math.PI);
					drawBall(ctx, c, R, s.u, s.vis, Math.pow(K_SQ, e), Math.pow(K_SQ, -e), ink);
				} else drawBall(ctx, c, R, s.u, s.vis, 1, 1, ink);
				return;
			}
			const arcTail = s.arc ?? (s.act === "read" || s.act === "write" ? tailArc(s.elapsed) : 0);
			if (arcTail > 2) drawDrop(ctx, c, R, s.u, arcTail, s.dir, s.vis, ink);
			else drawBall(ctx, c, R, s.u, s.vis, 1, 1, ink);
		}
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
		function drawStaticFrame(ctx, size, eff, act, ink = INK_LIGHT) {
			const s = createState();
			s.active = true;
			s.act = act === "idle" ? "read" : act;
			s.dir = DIRS[s.act];
			s.vis = 1;
			s.u = TOP_PHASE;
			s.elapsed = T0;
			s.clock = 0;
			drawFrame(ctx, size, eff, s, ink);
		}
		//#endregion
		//#region \0dsh-css:/Users/ai/Desktop/未必科幻 Harness/mbsf-split/03-dsh/src/client/MbsfFloatingPanel.module.css.mjs
		const css = "._3OvdYq_button{cursor:pointer;background:var(--dsw-specific-input-major);border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;width:26px;height:26px;padding:0;font-size:15px;line-height:1;display:inline-flex;position:relative}._3OvdYq_button:hover{background:var(--dsw-alias-interactive-bg-hover)}._3OvdYq_button:focus-visible{outline:1px solid var(--dsw-alias-border-inverted);outline-offset:1px}._3OvdYq_paw{object-fit:cover;user-select:none;-webkit-user-drag:none;mix-blend-mode:multiply;border-radius:50%;width:100%;height:100%;display:block}body[data-ds-dark-theme] ._3OvdYq_paw{filter:invert();mix-blend-mode:screen}._3OvdYq_button:hover ._3OvdYq_paw{opacity:.85}._3OvdYq_dot{background:var(--dsw-alias-state-error-primary);border-radius:50%;width:7px;height:7px;position:absolute;top:1px;right:1px}._3OvdYq_panel{z-index:1100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);min-width:232px;max-width:min(340px,100vw - 24px);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;gap:8px;padding:10px 12px;font-size:13px;display:flex;position:fixed;transform:translateY(-6px)}._3OvdYq_header{justify-content:space-between;align-items:center;gap:8px;display:flex}._3OvdYq_title{font-weight:600}._3OvdYq_close{cursor:pointer;width:20px;height:20px;color:inherit;opacity:.7;background:0 0;border:none;border-radius:6px;flex:none;justify-content:center;align-items:center;padding:0;font-size:14px;line-height:1;display:inline-flex}._3OvdYq_close:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover)}._3OvdYq_sessionIdRow{align-items:center;gap:6px;min-width:0;display:flex}._3OvdYq_sessionId{font-family:var(--dsh-mono-font,ui-monospace, SFMono-Regular, Menlo, monospace);color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;font-size:11px;overflow:hidden}._3OvdYq_copyId{width:18px;height:18px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;font-size:12px;line-height:1;transition:background .12s,color .12s;display:inline-flex}._3OvdYq_copyId:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}._3OvdYq_copyId:active{transform:scale(.92)}._3OvdYq_copyIdDone{color:var(--dsw-alias-state-success-primary,#2ea043)}._3OvdYq_copyIdFailed{color:var(--dsw-alias-state-error-primary,#d1242f)}._3OvdYq_switchRow{cursor:pointer;user-select:none;justify-content:space-between;align-items:center;gap:10px;display:flex}._3OvdYq_switchRow:hover ._3OvdYq_switchLabel{color:var(--dsw-alias-label-primary-bluish)}._3OvdYq_switchLabel{flex:1;transition:color .1s}._3OvdYq_switchRow input[type=checkbox]{opacity:0;pointer-events:none;width:0;height:0;position:absolute}._3OvdYq_track{box-sizing:border-box;background:var(--dsw-alias-interactive-bg-hover-solid);border-radius:999px;flex:none;align-items:center;width:30px;height:18px;padding:2px;transition:background .12s;display:inline-flex}._3OvdYq_thumb{background:var(--dsw-alias-label-primary-inverted);border-radius:50%;width:14px;height:14px;transition:transform .12s}._3OvdYq_switchRow input:checked+._3OvdYq_track{background:var(--dsw-alias-brand-primary)}._3OvdYq_switchRow input:checked+._3OvdYq_track ._3OvdYq_thumb{transform:translate(12px)}._3OvdYq_switchRow input:disabled+._3OvdYq_track{opacity:.5}._3OvdYq_inherited{color:var(--dsw-alias-label-tertiary);font-size:11px}._3OvdYq_failed{color:var(--dsw-alias-state-error-primary);font-size:11px}._3OvdYq_compressionLine{color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:baseline;gap:10px;padding:2px 0;font-size:11px;display:flex}._3OvdYq_compressionLabel{flex:none}._3OvdYq_compressionValue{font-family:var(--dsh-mono-font,ui-monospace, SFMono-Regular, Menlo, monospace);color:var(--dsw-alias-label-secondary);white-space:nowrap}._3OvdYq_seat{flex:none;align-items:center;gap:7px;display:inline-flex}._3OvdYq_droplet{pointer-events:none;position:absolute;top:-7px;left:-7px}._3OvdYq_activityLabel{text-overflow:ellipsis;white-space:nowrap;--glow:0;max-width:88px;color:color-mix(in srgb, var(--dsw-alias-label-primary) calc(var(--glow) * 100%), var(--dsw-alias-label-secondary));pointer-events:none;user-select:none;flex:none;font-size:11px;line-height:1;overflow:hidden}";
		const tagId = "mbsf-compaction/MbsfFloatingPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "mbsf-compaction";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MbsfFloatingPanel_module_css_default = {
			"track": "_3OvdYq_track",
			"droplet": "_3OvdYq_droplet",
			"header": "_3OvdYq_header",
			"close": "_3OvdYq_close",
			"dot": "_3OvdYq_dot",
			"sessionId": "_3OvdYq_sessionId",
			"copyId": "_3OvdYq_copyId",
			"copyIdFailed": "_3OvdYq_copyIdFailed",
			"switchRow": "_3OvdYq_switchRow",
			"compressionLine": "_3OvdYq_compressionLine",
			"copyIdDone": "_3OvdYq_copyIdDone",
			"title": "_3OvdYq_title",
			"failed": "_3OvdYq_failed",
			"compressionLabel": "_3OvdYq_compressionLabel",
			"seat": "_3OvdYq_seat",
			"thumb": "_3OvdYq_thumb",
			"panel": "_3OvdYq_panel",
			"activityLabel": "_3OvdYq_activityLabel",
			"button": "_3OvdYq_button",
			"inherited": "_3OvdYq_inherited",
			"paw": "_3OvdYq_paw",
			"switchLabel": "_3OvdYq_switchLabel",
			"sessionIdRow": "_3OvdYq_sessionIdRow",
			"compressionValue": "_3OvdYq_compressionValue"
		};
		//#endregion
		//#region lib/types/client/MbsfFloatingPanel.js
		/** 面板与视口边缘的最小间距（px）——夹取用。 */
		const PANEL_MARGIN = 12;
		/** A 方案压缩摘要行（常驻浮窗）：`压缩 3 次 · 减 27 条 · 1.2s · 5分钟前`。
		*
		*  数据 = 本会话折叠简报（sessionState 顺带返回，零额外请求）。无折叠
		*  记录 → 返回 null（整行不渲染，不留「未压缩过」的噪声占位）。
		*  时间只用相对量级（刚刚 / N 分钟前 / N 小时前），不给绝对时刻——浮窗
		*  只需「新鲜度」。 */
		function CompressionLine({ brief, t }) {
			if (brief == null || brief.folds <= 0) return null;
			const seconds = Math.max(0, Math.round((Date.now() - brief.lastAt) / 1e3));
			const ago = seconds < 60 ? t("compressionJustNow") : seconds < 3600 ? t("compressionMinutesAgo").replace("{n}", String(Math.floor(seconds / 60))) : t("compressionHoursAgo").replace("{n}", String(Math.floor(seconds / 3600)));
			const ms = brief.lastMs >= 1e3 ? `${(brief.lastMs / 1e3).toFixed(1)}s` : `${brief.lastMs}ms`;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MbsfFloatingPanel_module_css_default.compressionLine,
				title: t("compressionLineHint"),
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: MbsfFloatingPanel_module_css_default.compressionLabel,
					children: t("compressionLine")
				}), (0, react_jsx_runtime.jsxs)("span", {
					className: MbsfFloatingPanel_module_css_default.compressionValue,
					children: [
						brief.folds,
						" · −",
						brief.compressedTotal,
						" · ",
						ms,
						" · ",
						ago
					]
				})]
			});
		}
		/** 活动 → 动画类别 + 文案键（三类 = 工程切面，见 mbsf-activity.ts 头注）。
		*
		*  ⚠️ 本表键 = `MBSF_TOOLS` 的 wire 短名（不是工具全名）——**必须与 host 侧
		*  表逐项对齐**：`recall` 一格覆盖 `mbsf_recall` + `mbsf_recall_content`（同族）。
		*  漏一格的后果 = `activityFace` 兜底成「回忆中」文案（动画还对，文字错），
		*  静默降级不报错 ⟹ `tests/droplet.spec.ts` 有清单断言守这一致性。 */
		const ACTIVITY_FACE = {
			recall: {
				face: "read",
				label: "activityRead"
			},
			walk: {
				face: "read",
				label: "activityRead"
			},
			wengu: {
				face: "read",
				label: "activityRead"
			},
			get: {
				face: "read",
				label: "activityRead"
			},
			around: {
				face: "read",
				label: "activityRead"
			},
			describe: {
				face: "read",
				label: "activityRead"
			},
			generate: {
				face: "read",
				label: "activityRead"
			},
			nominate: {
				face: "write",
				label: "activityWrite"
			},
			forget: {
				face: "write",
				label: "activityWrite"
			},
			compact: {
				face: "compact",
				label: "activityCompact"
			}
		};
		/**
		* 活动粘滞值——活动结束后仍保留一小段，让水滴播完「出生段 + 一点余韵」。
		*
		* 抽成 hook 是因为**水滴与文字渲染在两个不同位置**：水滴必须在按钮**内部**
		* （绝对定位覆盖图标），文字必须在按钮**外部**（按钮是 26px 圆形，
		* `border-radius: 50%` 会把文字裁掉）。两处需要共享同一个粘滞状态，故状态
		* 提升到父组件，本 hook 只管算。
		*
		* ## 为什么需要「最短显示时长」
		*
		* 闪的本质是**动画被打断**，不是出现得快。快速调用（缓存命中 ~50ms）若按
		* 真实时长渲染，水滴只长到基础尾的 1/5 就被撤掉——视觉上就是一次抖动。所以：
		*
		*   · **出现：立即**（零延迟——用户感知到「引擎在动」越早越好）
		*   · **消失：至少保持该形态的最短时长**（读/写 `MIN_ACT_MS` 400ms；
		*     压缩 `MIN_COMPACT_MS` 1400ms——够播完一个完整形变周期，见 `minActMs`）
		*
		* 只有一个定时器，管消失不管出现。这样 50ms 的缓存命中也能看到一次完整的
		* 「出现 → 长尾 → 收束」，**比延迟出现更灵敏**（延迟治的是错病——用户会
		* 以为界面卡了）。
		*
		* @param activity - host 投影推送的当前活动（`null` = 空闲）。
		* @param sessionId - 当前会话标识（**必须**传：`epoch` 是会话内计数，
		*   换会话会回退，基线要按会话重建——见下方 `baseRef` 注释）。
		* @returns 应当显示的粘滞活动（`null` = 无内容可显示）。
		*/
		function useStickyActivity(wire, sessionId) {
			const [sticky, setSticky] = (0, react.useState)(null);
			const epochRef = (0, react.useRef)(-1);
			const faceRef = (0, react.useRef)("read");
			const sinceRef = (0, react.useRef)(0);
			const baseRef = (0, react.useRef)(null);
			const cur = wire ?? null;
			const epoch = cur?.epoch ?? -1;
			const active = cur?.current ?? null;
			const last = cur?.last ?? null;
			(0, react.useEffect)(() => {
				if (cur === null) return;
				if (baseRef.current === null || baseRef.current.sessionId !== sessionId) {
					baseRef.current = {
						sessionId,
						epoch
					};
					if (active === null) {
						epochRef.current = epoch;
						setSticky(null);
						return;
					}
				}
				if (epoch !== epochRef.current) {
					epochRef.current = epoch;
					const began = active ?? last;
					if (began === null) return;
					sinceRef.current = Date.now();
					faceRef.current = ACTIVITY_FACE[began.tool]?.face ?? "read";
					setSticky(began);
					if (active === null) {
						const timer = window.setTimeout(() => {
							setSticky(null);
						}, minActMs(faceRef.current));
						return () => {
							window.clearTimeout(timer);
						};
					}
					return;
				}
				if (active !== null) return;
				const shown = Date.now() - sinceRef.current;
				const timer = window.setTimeout(() => {
					setSticky(null);
				}, Math.max(0, minActMs(faceRef.current) - shown));
				return () => {
					window.clearTimeout(timer);
				};
			}, [
				cur,
				epoch,
				active,
				last,
				sessionId
			]);
			return sticky;
		}
		/** 把粘滞活动解析成「形态 + 文案」（未知工具按读处理，不外泄错误）。 */
		function activityFace(sticky, t) {
			const entry = ACTIVITY_FACE[sticky.tool];
			return {
				label: entry === void 0 ? t("activityRead") : t(entry.label),
				act: entry?.face ?? "read"
			};
		}
		/**
		* 当前是否深色主题——读 `body[data-ds-dark-theme]`（ui-theme 的 boot 脚本
		* 与 ThemePresenter 共同维护的那个标记），并用 MutationObserver 跟随切换。
		*
		* 为什么不走 `ctx.theme` 服务：本组件在 `conversation.input.left` 槽位，
		* 只拿到 `PropsRuntime` + locale + 开关注入面，没有 theme 服务的引用；
		* 而深色标记是**写在 DOM 上**的公开事实（官方 `ui-deliverables` 等包也直接
		* 用 CSS `:global(body[data-ds-dark-theme])` 读它）⟹ 读 DOM 与官方做法一致。
		*/
		function useIsDarkTheme() {
			const read = () => typeof document !== "undefined" && document.body.hasAttribute("data-ds-dark-theme");
			const [dark, setDark] = (0, react.useState)(read);
			(0, react.useEffect)(() => {
				const observer = new MutationObserver(() => {
					setDark(read());
				});
				observer.observe(document.body, {
					attributes: true,
					attributeFilter: ["data-ds-dark-theme"]
				});
				setDark(read());
				return () => {
					observer.disconnect();
				};
			}, []);
			return dark;
		}
		/**
		* 活动指示器——🐾 图标上的水滴（2026-10-14 三轮：canvas 替换 CSS 环）。
		*
		* ## 两个开关，完全独立（2026-10-14 一帆定）
		*
		* 「一个开关单独控制动画，一个开关单独控制文字提示」——动画回答**有没有
		* 在动**，文字回答**在动什么**，两者可任意组合（只看动画 / 只看文字 /
		* 都看 / 都不看）。
		*
		* ## 结构：水滴在按钮内、文字在按钮外
		*
		* 按钮是 26px 圆形（`border-radius: 50%`）——文字放进去会被圆角裁掉。故：
		*   · 水滴 = 按钮的子节点（绝对定位覆盖图标，`left/top: −7px`）
		*   · 文字 = 按钮的兄弟（`css.seat` 包裹，行内并排）
		*
		* 文字占**行内空间**（不是绝对定位）：宁可让工具行轻微让位，也不让文字浮在
		* 相邻控件上面——composer 工具行里覆盖式提示会挡住隔壁按钮，更难读。
		*
		* ⚠ **canvas 是 40px，比按钮大 14px**：球的轨道在图标外侧
		* （`ORB_R = 16.5`，见 `droplet.ts`），必须画出按钮边界。祖先链上任何
		* `overflow: hidden` 都会切掉球——composer 卡片与 `.seat` 实测无裁剪，
		* 但改 composer 样式的人需要知道这里有个溢出 7px 的画布。
		*
		* 数据来自 host 投影 `mbsfActivity`（框架原生 push 通道，零轮询）。
		* `useProjection` 由 slot `scope: 'session'` 自动供上。
		*
		* ## 生命周期归水滴自己管（2026-10-14 四轮·修一个真实故障）
		*
		* 旧写法靠「`act` 变 `'idle'` 就调 `endActivity`」——但 `act` 是**形态**
		* （`ACTIVITY_FACE` 只产出 read / write / compact），`'idle'` 永远不来；
		* 而活动一消失组件就**整个卸载**，rAF 随之停 ⟹ `endActivity` 一次都没
		* 跑过 ⟹ **余韵、锚顶、边淡边走全部落空**（球只会硬生生消失）。
		*
		* 现在：活动消失时传 `'idle'` 进来、**不卸载**，由水滴跑完余韵后经
		* `onSettled` 通知父组件摘画布。
		*
		* ⚠ **文字亮度（`--glow`）也在这里写**：水滴每帧把 `state.glow` 写到
		* 文字节点的 CSS 变量（`glowRef`）。走 DOM 直写而不是 React state——60fps
		* 的 setState 会拖着整棵子树重渲染，而这个值只影响一个颜色。
		*/
		function ActivityDroplet({ act, ink, glowRef, onSettled }) {
			const canvasRef = (0, react.useRef)(null);
			const actRef = (0, react.useRef)(act);
			actRef.current = act;
			const inkRef = (0, react.useRef)(ink);
			inkRef.current = ink;
			const settledRef = (0, react.useRef)(onSettled);
			settledRef.current = onSettled;
			(0, react.useEffect)(() => {
				const canvas = canvasRef.current;
				if (canvas === null) return;
				const ctx = canvas.getContext("2d");
				if (ctx === null) return;
				const dpr = Math.min(window.devicePixelRatio || 1, 3);
				canvas.width = 40 * dpr;
				canvas.height = 40 * dpr;
				if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true) {
					drawStaticFrame(ctx, 40, dpr, actRef.current, inkRef.current);
					return;
				}
				const state = createState();
				let prevAct = "idle";
				let started = false;
				let lastGlow = "";
				let last = performance.now();
				let raf = 0;
				const tick = (now) => {
					const dt = Math.min((now - last) / 1e3, .08);
					last = now;
					const next = actRef.current;
					if (next !== prevAct) {
						if (next === "idle") endActivity(state);
						else {
							beginActivity(state, next);
							started = true;
						}
						prevAct = next;
					}
					advance(state, dt);
					drawFrame(ctx, 40, dpr, state, inkRef.current);
					const glow = state.glow.toFixed(3);
					if (glow !== lastGlow) {
						lastGlow = glow;
						glowRef.current?.style.setProperty("--glow", glow);
					}
					if (started && settled(state)) {
						settledRef.current();
						return;
					}
					raf = requestAnimationFrame(tick);
				};
				raf = requestAnimationFrame(tick);
				return () => {
					cancelAnimationFrame(raf);
				};
			}, [glowRef]);
			return (0, react_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: MbsfFloatingPanel_module_css_default.droplet,
				style: {
					width: 40,
					height: 40
				},
				"aria-hidden": "true"
			});
		}
		/** 活动文字（按钮外的兄弟节点）——见 `ActivityDroplet` 的「结构」说明。 */
		function ActivityLabel({ sticky, hasDroplet, t, spanRef }) {
			const { label } = activityFace(sticky, t);
			return (0, react_jsx_runtime.jsx)("span", {
				ref: spanRef,
				className: MbsfFloatingPanel_module_css_default.activityLabel,
				title: hasDroplet ? void 0 : `${label} ${t("activityHint")}`,
				children: label
			});
		}
		/** 🐾 浮窗按钮：点击展开会话级开关面板；再点 / 点外部 / Esc 关闭。 */
		function MbsfFloatingPanel(props) {
			const { t } = props;
			const logoSrc = useBrandLogo(props.brandLocale);
			const state = props.useSessionSwitches((snapshot) => snapshot);
			const [anchor, setAnchor] = (0, react.useState)(null);
			const buttonRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			/**
			* 会话 ID 复制反馈（2026-11-02 一帆：会话 ID 在面板里显示却复制不到，
			* 右侧应有个复制按钮）。
			*
			* 三态而非布尔：`idle → copied|failed → idle`。必须用定时器回落到 idle——
			* 纯布尔会在「复制成功」后永远显示 ✓，用户下次再看就分不清这一次到底
			* 复制了没有。`copyTimerRef` 存句柄：连续点击时先清旧定时器，否则上一次
			* 的回落会把这一次刚亮的 ✓ 提前抹掉。
			*/
			const [copyState, setCopyState] = (0, react.useState)("idle");
			const copyTimerRef = (0, react.useRef)(null);
			const sticky = useStickyActivity(props.useProjection("mbsfActivity"), props.sessionId);
			const isDark = useIsDarkTheme();
			const labelRef = (0, react.useRef)(null);
			/**
			* 是否还在**余韵中**——活动已消失，但水滴正走完到顶部的最后一程。
			*
			* ⚠ 存在的理由：活动消失后若立刻卸载画布，rAF 随之停 ⟹ `endActivity`
			* 的余韵永远跑不完（这正是「球硬生生消失」的成因）。故画布要多留一会，
			* 由水滴经 `onSettled` 回报「跑完了」才摘。
			*/
			const [residual, setResidual] = (0, react.useState)(false);
			const onSettled = (0, react.useCallback)(() => {
				setResidual(false);
			}, []);
			const hasActivity = sticky !== null;
			(0, react.useEffect)(() => {
				if (hasActivity) setResidual(true);
			}, [hasActivity]);
			/**
			* 量按钮视口 rect → 面板锚点。
			*
			* ⚠ **锚点必须是视口坐标**，而这只在面板被 **portal 到 `document.body`**
			* 时才成立。官方 composer 的输入区在激活态带
			* `will-change: transform`（asar 内 ui-conversation 的 `.composerSeat`
			* `[data-phase=active]` 规则）——CSS 规定这会为后代建立 containing block，
			* 留在原地渲染的 `position: fixed` 面板于是改以 composer 卡片为参照，
			* 被摆到卡片左下角（= 切换模型那一带；2026-11-06 一帆实测「弹窗偏移到
			* 切换模型的地方」正是此因）。另外 composer 外层还有 `overflow:hidden`，
			* 不 portal 时面板稍高一点就会被裁。
			*
			* 结论：`fixed` + portal 是一对**契约**——只留其一就错位，别改回裸渲染。
			*/
			const measureAnchor = (0, react.useCallback)(() => {
				const el = buttonRef.current;
				if (el === null) return null;
				const rect = el.getBoundingClientRect();
				return {
					left: rect.left,
					bottom: window.innerHeight - rect.top
				};
			}, []);
			const toggle = (0, react.useCallback)(() => {
				if (anchor !== null) {
					setAnchor(null);
					return;
				}
				const next = measureAnchor();
				if (next !== null) setAnchor(next);
			}, [anchor, measureAnchor]);
			const open = anchor !== null;
			(0, react.useEffect)(() => {
				if (!open) return;
				const sync = () => {
					const next = measureAnchor();
					if (next === null) return;
					setAnchor((prev) => prev !== null && prev.left === next.left && prev.bottom === next.bottom ? prev : next);
				};
				window.addEventListener("resize", sync);
				window.addEventListener("scroll", sync, true);
				return () => {
					window.removeEventListener("resize", sync);
					window.removeEventListener("scroll", sync, true);
				};
			}, [open, measureAnchor]);
			const [panelWidth, setPanelWidth] = (0, react.useState)(0);
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				const el = panelRef.current;
				if (el === null) return;
				setPanelWidth(el.offsetWidth);
			}, [open, anchor]);
			(0, react.useEffect)(() => {
				if (anchor === null) return;
				const onDown = (event) => {
					const target = event.target;
					if (target === null) return;
					if (buttonRef.current?.contains(target) === true) return;
					if (panelRef.current?.contains(target) === true) return;
					setAnchor(null);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setAnchor(null);
				};
				document.addEventListener("mousedown", onDown, true);
				document.addEventListener("keydown", onKey, true);
				return () => {
					document.removeEventListener("mousedown", onDown, true);
					document.removeEventListener("keydown", onKey, true);
				};
			}, [anchor]);
			/**
			* 复制会话 ID（2026-11-02）。
			*
			* 为什么不用 `navigator.clipboard` 单条路：桌面壳（Electron）在非安全
			* 上下文 / 缺权限时 `navigator.clipboard` 为 `undefined` 或直接 reject，
			* 而这条信息是用户**唯一**能定位会话的坐标（会话目录名就是它）——
			* 复制失败必须让用户看见，不能静默。
			*
			* 三级兜底：① Clipboard API（现代、无副作用）→ ② 隐藏 textarea +
			* `document.execCommand('copy')`（旧壳 / 无权限）→ ③ 失败态（按钮转红，
			* 用户至少知道没复制上，可以手动选中）。
			*/
			const copySessionId = (0, react.useCallback)(() => {
				const text = props.sessionId;
				const settle = (ok) => {
					if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
					setCopyState(ok ? "copied" : "failed");
					copyTimerRef.current = setTimeout(() => {
						setCopyState("idle");
						copyTimerRef.current = null;
					}, ok ? 1200 : 2e3);
				};
				const fallback = () => {
					try {
						const area = document.createElement("textarea");
						area.value = text;
						area.setAttribute("readonly", "");
						area.style.position = "fixed";
						area.style.top = "-9999px";
						area.style.opacity = "0";
						document.body.appendChild(area);
						area.select();
						const ok = document.execCommand("copy");
						document.body.removeChild(area);
						return ok;
					} catch {
						return false;
					}
				};
				const clip = navigator.clipboard;
				if (clip === void 0) {
					settle(fallback());
					return;
				}
				clip.writeText(text).then(() => {
					settle(true);
				}, () => {
					settle(fallback());
				});
			}, [props.sessionId]);
			(0, react.useEffect)(() => () => {
				if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
			}, []);
			if (!state.available) return null;
			const inherited = state.inheritedFrom !== "session";
			const showDroplet = state.effective.activityIndicatorEnabled;
			const showLabel = state.effective.activityLabelEnabled;
			const face = sticky === null ? null : activityFace(sticky, t);
			return (0, react_jsx_runtime.jsxs)("span", {
				className: MbsfFloatingPanel_module_css_default.seat,
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						ref: buttonRef,
						type: "button",
						className: MbsfFloatingPanel_module_css_default.button,
						onClick: toggle,
						"aria-label": t("floatingPanelButton"),
						"aria-expanded": anchor !== null,
						title: t("floatingPanelTitle"),
						children: [
							(0, react_jsx_runtime.jsx)("img", {
								src: logoSrc,
								className: MbsfFloatingPanel_module_css_default.paw,
								alt: "",
								"aria-hidden": "true",
								draggable: false
							}),
							state.failed && (0, react_jsx_runtime.jsx)("span", {
								className: MbsfFloatingPanel_module_css_default.dot,
								"aria-hidden": "true"
							}),
							showDroplet && (face !== null || residual) && (0, react_jsx_runtime.jsx)(ActivityDroplet, {
								act: face === null ? "idle" : face.act,
								ink: isDark ? "249,250,251" : "24,24,27",
								glowRef: labelRef,
								onSettled
							})
						]
					}),
					showLabel && sticky !== null && (0, react_jsx_runtime.jsx)(ActivityLabel, {
						sticky,
						hasDroplet: showDroplet,
						t,
						spanRef: labelRef
					}),
					anchor !== null && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
						ref: panelRef,
						className: MbsfFloatingPanel_module_css_default.panel,
						style: {
							left: Math.min(Math.max(PANEL_MARGIN, anchor.left), Math.max(PANEL_MARGIN, window.innerWidth - PANEL_MARGIN - panelWidth)),
							bottom: anchor.bottom
						},
						role: "dialog",
						"aria-label": t("floatingPanelTitle"),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: MbsfFloatingPanel_module_css_default.header,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: MbsfFloatingPanel_module_css_default.title,
									children: t("floatingPanelTitle")
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: MbsfFloatingPanel_module_css_default.close,
									onClick: () => setAnchor(null),
									"aria-label": t("close"),
									children: "×"
								})]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: MbsfFloatingPanel_module_css_default.sessionIdRow,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: MbsfFloatingPanel_module_css_default.sessionId,
									title: props.sessionId,
									children: [
										t("sessionIdLabel"),
										": ",
										props.sessionId
									]
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: copyState === "failed" ? `${MbsfFloatingPanel_module_css_default.copyId} ${MbsfFloatingPanel_module_css_default.copyIdFailed}` : copyState === "copied" ? `${MbsfFloatingPanel_module_css_default.copyId} ${MbsfFloatingPanel_module_css_default.copyIdDone}` : MbsfFloatingPanel_module_css_default.copyId,
									onClick: copySessionId,
									title: copyState === "copied" ? t("sessionIdCopied") : copyState === "failed" ? t("sessionIdCopyFailed") : t("sessionIdCopy"),
									"aria-label": t("sessionIdCopy"),
									"aria-live": "polite",
									children: copyState === "copied" ? "✓" : copyState === "failed" ? "!" : "⧉"
								})]
							}),
							(0, react_jsx_runtime.jsx)(CompressionLine, {
								brief: state.compressionBrief,
								t
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: MbsfFloatingPanel_module_css_default.switchRow,
								title: t("sessionInjectHint"),
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: MbsfFloatingPanel_module_css_default.switchLabel,
										children: t("sessionInject")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										role: "switch",
										checked: state.effective.injectEnabled,
										disabled: state.saving,
										onChange: () => {
											props.toggle("injectEnabled");
										}
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: MbsfFloatingPanel_module_css_default.track,
										"aria-hidden": "true",
										children: (0, react_jsx_runtime.jsx)("span", { className: MbsfFloatingPanel_module_css_default.thumb })
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: MbsfFloatingPanel_module_css_default.switchRow,
								title: t("sessionDateAnchorHint"),
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: MbsfFloatingPanel_module_css_default.switchLabel,
										children: t("sessionDateAnchor")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										role: "switch",
										checked: state.effective.dateAnchorEnabled,
										disabled: state.saving,
										onChange: () => {
											props.toggle("dateAnchorEnabled");
										}
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: MbsfFloatingPanel_module_css_default.track,
										"aria-hidden": "true",
										children: (0, react_jsx_runtime.jsx)("span", { className: MbsfFloatingPanel_module_css_default.thumb })
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: MbsfFloatingPanel_module_css_default.switchRow,
								title: t("sessionAutoCompactHint"),
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: MbsfFloatingPanel_module_css_default.switchLabel,
										children: t("sessionAutoCompact")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										role: "switch",
										checked: state.effective.autoCompact,
										disabled: state.saving,
										onChange: () => {
											props.toggle("autoCompact");
										}
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: MbsfFloatingPanel_module_css_default.track,
										"aria-hidden": "true",
										children: (0, react_jsx_runtime.jsx)("span", { className: MbsfFloatingPanel_module_css_default.thumb })
									})
								]
							}),
							inherited && (0, react_jsx_runtime.jsx)("div", {
								className: MbsfFloatingPanel_module_css_default.inherited,
								title: t("sessionInheritedHint"),
								children: state.inheritedFrom === "parent" ? t("sessionInheritedParent") : t("sessionInheritedGlobal")
							}),
							state.failed && (0, react_jsx_runtime.jsx)("div", {
								className: MbsfFloatingPanel_module_css_default.failed,
								children: t("saveFailed")
							})
						]
					}), document.body)
				]
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/**
		* 未必记忆设置面（浏览器半）——装配一条顶层设置页贡献：
		*
		* 「设置 → 未必记忆」顶层页：上半功能开关（记忆浮现 / γ 自动压缩，staged +
		* save），下半只读六块统计（Remote `mbsfStatus`）。
		*
		* Remote 契约手写于 mbsf-remote.ts（engine 是独立仓库，无法在 client 侧
		* import 其生成物；host 端 status-gateway 的 `@Remote('snapshot')` 与这里
		* 的 descriptor 是同一契约的两个半）。
		*/
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.electronicSheep";
		/** 0.1.7 的配置命名空间 = 引擎状态网关在 profile 里的 **loader entry id**
		*  （`- id: mbsf-status`）。0.1.7 的 settings 文档按 entry id 索引 namespace
		*  （`describe()` 里 `ns: entry.options.id`），而 schema 来自该 entry 的
		*  `static Config`（`MbsfStatusGateway.Config`）。
		*
		*  为什么不是 'mbsf'：那是 **0.1.5** 的 namespace——引擎在 0.1.5 下经
		*  `settings.register('mbsf', …)` 自报的名字，与宿主装配的 entry id 无关。
		*  两版用两个名字是结构使然（0.1.5 由插件自报、0.1.7 由宿主装配决定），
		*  所以适配层收 `{ legacy, modern }` 两个值。
		*
		*  ⚠️ 必须与 profile 里 `mbsf-status` 那一行的 id 保持一致；改装配 id 要
		*  同步改这里（否则卡片退回 `status: 'unavailable'`）。 */
		const MBSF_STATUS_ENTRY_ID = "mbsf-status";
		/**
		* Services required by the Settings registration and the mounted Remote.
		*
		* ⚠ `settingsScope` **刻意不在这里**（2026-09-27 小爪）。它是 0.1.5 的客户端
		* 设置服务；app 版（DSH 0.1.7-rc.2）没有它。Cordis 的 `Fiber._refresh()` 逐
		* 个检查 `Object.keys(this.inject)`，缺一个就永远停在 `INACTIVE` —— 这正是
		* 2026-09-26 app 启动日志里那条
		* `@deepseek-ai/dsh-client-ui-settings-mbsf: pending (waiting for service: settingsScope)`
		* 的根因，整条插件（含状态页、🐾 浮窗）因此从未激活。
		*
		* 改成运行时用 `ctx.get` 探测（无 inject 守卫，取不到即 undefined），
		* 由 settings-adapter 决定走 0.1.5 的 settingsScope 还是 0.1.7 的 configForms。
		*/
		const inject = [
			"slots",
			"locale",
			"remote"
		];
		/**
		* Mount the MBSF Remote, then contribute the top-level settings
		* section (switches + status).
		* @param ctx - the browser plugin context.
		* @returns disposer after the Remote contribution and the section entry.
		*/
		async function apply(ctx) {
			const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
			const mbsfStatus = ctx.get("remote.mbsfStatus");
			const decodeSettings = decodeMbsfSettings;
			const scope = bindSettingsScope({
				settingsScope: ctx.get("settingsScope"),
				configForms: ctx.get("configForms")
			}, {
				legacy: ESHEEP_NS,
				modern: MBSF_STATUS_ENTRY_ID
			}, decodeSettings);
			const card = new MbsfCardController(scope);
			const mbsfCard = card.bind();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-mbsf: dictionaries");
			ctx.effect(() => {
				const disposers = [];
				for (const entry of INTL_DICTIONARIES) {
					try {
						disposers.push(ctx.locale.register(NS, entry.id, entry.dict));
					} catch {}
					try {
						disposers.push(ctx.locale.addLanguage({
							id: entry.id,
							label: entry.label,
							fallback: "en"
						}));
					} catch {}
				}
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-settings-mbsf: intl dictionaries");
			const t = ctx.locale.bind(NS);
			const brandLocale = {
				getId: () => ctx.locale.getSnapshot().active,
				subscribe: (fn) => ctx.locale.subscribe(fn)
			};
			const injected = {
				snapshot: async () => {
					const result = await mbsfStatus.snapshot();
					if (!result.ok) throw new Error(`mbsfStatus.snapshot failed: ${result.error.code}: ${result.error.message}`);
					const maxMb = result.value.heap?.maxMb;
					if (typeof maxMb === "number") card.setHeapMax(maxMb);
					const limitMb = result.value.heap?.limitMb;
					if (typeof limitMb === "number") card.setHeapLimit(limitMb);
					return result.value;
				},
				toggle: (field) => {
					card.toggle(field);
				},
				save: () => {
					card.save();
				},
				discard: () => {
					card.discard();
				},
				resetField: (field) => {
					card.resetField(field);
				},
				setNumber: (field, value) => {
					card.setNumber(field, value);
				},
				restartDsh: async () => {
					const result = await mbsfStatus.restart("");
					return result.ok ? result.value : {
						ok: false,
						detail: `${result.error.code}: ${result.error.message}`
					};
				},
				memoryReport: async () => {
					const result = await mbsfStatus.memoryReport();
					if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
					return result.value;
				},
				reclaimMemory: async () => {
					const result = await mbsfStatus.reclaimMemory();
					return result.ok ? result.value : {
						ok: false,
						reclaimed: 0,
						before: 0,
						after: 0,
						gcMs: 0,
						clearedEntries: {},
						detail: `${result.error.code}: ${result.error.message}`
					};
				},
				trimTargets: async () => {
					const result = await mbsfStatus.trimTargets();
					if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
					return result.value;
				},
				setTrimTarget: async (sessionId, selected) => {
					const result = await mbsfStatus.setTrimTarget({
						sessionId,
						selected
					});
					if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
				},
				trimDelete: async (sessionId) => {
					const result = await mbsfStatus.trimDelete({ sessionId });
					if (!result.ok) return {
						ok: false,
						deleted: [],
						bytes: 0,
						detail: `${result.error.code}: ${result.error.message}`
					};
					return result.value;
				},
				trimDeleted: async () => {
					const result = await mbsfStatus.trimDeleted();
					if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
					return result.value;
				},
				trimRestore: async (sessionId) => {
					const result = await mbsfStatus.trimRestore({ sessionId });
					if (!result.ok) return {
						ok: false,
						restored: [],
						detail: `${result.error.code}: ${result.error.message}`
					};
					return result.value;
				},
				hooks: { mbsfCard }
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "mbsf",
				order: 30,
				label: () => t("nav"),
				locale: NS,
				inject: () => injected
			}, MbsfSettingsSection));
			ctx.effect(() => watchNavIcon(() => t("nav")), "ui-settings-mbsf: nav icon");
			const sessionControllers = /* @__PURE__ */ new Map();
			const sessionStores = /* @__PURE__ */ new Map();
			const MAX_SESSION_SWITCH_STATES = 200;
			const sessionSwitchesFor = (sessionId) => {
				let controller = sessionControllers.get(sessionId);
				let store = sessionStores.get(sessionId);
				if (controller === void 0) {
					controller = new SessionSwitchesController(mbsfStatus, sessionId);
					controller.watchSettings(scope);
					sessionControllers.set(sessionId, controller);
					if (sessionControllers.size > MAX_SESSION_SWITCH_STATES) {
						const oldest = sessionControllers.keys().next().value;
						if (oldest !== void 0) {
							sessionControllers.delete(oldest);
							sessionStores.delete(oldest);
						}
					}
				}
				if (store === void 0) {
					store = controller.bind();
					sessionStores.set(sessionId, store);
				}
				return {
					controller,
					store
				};
			};
			const sessionSwitchesInjected = (sessionId) => {
				const { controller, store } = sessionSwitchesFor(sessionId);
				return {
					hooks: { sessionSwitches: store },
					toggle: (field) => {
						controller.toggle(field);
					},
					clear: () => {
						controller.clear();
					},
					brandLocale
				};
			};
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "mbsf-floating-panel",
				order: 100,
				locale: NS,
				inject: sessionSwitchesInjected
			}, MbsfFloatingPanel));
			return async () => {
				await unmount();
			};
		}
		//#endregion
		exports.MBSF_STATUS_ENTRY_ID = MBSF_STATUS_ENTRY_ID;
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map