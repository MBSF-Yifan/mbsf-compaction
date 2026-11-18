#!/usr/bin/env node
import { chmod, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
//#region lib/types/bin/enable.js
/**
* 未必记忆 enable 命令 — 把某个 agent preset 的 compaction 后端切换到未必记忆
*
* 引擎本身零配置；在 DSH 里「启用」只差一处装配：preset 的 compaction
* group 里把 `compaction-basic` 替换为 `compaction-mbsf`。
* 本命令把这一行替换自动化（备份 + 幂等 + dry-run），不触碰 preset 的
* 任何其他段 —— Agent 配置不进插件，插件只提供引擎与这条装配工具。
*
* 用法:
*   mbsf-compaction enable [preset-id] [--dry-run] [--home <dir>]
*
* preset-id 缺省时：用户根下只有一个 preset 则默认它，多个则列出并报错。
*
* @module mbsf-compaction/bin/enable
*/
/** 用户 preset 根（与 dsh-agent-presets 的 USER_PRESET_DIR 一致）。 */
const USER_PRESET_DIR = ".agent-presets";
const BACKUP_SUFFIX = ".bak-mbsf";
/** 匹配 compaction-basic 的两行装配（`- id: <id>` + `name: '<pkg>'`），保留缩进。 */
const BASIC_ROW_RE = /^(\s*)- id: compaction-basic\s*\r?\n\s*name: '@deepseek-ai\/dsh-compaction-basic'\s*(?:\r?\n|$)/m;
/** 匹配已是未必记忆装配的两行（用于幂等判定）。 */
const SHEEP_ROW_RE = /^\s*- id: compaction-mbsf\s*\r?\n\s*name: 'mbsf-compaction(?:\/compaction)?'\s*(?:\r?\n|$)/m;
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
/**
* 纯文本替换：把 compaction-basic 装配行换成未必记忆装配行。
* 不引入 config —— thresholdRatio/retainRatio/auto 均有包内默认值，
* 需要覆写时用户在 preset 里自行加 config（与显式声明等价）。
*/
function applyEnable(text) {
	if (SHEEP_ROW_RE.test(text)) return {
		matched: false,
		alreadyEnabled: true,
		text
	};
	const hit = BASIC_ROW_RE.exec(text);
	if (hit === null) return {
		matched: false,
		alreadyEnabled: false,
		text
	};
	const indent = hit[1];
	const replacement = `${indent}- id: compaction-mbsf\n${indent}  name: 'mbsf-compaction/compaction'\n`;
	return {
		matched: true,
		alreadyEnabled: false,
		text: text.slice(0, hit.index) + replacement + text.slice(hit.index + hit[0].length)
	};
}
/** DSH home 解析：$DSH_HOME 优先，缺省 ~/.dsh（与 dsh-home-paths 同序）。 */
function dshHome(home) {
	return home !== void 0 ? resolve(home) : process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? resolve(process.env.DSH_HOME) : join(homedir(), ".dsh");
}
/**
* 列出用户根下的 preset id（仅目录，忽略非 preset-id 命名）。
* @returns 按 id 排序的目录名；根不存在时返回空数组。
*/
async function listUserPresets(home) {
	const root = join(dshHome(home), USER_PRESET_DIR);
	let children;
	try {
		children = await readdir(root, { withFileTypes: true });
	} catch {
		return [];
	}
	return children.filter((child) => child.isDirectory() && PRESET_ID_RE.test(child.name)).map((child) => child.name).sort();
}
/** 从全文里抽出被替换行的 id 片段（供 dry-run 展示）。 */
function replacedIdOf(text) {
	return text.split("\n").find((row) => row.includes("- id: compaction-"))?.trim() ?? "";
}
/**
* 对指定 preset 执行启用。preset-id 缺省时：用户根下唯一 preset 自动默认，
* 多个则报 no-preset 并在 message 里列出可用 id。
*/
async function enablePreset(id, options = {}) {
	const home = dshHome(options.home);
	const root = join(home, USER_PRESET_DIR);
	let preset = id;
	if (preset === void 0) {
		const presets = await listUserPresets(home);
		if (presets.length === 1) preset = presets[0];
		else if (presets.length === 0) return {
			status: "no-preset",
			preset: "",
			message: `用户根 ${root} 下没有 preset（先创建，或指定 preset-id）`
		};
		else return {
			status: "no-preset",
			preset: "",
			message: `用户根下有多个 preset，请指定 id：${presets.join("、")}`
		};
	}
	if (preset === void 0 || !PRESET_ID_RE.test(preset)) return {
		status: "no-preset",
		preset: preset ?? "",
		message: `非法 preset-id：${preset ?? ""}（须匹配 [a-z0-9][a-z0-9-]*）`
	};
	const file = join(root, preset, "agent.cordis.yml");
	let text;
	let mode;
	try {
		text = await readFile(file, "utf8");
		mode = (await stat(file)).mode & 511;
	} catch {
		return {
			status: "no-preset",
			preset,
			message: `找不到 composition：${file}`
		};
	}
	const { matched, alreadyEnabled, text: next } = applyEnable(text);
	if (alreadyEnabled) return {
		status: "already-enabled",
		preset,
		file,
		message: `${preset} 已装配未必记忆后端，无需改动`
	};
	if (!matched) return {
		status: "no-compaction-group",
		preset,
		file,
		message: `${preset} 的 composition 里没有 compaction-basic 装配。你的 preset 没有 compaction group（如 minimal）——在顶层手动加一段：
  - id: compaction
    name: cordis:group
    group: true
    isolate:
      compaction: true
      toolResultPruner: true
    config:
      - id: compaction-mbsf
        name: 'mbsf-compaction'
      - id: tool-result-pruner
        name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
        config:
          thresholdChars: 8192
          headChars: 4096
          tailChars: 1024`
	};
	const backupPath = file + BACKUP_SUFFIX;
	const lines = [replacedIdOf(text), replacedIdOf(next)];
	if (options.dryRun) return {
		status: "enabled",
		preset,
		file,
		lines,
		backupPath,
		message: `[dry-run] 将替换 ${preset}/agent.cordis.yml 的 compaction 后端为未必记忆`
	};
	await writeFile(backupPath, text, "utf8");
	await chmod(backupPath, mode ?? 384);
	const tmp = file + ".mbsf-tmp";
	await writeFile(tmp, next, "utf8");
	if (mode !== void 0) await chmod(tmp, mode);
	await rename(tmp, file);
	return {
		status: "enabled",
		preset,
		file,
		backupPath,
		lines,
		message: `已启用未必记忆后端：${preset}（备份：${backupPath}）—— 新会话生效`
	};
}
/** CLI 入口。返回进程退出码：0 = 成功/已启用/dry-run；1 = 找不到 preset、非法 id、无 compaction group。 */
async function main(argv) {
	let id;
	const options = {};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === void 0) break;
		if (arg === "--dry-run") options.dryRun = true;
		else if (arg === "--home") {
			const value = argv[i + 1];
			if (value === void 0) {
				process.stderr.write("--home 需要一个目录参数\n");
				return 1;
			}
			options.home = value;
			i += 1;
		} else if (arg.startsWith("-") || id !== void 0) {
			process.stderr.write(`未知参数：${arg}\n`);
			return 1;
		} else id = arg;
	}
	const outcome = await enablePreset(id, options);
	if (outcome.status === "enabled") {
		if (outcome.lines !== void 0 && options.dryRun) process.stdout.write(`  ${outcome.lines[0]}\n→ ${outcome.lines[1]}\n`);
		process.stdout.write(`${outcome.message}\n`);
		return 0;
	}
	process.stderr.write(`${outcome.message}\n`);
	return outcome.status === "already-enabled" ? 0 : 1;
}
/** ESM 入口检测：被 node 直接执行时启动 CLI。 */
if (process.argv[1] !== void 0 && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).then((code) => {
	process.exitCode = code;
}, (error) => {
	process.stderr.write(`enable 失败：${String(error)}\n`);
	process.exitCode = 1;
});
//#endregion
export { BACKUP_SUFFIX, USER_PRESET_DIR, applyEnable, dshHome, enablePreset, listUserPresets, main };
