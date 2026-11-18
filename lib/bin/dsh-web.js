#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { env, exit } from "node:process";
import { pathToFileURL } from "node:url";
//#region lib/types/bin/dsh-web.js
/**
* mbsf-dsh —— 未必记忆 DSH 引擎启动器（堆保障）
*
* 用户机器上的 DSH（@deepseek-ai/dsh 发行版）bin 不设堆上限：V8 默认
* old-space cap 约 4GiB（本机实测 4.2GiB），`dsh web` 加载会话归档 + 脑索引
* 时峰值可达数 GB → OOM abort 崩溃史（2026-08-31 三次 .ips 均
* FatalProcessOutOfMemory）。Node 的堆上限必须在进程启动前定
* （v8.setFlagsFromString 对 --max-old-space-size 无效），所以本启动器在
* spawn DSH 之前注入 NODE_OPTIONS。
*
* 用法:
*   mbsf-dsh web            # ≡ dsh web，但自带堆保障
*   mbsf-dsh <任意 dsh 参数>
*
* 行为:
*   - NODE_OPTIONS 已有 --max-old-space-size → 直通（尊重显式配置，不覆盖）
*   - 无 → 注入 ESHEEP_DSH_HEAP_MB（默认 8192）
*   - DSH_BIN 可显式指定 DSH bin（绝对路径或 PATH 名，默认 `dsh`）
*   - 退出码/信号透传
*
* @module mbsf-compaction/bin/dsh-web
*/
const DEFAULT_HEAP_MB = 8192;
/**
* 计算注入后的 NODE_OPTIONS。已有 --max-old-space-size 显式配置 → 原样直通；
* 否则追加（或新建）`--max-old-space-size=<heapMb>`。
*/
function computeNodeOptions(cur, heapMb) {
	if (cur && /(^|\s)--max-old-space-size=/.test(cur)) return cur;
	const injected = `--max-old-space-size=${heapMb}`;
	return cur ? `${cur} ${injected}` : injected;
}
/** spawn 参数（可测）。 */
function resolveSpawn(dshBin, args, heapMb) {
	const bin = dshBin ?? env.DSH_BIN ?? "dsh";
	const next = computeNodeOptions(env.NODE_OPTIONS, heapMb);
	return {
		bin,
		args,
		env: {
			...env,
			NODE_OPTIONS: next
		}
	};
}
/** 主入口：spawn DSH，透传 stdio 与退出码。返回子进程（可测）。 */
function main(argv) {
	const { bin, args, env: childEnv } = resolveSpawn(void 0, argv, env.ESHEEP_DSH_HEAP_MB ?? String(8192));
	const child = spawn(bin, args, {
		stdio: "inherit",
		env: childEnv
	});
	child.on("error", (err) => {
		console.error(`[mbsf-dsh] 无法启动 DSH bin (${bin}): ${err.message}\n  请确认已安装 @deepseek-ai/dsh（npm i -g @deepseek-ai/dsh），或用 DSH_BIN 指定路径。`);
		exit(1);
	});
	child.on("exit", (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		else exit(code ?? 1);
	});
	return child;
}
if (process.argv[1] !== void 0 && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
//#endregion
export { DEFAULT_HEAP_MB, computeNodeOptions, main, resolveSpawn };
