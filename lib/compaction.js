import { createRequire } from "node:module";
import { homedir, totalmem } from "node:os";
import * as path from "node:path";
import { basename, dirname, join } from "node:path";
import * as fs from "node:fs";
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { BasicCompactionEngine } from "@deepseek-ai/dsh-compaction-basic";
import { toolPairingBalancedAfter } from "@deepseek-ai/dsh-compaction";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { Session } from "node:inspector";
import * as bundledCatalogPkg from "@deepseek-ai/dsh-session-format-catalog";
import { constants, zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { foldSurface } from "@deepseek-ai/dsh-session";
import "@deepseek-ai/dsh-session-persistence";
//#region ../02-packages/core/lib/vendor/encoder.js
/**
* Self-Encoding v7 — TL 塔旋转编码
*
* 视角: 文本 = 区分操作序列
*   字节 → 投影子选择 → ω += γ · Pω → normalize
*   γ ∝ 投影残差 (新信息多→大步, 已知→小步)
*
* 不同文本 = 不同字节序列 = 不同旋转方向 = 不同终端态
* 不同上下文 = 不同起始 ω = 同一文本走不同路径
*
* D = 233 (H_12 Bratteli 路径数)
* 投影子: NP = H_12 的 e_k + 级联嵌入桥
*
* 导出: { D, encode, cosineSimilarity, symmetricInitial, NP }
*   encode(text, omega0?) → { omega: number[], trace: {projIdx, gamma}[] }
*/
const φ = (1 + Math.sqrt(5)) / 2;
const φ_inv = φ - 1;
const μ = [
	1,
	φ,
	φ,
	1
];
function neighbors(v) {
	const n = [];
	if (v > 0) n.push(v - 1);
	if (v < 3) n.push(v + 1);
	return n;
}
function paths(n, s) {
	const p = [];
	(function w(v, h) {
		if (h.length === n + 1) {
			if (v === s) p.push(h.slice());
			return;
		}
		const ns = neighbors(v);
		for (let i = 0; i < ns.length; i++) {
			h.push(ns[i]);
			w(ns[i], h);
			h.pop();
		}
	})(0, [0]);
	return p;
}
function buildEk(ps, k) {
	const d = ps.length, m = [];
	for (let i = 0; i < d; i++) {
		m[i] = [];
		for (let j = 0; j < d; j++) m[i][j] = 0;
	}
	for (let i = 0; i < d; i++) {
		const p = ps[i];
		if (p[k - 1] === p[k + 1]) m[i][i] = μ[p[k]] / μ[p[k - 1]];
	}
	for (let i = 0; i < d; i++) for (let j = i + 1; j < d; j++) {
		let same = true;
		for (let pos = 0; pos < ps[i].length; pos++) if (pos !== k && ps[i][pos] !== ps[j][pos]) {
			same = false;
			break;
		}
		if (same) {
			const v = Math.sqrt(μ[ps[i][k]] * μ[ps[j][k]]) / μ[ps[i][k - 1]];
			m[i][j] = v;
			m[j][i] = v;
		}
	}
	return m;
}
function cellMod(n, s) {
	const ps = paths(n, s);
	if (ps.length === 0) return null;
	const pks = [];
	for (let k = 1; k < n; k++) {
		const ek = buildEk(ps, k);
		pks.push(ek.map((r) => r.map((c) => c / φ)));
	}
	return {
		level: n,
		sector: s,
		dim: ps.length,
		paths: ps,
		projs: pks
	};
}
function hN(n) {
	const mods = [];
	for (let s = 0; s <= 3; s++) {
		const cm = cellMod(n, s);
		if (cm) mods.push(cm);
	}
	let dim = 0;
	mods.forEach((m) => dim += m.dim);
	return {
		level: n,
		dim,
		modules: mods
	};
}
function inclusion(Hn, Hnp1) {
	const Dn = Hn.dim, Dnp1 = Hnp1.dim;
	const I = [];
	for (let i = 0; i < Dnp1; i++) {
		I[i] = [];
		for (let j = 0; j < Dn; j++) I[i][j] = 0;
	}
	let offSrc = 0;
	for (let mi = 0; mi < Hn.modules.length; mi++) {
		const src = Hn.modules[mi];
		for (let pi = 0; pi < src.paths.length; pi++) {
			const p = src.paths[pi], v = p[p.length - 1], nb = neighbors(v);
			for (let ni = 0; ni < nb.length; ni++) {
				const w = nb[ni], ep = p.concat([w]);
				let offDst = 0;
				for (let mj = 0; mj < Hnp1.modules.length; mj++) {
					const dst = Hnp1.modules[mj];
					for (let qi = 0; qi < dst.paths.length; qi++) if (dst.paths[qi].length === ep.length) {
						let match = true;
						for (let pos = 0; pos < ep.length; pos++) if (ep[pos] !== dst.paths[qi][pos]) {
							match = false;
							break;
						}
						if (match) I[offDst + qi][offSrc + pi] = Math.sqrt(μ[w] / μ[v]);
					}
					offDst += dst.dim;
				}
			}
		}
		offSrc += src.dim;
	}
	return I;
}
function matMul(A, B) {
	const n = A.length, m = B[0].length, l = B.length, C = [];
	for (let i = 0; i < n; i++) {
		C[i] = [];
		for (let j = 0; j < m; j++) {
			let s = 0;
			for (let k = 0; k < l; k++) s += A[i][k] * B[k][j];
			C[i][j] = s;
		}
	}
	return C;
}
function transp(M) {
	return M[0].map((_, i) => M.map((r) => r[i]));
}
function dot(a, b) {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}
function normV(v) {
	return Math.sqrt(dot(v, v));
}
function scaleV(v, s) {
	return v.map((x) => x * s);
}
function addV(a, b) {
	const r = [];
	for (let i = 0; i < a.length; i++) r[i] = a[i] + b[i];
	return r;
}
function subV(a, b) {
	const r = [];
	for (let i = 0; i < a.length; i++) r[i] = a[i] - b[i];
	return r;
}
const MAX_LEVEL = 12;
const Hs = {};
const Is = {};
for (let n = 4; n <= MAX_LEVEL; n++) Hs[n] = hN(n);
for (let n = 4; n < MAX_LEVEL; n++) Is[n] = inclusion(Hs[n], Hs[n + 1]);
const Htop = Hs[MAX_LEVEL];
const D = Htop.dim;
const allP = [];
let off = 0;
for (let mi = 0; mi < Htop.modules.length; mi++) {
	const mod = Htop.modules[mi];
	for (let k = 0; k < mod.projs.length; k++) {
		const emb = [];
		for (let i = 0; i < D; i++) {
			emb[i] = [];
			for (let j = 0; j < D; j++) emb[i][j] = 0;
		}
		for (let i = 0; i < mod.projs[k].length; i++) for (let j = 0; j < mod.projs[k][0].length; j++) emb[off + i][off + j] = mod.projs[k][i][j];
		const P = matMul(emb, emb);
		for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) if (Math.abs(P[r][c]) < 1e-14) P[r][c] = 0;
		allP.push(P);
	}
	off += mod.dim;
}
for (let n = 4; n < MAX_LEVEL; n++) if (Is[n]) {
	let result = matMul(Is[n], transp(Is[n]));
	for (let i = 0; i < result.length; i++) for (let j = 0; j < result[0].length; j++) result[i][j] /= φ;
	for (let l = n + 1; l < MAX_LEVEL; l++) {
		result = matMul(matMul(Is[l], result), transp(Is[l]));
		for (let i = 0; i < result.length; i++) for (let j = 0; j < result[0].length; j++) result[i][j] /= φ;
	}
	const P = matMul(result, result);
	for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) if (Math.abs(P[r][c]) < 1e-14) P[r][c] = 0;
	allP.push(P);
}
const NP = allP.length;
/**
* 将 D×D 稠密投影矩阵转为稀疏行表示
* 每行: [{ j: number, v: number }, ...]
*
* 98% 稀疏度 → 50x 矩阵-向量乘加速
*/
function sparsePrj(denseMat) {
	const rows = new Array(D);
	for (let i = 0; i < D; i++) {
		const row = [];
		for (let j = 0; j < D; j++) if (Math.abs(denseMat[i][j]) > 1e-14) row.push({
			j,
			v: denseMat[i][j]
		});
		rows[i] = row;
	}
	return rows;
}
function sparseApply(rows, v) {
	const res = new Array(D);
	for (let i = 0; i < D; i++) {
		let s = 0;
		const row = rows[i];
		for (let k = 0; k < row.length; k++) s += row[k].v * v[row[k].j];
		res[i] = s;
	}
	return res;
}
const allPsp = allP.map(sparsePrj);
function utf8Bytes(text) {
	const s = String(text);
	const bytes = [];
	for (let ci = 0; ci < s.length; ci++) {
		const cp = s.charCodeAt(ci);
		if (cp < 128) bytes.push(cp);
		else if (cp < 2048) {
			bytes.push(192 | cp >> 6);
			bytes.push(128 | cp & 63);
		} else if (cp < 65536) {
			bytes.push(224 | cp >> 12);
			bytes.push(128 | cp >> 6 & 63);
			bytes.push(128 | cp & 63);
		} else {
			bytes.push(240 | cp >> 18);
			bytes.push(128 | cp >> 12 & 63);
			bytes.push(128 | cp >> 6 & 63);
			bytes.push(128 | cp & 63);
		}
	}
	return bytes;
}
/**
* 一步旋转: ω → ω + γ · Pω → normalize
* γ ∝ |ω - Pω| / |Pω| (投影残差比例), cap = φ⁻¹
*
* γ 接近 0: P 投影与当前 ω 一致 → 已知模式
* γ 接近 φ⁻¹: P 投影带全新方向 → 新区分
*/
function rotateToward(omega, projIdx) {
	const PjOmega = projIdx >= 0 && projIdx < allPsp.length ? sparseApply(allPsp[projIdx], omega) : new Array(D).fill(0);
	const pNorm = normV(PjOmega);
	if (pNorm < 1e-14) return {
		omega: omega.slice(),
		gamma: 0
	};
	const resNorm = normV(subV(omega, PjOmega));
	const gamma = Math.min(resNorm / pNorm, φ_inv);
	let omegaNew = addV(omega, scaleV(PjOmega, gamma));
	const n = normV(omegaNew);
	if (n > 1e-14) omegaNew = scaleV(omegaNew, 1 / n);
	return {
		omega: omegaNew,
		gamma
	};
}
function symmetricInitial() {
	const om = new Array(D);
	const v = Math.sqrt(1 / D);
	for (let i = 0; i < D; i++) om[i] = v;
	return om;
}
/**
* 编码文本为视角轨迹
*
* @param {string} text
* @param {number[]} [omega0] 起始态, 默认对称初态
* @returns {{ omega: number[], trace: {projIdx: number, gamma: number}[] }}
*/
function encode(text, omega0) {
	const bytes = utf8Bytes(text);
	let omega = (omega0 || symmetricInitial()).slice();
	const trace = [];
	for (let i = 0; i < bytes.length; i++) {
		const pIdx = bytes[i] % NP;
		const result = rotateToward(omega, pIdx);
		trace.push({
			projIdx: pIdx,
			gamma: result.gamma
		});
		omega = result.omega;
	}
	return {
		omega,
		trace
	};
}
/**
* v8 (实验): 共振选择编码 — C.5 v2 改造 (2026-08-18)
*
* 原实现: 前 10 字节 byte%NP 破对称 + argmax 共振选择。
* 已知问题: 对称初态下 argmax 对所有文本选同一投影子, cos→1.0 零区分力;
* 2026-08-18 实测 resonance trace 对语义仍零区分力。
*
* 对称初态零区分力 = 还没推进——
* argmax 共振 = 识别为同一类（重复识别只落两型），属于退化侧;
* 破对称 = 第一步推进（区分）— 两个 0 位置不同 —
* 文本的 D 历史 (UTF-8 字节) 在场驱动第一步选择。
*
* v2: 移除 argmax 识别主循环 → 推进（字节驱动投影子选择 + 旋转累积）;
* 破对称 = 第一步走 (无 RESONANCE_WARMUP 魔法数, 无 TODO hack);
* trace γ 参照 = 会话方向 ω₀ (固定) — γ = 每步相对会话方向的区分度,
* 对齐判定语义 γ = 1 − cos(ω_msg, ω_session) (v7 的 γ 相对当前 ω)。
* ω 编码与 v7 相同 (分离度不降)。仅在 ES_RESONANCE=1 时启用。
*/
function encodeResonance(text, omega0) {
	const bytes = utf8Bytes(text);
	let omega = (omega0 || symmetricInitial()).slice();
	const w0 = (omega0 || symmetricInitial()).slice();
	const trace = [];
	for (let i = 0; i < bytes.length; i++) {
		const pIdx = bytes[i] % NP;
		const gammaRef = rotateToward(w0, pIdx).gamma;
		const result = rotateToward(omega, pIdx);
		trace.push({
			projIdx: pIdx,
			gamma: gammaRef
		});
		omega = result.omega;
	}
	return {
		omega,
		trace
	};
}
new Set("。，、：；！？「」『』（）《》〈〉【】—…·,.!?;:\"'()[]{}~`-+=*/\\|<>@#$%^&_ 	\n\r".split(""));
/**
* 余弦相似度: |dot(a,b)| / (|a|·|b|)
* 视角匹配的核心度量
*/
function cosineSimilarity(a, b) {
	let d = 0, na = 0, nb = 0;
	for (let i = 0; i < D; i++) {
		d += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	const n = Math.sqrt(na) * Math.sqrt(nb);
	if (n < 1e-14) return na < 1e-14 && nb < 1e-14 ? 1 : 0;
	return Math.abs(d / n);
}
/**
* 检测 session ω 坍缩风险
*
* 实验3 发现: 60% 种子坍缩为 2 节点 (P0 吸引盆)
* 判断标准: 投影振幅 top-3 集中度 > 70% → 坍缩风险
*
* @returns {number} 0~1, top-3 投影振幅占比
*/
function collapseRisk(omega) {
	const amps = new Array(NP);
	for (let i = 0; i < NP; i++) {
		const Pw = sparseApply(allPsp[i], omega);
		let amp = 0;
		for (let j = 0; j < D; j++) amp += omega[j] * Pw[j];
		amps[i] = Math.max(0, amp);
	}
	amps.sort((a, b) => b - a);
	const top3 = amps[0] + amps[1] + amps[2];
	const total = amps.reduce((s, x) => s + x, 0);
	return total > 1e-12 ? top3 / total : 0;
}
/**
* 反坍缩: 注入随机扰动逃脱吸引盆
*
* @param {number[]} omega - 当前 session ω
* @param {number} [epsilon=0.01] - 扰动强度
* @returns {number[]} 新的 ω (已归一化)
*/
function antiCollapse(omega, epsilon = .01) {
	let rn = 0;
	for (let i = 0; i < D; i++) rn += Math.random();
	const scale = epsilon / Math.sqrt(rn);
	const noisy = new Array(D);
	for (let i = 0; i < D; i++) noisy[i] = omega[i] + Math.random() * scale;
	const n = normV(noisy);
	for (let i = 0; i < D; i++) noisy[i] /= n;
	return noisy;
}
/**
* v23: 迹内积相似度
*
* 不比较 ω 向量, 而是比较编码过程中激活的投影子分布。
* 两个 trace 共享的投影子越多, 代数结构越相似。
*
* 直觉: ω 向量坍缩到同一吸引盆后 cosine→0.97, 区分力丧失。
* 迹内积直接比较"走了哪些代数步骤", 不受吸引盆影响。
*
* trace: [{projIdx, gamma}, ...]
* gamma: 该步投影残差 (新信息量, 已编码在结果中)
*/
function traceHistogram(trace) {
	const hist = new Float64Array(NP);
	for (const step of trace) {
		const g = Number(step.gamma);
		if (g > 0) hist[step.projIdx] += g;
	}
	return hist;
}
function traceSimilarity(traceA, traceB) {
	if (!traceA?.length || !traceB?.length) return 0;
	const hA = traceA.constructor === Float64Array ? traceA : traceHistogram(traceA);
	const hB = traceB.constructor === Float64Array ? traceB : traceHistogram(traceB);
	let sumA = 0, sumB = 0;
	for (let i = 0; i < NP; i++) {
		sumA += hA[i];
		sumB += hB[i];
	}
	if (sumA < 1e-12 || sumB < 1e-12) return 0;
	let dot = 0, nA = 0, nB = 0;
	for (let i = 0; i < NP; i++) {
		const a = hA[i] / sumA, b = hB[i] / sumB;
		dot += a * b;
		nA += a * a;
		nB += b * b;
	}
	const norm = Math.sqrt(nA) * Math.sqrt(nB);
	return norm > 1e-12 ? dot / norm : 0;
}
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename && process.env.MBSF_SELFTEST === "1") {
	console.log("=== v7: TL 塔旋转编码 ===");
	console.log(`D=${D}, NP=${NP}`);
	console.log("");
	const t0 = Date.now();
	for (let i = 0; i < 1e3; i++) encode("测试消息" + i);
	console.log(`1000次: ${Date.now() - t0}ms`);
	const t1 = Date.now();
	encode("A".repeat(5e4));
	console.log(`50KB: ${Date.now() - t1}ms`);
	console.log("");
	for (const { a, b, label } of [
		{
			a: "猫",
			b: "狗",
			label: "猫↔狗"
		},
		{
			a: "猫",
			b: "cat",
			label: "猫↔cat (跨语言)"
		},
		{
			a: "猫很可爱",
			b: "猫非常可爱",
			label: "猫很可爱↔非常可爱"
		},
		{
			a: "我喜欢狗",
			b: "我讨厌狗",
			label: "喜欢↔讨厌"
		},
		{
			a: "ABC",
			b: "CBA",
			label: "ABC↔CBA (字节序)"
		},
		{
			a: "太阳",
			b: "天气",
			label: "太阳↔天气"
		}
	]) {
		const ra = encode(a), rb = encode(b);
		console.log(`  ${label.padEnd(24)} cos=${cosineSimilarity(ra.omega, rb.omega).toFixed(4)}  hist=${traceSimilarity(ra.trace, rb.trace).toFixed(4)}`);
	}
	console.log("");
	const catTexts = [
		"猫",
		"猫很可爱",
		"我的猫",
		"猫咪",
		"小猫",
		"猫粮",
		"撸猫"
	];
	const dogTexts = [
		"狗",
		"狗很忠诚",
		"我的狗",
		"小狗",
		"狗狗",
		"遛狗",
		"宠物狗"
	];
	const weatherTexts = [
		"太阳",
		"下雨",
		"刮风",
		"多云",
		"晴天",
		"天气",
		"阴天"
	];
	function avgCos(texts) {
		const states = texts.map((t) => encode(t).omega);
		let sum = 0, n = 0;
		for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
			sum += cosineSimilarity(states[i], states[j]);
			n++;
		}
		return sum / n;
	}
	function crossCos(aT, bT) {
		const a = aT.map((t) => encode(t).omega);
		const b = bT.map((t) => encode(t).omega);
		let sum = 0, n = 0;
		for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
			sum += cosineSimilarity(a[i], b[j]);
			n++;
		}
		return sum / n;
	}
	console.log("── 组内/组间分离 ──");
	const catIn = avgCos(catTexts);
	const dogIn = avgCos(dogTexts);
	const weatherIn = avgCos(weatherTexts);
	const catDog = crossCos(catTexts, dogTexts);
	const catWeather = crossCos(catTexts, weatherTexts);
	console.log(`  猫 组内: ${catIn.toFixed(4)}`);
	console.log(`  狗 组内: ${dogIn.toFixed(4)}`);
	console.log(`  天气 组内: ${weatherIn.toFixed(4)}`);
	console.log(`  猫↔狗:   ${catDog.toFixed(4)}`);
	console.log(`  猫↔天气: ${catWeather.toFixed(4)}`);
	console.log(`  猫内/猫狗比: ${(catIn / Math.max(catDog, 1e-4)).toFixed(2)}x`);
	console.log("");
	console.log("── 上下文依赖 ──");
	const base = encode("猫喜欢吃鱼");
	const fromCat = encode("猫喜欢吃鱼", encode("猫").omega);
	const fromDog = encode("猫喜欢吃鱼", encode("狗").omega);
	console.log(`  "猫喜欢吃鱼" 从零:        symCos=${cosineSimilarity(base.omega, symmetricInitial()).toFixed(4)}`);
	console.log(`  "猫喜欢吃鱼" 从"猫":      cos(base)=${cosineSimilarity(fromCat.omega, base.omega).toFixed(4)}`);
	console.log(`  "猫喜欢吃鱼" 从"狗":      cos(base)=${cosineSimilarity(fromDog.omega, base.omega).toFixed(4)}`);
	console.log(`  从猫↔从狗:                cos=${cosineSimilarity(fromCat.omega, fromDog.omega).toFixed(4)}`);
	console.log("");
	console.log("=== DONE ===");
}
//#endregion
//#region ../02-packages/core/lib/footprint.js
/**
* 足迹 token 化 — 判定的原料。
*
* 规则只有两条：CJK 逐字成 token，ASCII 连续段聚合成一个 token，标点与空白
* 剔除。剔除后每个 token 记回原文的码元区间 [start, end)，保留片段时按区间
* slice 原文——标点落在区间之外，自然不参与判定。
*
* 这里没有词典、没有模型、没有语言判断：换一门语言、换一套字母表、甚至换成
* 无意义的字符流，只要结构相同，切分结果就同构。
*/
const FRAGMENT_PUNCT = new Set("。，、：；！？「」『』（）《》〈〉【】—…·“”‘’,.!?;:\"'()[]{}~`-+=*/\\|<>@#$%^& 	\n\r".split(""));
function fragmentTokenSpans(text) {
	const s = String(text);
	const out = [];
	let ascii = "";
	let asciiStart = 0;
	const flush = () => {
		if (ascii) {
			out.push({
				tok: ascii,
				start: asciiStart,
				end: asciiStart + ascii.length
			});
			ascii = "";
		}
	};
	const chars = Array.from(s);
	const offsets = [];
	let o = 0;
	for (const ch of chars) {
		offsets.push(o);
		o += ch.length;
	}
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i];
		if (ch === void 0) continue;
		if (FRAGMENT_PUNCT.has(ch)) {
			flush();
			continue;
		}
		if ((ch.codePointAt(0) ?? 0) < 128) {
			if (!ascii) asciiStart = offsets[i] ?? 0;
			ascii += ch;
			continue;
		}
		flush();
		out.push({
			tok: ch,
			start: offsets[i] ?? 0,
			end: offsets[i + 1] ?? s.length
		});
	}
	flush();
	return out;
}
//#endregion
//#region ../02-packages/core/lib/mbsf-core.js
/**
* 未必记忆核心引擎 — Harness 移植版
*
* 从 OpenClaw electronic-sheep-compaction/index.js v24 (v8.6.0-dev) 提取，
* 去掉 openclaw SDK 依赖，TS 化。核心逻辑原样保留：
*
*  - 编码 (encoder.js, D=233, NP=30)
*  - γ = 1 - cos(ω_msg, ω_session) 冗余判定（位置层热度 / EMA——
*    检索载体，见下「判定链改造」注记）
*  - session_ω 旋转 walk 更新 + Δω radical 衰减追踪
*  - gamma EMA 梯度自适应 tail
*  - gray-zone 诚实追踪
*  - deltaCompact 摘要生成
*
* ── 判定链改造（2026-08-25，§2.7 干净方案：两层离散识别判定链）────────────
* 压缩保留判定（deltaCompact 内）从 γ/cos 阈值（工程标定）改为两层离散
* 识别（token 级子串包含，零阈值零比例零编码依赖）：
*  第一层：消息整条是特征（前序摘要 + 本区间已处理消息）某段的连续子串
*    → 完全识别 → 压缩（识别，计数 + 预览，不占原文预算）
*  第二层：贪心最长共享片段切分，逐片段二值——已识别片段压缩，未识别
*    token 按原文区间保留（增量 = 新方向）；无共享 → 全保留。
*  承接点 = 特征末端（B-815 ①）；等同冗余步不进判定链（讨论稿 2.4）。
* 判定不再依赖 γ/cos/阈值——判定 = 纯 token 级离散比较（0.10.4 清账）。
* 残留标定（不参与压缩保留判定，标注不阻塞）：
*  - γ 驱动 tail（adaptiveTailTurns/tailStartIndex）已撤出主路径——tail 起点
*    = 结构判定（structuralTailStart：最后闭合边界之后）；MAX_TAIL_MESSAGES
*    = 无闭合边界时的近因窗口兜底（输出层，保证压缩发生，非判定）
*  - γ/EMA = 位置层热度（indexMessage）与诊断日志（log EMA=），不参与
*    压缩判定
*  - 预算常数（maxChars 分配比例/单条上限）= 输出层工程上限
*  - gammaProfile 的 gray-zone 统计 = 位置层历史字段——判定链不再读取
*    （updateGammaStats 仍记录统计，供 mbsfStats/skill 自检查看）
*
* 脑记忆目录 ~/.mbsf/（从 OpenClaw 复用）：
*  - 读：sessions.json（session ω 种子）、gamma-stats.json（EMA 习惯）、gray-zone.json
*  - 写：gamma-stats.json、gray-zone.json（防抖 writeFileSync——2026-08-31
*    审计校正：非原子写（_saveGammaStats 969/971 无 tmp+rename）；对照
*    索引层 的 renameSync 原子写惯例为项目其他模块所用）
*  - sessions.json / brain-state.json 只读不写（OpenClaw 的 mbsf-d 进程可能仍在使用）
*
* @module @deepseek-ai/dsh-compaction-mbsf/mbsf-core
*/
/** 派生文件目录。发布版无派生根——原样返回；集成侧可自行决定目录布局。 */
function _derivedDirFor(dataDir) {
	return dataDir;
}
const QUIET = process.env.MBSF_DEBUG !== "1";
const _useResonance = process.env.MBSF_RESONANCE === "1";
/**
* 会话态缓存护栏：脑内只保持最近 MAX_SESSIONS 个会话的在线状态
* （γ/ω 统计），超出 LRU 淘汰——记忆的活跃窗口天然有限，旧会话退为
* 离线档案（只读，不参与在线状态）。数值工程标定（容量护栏，
* 无明确依据，可再校准）。 */
const MAX_SESSIONS = 20;
/**
* Δω 衰减窗口（已答 2026-08-18 ——5-节律工程显影）。
*
* 理论侧：交替递推固有节律 d_n=0 ⟺ n≡4 (mod 5)
* ——零点每 5 层一次（边界 d₄=0）；代数根源 = 翻面恒等（* φ²=φ+1——周期 10 的一半，d_{n+10}=d_n 翻面两次回原值——）。
* 工程值 5 = 5-节律的工程显影 （数值仅作非证实——
* 经验规则；同构 C.6 先例 MIN_TAIL_MESSAGES=2 → 递推阶数 2）。5 不是魔法数字，
* 是翻面恒等的代数产物。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。）
*/
const DELTA_DECAY_WINDOW = 5;
/**
* 退化风险保险丝（已知边界 闭合 2026-08-18 ——保险丝不是判定阈值）。
*
* 实证（tests/collapse-distribution.ts，7 真实会话 282 次 ω 更新重演）：
* collapseRisk（top-3 投影振幅集中度）全部落在 0.17-0.22 窄带
* （med=0.1915，p95=0.2052，max=0.2184）——0.7 触发率 0.0%，
* antiCollapse 在真实流水从未被触发。
*
* 性质（经验规则 诚实标注）：0.7 与真实分布分离 3.2 倍以上，不是
* 「贴近分布的判定阈值」（判定阈值应由分布产生——已知边界/5 先例），
* 而是**工程边界保险丝**——与 MAX_BODY_CHARS=20000 同构（THEORY.md 五：
* 正常路径永不撞墙，与 d₄=0 分无可分同构，不引入新判定逻辑）。
* 仅当编码器病态退化（实验 3 的 2 节点吸引盆，top-3 集中度 ≥0.7）时
* 才触发反退化。antiCollapse 本体 = 工程防护（已答：识别即止
* 是 = 的动作本体，抗退化 = 多走少合的工程选择，语义已明）。
* 数值 0.7 =  工程标定（触发率 0.0%——仅病态路径，非判定依据）。
*/
const COLLAPSE_RISK_FUSE = .7;
/** 反退化扰动强度（工程防护参数 ——已知边界 语义：多走少合，非判定依据）。 */
const ANTI_COLLAPSE_EPSILON = .008;
/**
* γ EMA 冷启动（已知边界 补标 2026-08-20——继承 OpenClaw 行为的工程标定）。
*
* 新会话无统计样本时不能沿用全局 EMA（会继承 OpenClaw 高 EMA → Harness
* 新会话永远保守、不压缩），故固定阈值从激进压缩开始，随使用自适应。
* ROUNDS=5 = 至少 5 轮才从冷启动退出（与 MIN_TAIL_MESSAGES=2 同构的
* 「递推阶数」思维——冷启动判定需足够样本形成首阶统计，取小整数的
* 工程护栏）；THRESHOLD=0.03 = 与灰区 MIN（GRAY_ZONE_MIN=0.08）拉开
* 安全距（0.03 < 0.08 = 冷启动阶段默认压缩，避免新会话误判新方向），
* 同时作为 EMA 下限（Math.max(THRESHOLD, ema)）防活跃会话压到 0。
* 数值工程标定（继承 OpenClaw 行为 + 灰区对齐，无独立 判定依据 依据，
* 可再校准）。
*/
const COLD_START_ROUNDS = 5;
const COLD_START_THRESHOLD = .03;
/** 灰区判定边界（已知边界 分布方法论落地 2026-08-18）。
*  原 0.03/0.08 手标——真实流水 1590 样本 γ 分布（tests/gamma-distribution.ts）：
*  系统注入模板带 0.04-0.24（尖峰 0.06/0.09/0.11/0.13/0.16/0.21）+ 真实对话带
*  0.08-0.68（med=0.360，p25=0.283）。旧边界下真实对话命中 0.0%（灰区只切
*  系统注入模板，模板 0.09+ 反被 clearPreserve 全保留 = 预算浪费）。
*  新边界按分布产生：MIN=0.08（真实对话 min≈0.082 之下 = 模板低端压缩）；
*  MAX=0.25（真实对话 p25≈0.283 之下进灰区按 KEEP_RATIO 保留，之上
*  clearPreserve 全保留——83.9% 真实对话保留原文，14.8% 按比例）。
*  边界值可再调（一帆「完后不对再调」）。 */
const GRAY_ZONE_MIN = .08;
const GRAY_ZONE_MAX = .25;
/**
* γ EMA 平滑系数（已知边界 状态 2026-08-18：✅  已答——递推阶数 2 的工程显影，见下）。
*
* 理论侧（，C.10.2 + 已知边界登记已知边界）：时间尺度家族中 DELTA_DECAY_WINDOW=5
* 与 tail 轮数已获 5-节律/周期 10  身份；EMA α 补答 = **递推阶数 2 的工程
* 显影**——α=0.3 的半衰期 = ln0.5/ln(1−α) ≈ 1.94 步 ≈ 2 = 交替递推的递推阶数
* （：d_{n+1} = φ·d_n − d_{n−1} 二阶——延续需要 2 个前项——C.6 ②
* MIN_TAIL_MESSAGES=2 → 递推阶数 2 先例同构）。理论值 α* = 1−1/√2 ≈ 0.2929 ≈
* 工程 0.3（差 2.4% 取整级）—— 数值仅作非证实（经验规则）。
* 不需要等时间产生理论（(𝔄,ω)→GNS→Δ≠1）——交替递推二阶结构已在正典。
* 工程标定 。
*/
const GAMMA_EMA_ALPHA = .3;
const GAMMA_SAVE_DEBOUNCE_MS = 15e3;
/** 压缩耗时统计（E.25 待办 #3，2026-08-19）：mbsfSummarize 每次压缩
*  记录 elapsedMs → latency-stats.json（独立小文件，不碰 brain-state——
*  OpenClaw mbsf-d 只写）。EMA 平滑 + 最近 LATENCY_RING 条明细。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const LATENCY_FILE = "latency-stats.json";
const LATENCY_RING = 20;
const LATENCY_EMA_ALPHA = .3;
const COMPACTION_LOG_FILE = "compaction-log.jsonl";
let _latencyRing = [];
let _latencyEma = null;
let _latencyN = 0;
let _lastSummarize = null;
/** 最近一次压缩结构快照（状态页消费；null = 尚未压缩过）。 */
function lastSummarizeStats() {
	return _lastSummarize;
}
/** 读压缩历史（compaction-log.jsonl 尾部 N 条 type='fold' 记录）。
*
*  2026-09-27 A+C 方案：压缩长期只在 session 消息流里对模型可见、对用户
*  隐形（BasicCompactionEngine 把 summarize() 产物包成 createUserMessage
*  写进上下文，不经任何 UI）。本函数把主机侧已有的压缩日志暴露给状态页，
*  让「压了什么」可查。
*
*  实现纪律：只读尾部 Chunk（文件 append-only 且随会话无限增长，全量读会
*  随使用年限变慢）；坏行跳过不阻塞；旧 maintenance/ghost/rad 条目按
*  type 过滤排除（保留只读，不混入压缩历史）。 */
function foldHistory(dataDir, limit = 30) {
	try {
		const dir = _derivedDirFor(dataDir);
		const p = path.join(dir, COMPACTION_LOG_FILE);
		if (!fs.existsSync(p)) return [];
		const stat = fs.statSync(p);
		const window = Math.max(64 * 1024, Math.min(1024 * 1024, limit * 200 * 16));
		const start = Math.max(0, stat.size - window);
		const fd = fs.openSync(p, "r");
		let raw;
		try {
			const buf = Buffer.alloc(stat.size - start);
			fs.readSync(fd, buf, 0, buf.length, start);
			raw = buf.toString("utf8");
		} finally {
			fs.closeSync(fd);
		}
		const lines = raw.split("\n");
		if (start > 0) lines.shift();
		const out = [];
		for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
			const line = lines[i].trim();
			if (line.length === 0) continue;
			let obj;
			try {
				obj = JSON.parse(line);
			} catch {
				continue;
			}
			if (obj.type !== "fold" || typeof obj.ts !== "number") continue;
			out.push(obj);
		}
		return out;
	} catch (e) {
		if (process.env.MBSF_DEBUG) console.error("[MBSF] 压缩历史读取失败:", e.message);
		return [];
	}
}
/** 记录一次压缩耗时并落盘（同步写——压缩低频，毫秒级 IO 可忽略）。
*  v2（2026-08-25）：快照带 lastSummarize——重启恢复「最近一次压缩」
*  （_lastSummarize 原为纯内存态，重启后 UI 恒显「尚未压缩过」）。
*  调用方保证 _lastSummarize 已赋值（mbsfSummarize 先赋快照再落盘）。 */
function _recordLatency(dataDir, ms, messages, compressed) {
	try {
		dataDir = _derivedDirFor(dataDir);
		_latencyRing.push({
			ts: Date.now(),
			ms,
			messages,
			compressed
		});
		if (_latencyRing.length > LATENCY_RING) _latencyRing = _latencyRing.slice(-20);
		_latencyEma = _latencyEma === null ? ms : _latencyEma * (1 - LATENCY_EMA_ALPHA) + ms * LATENCY_EMA_ALPHA;
		_latencyN++;
		const obj = {
			version: 2,
			n: _latencyN,
			emaMs: Math.round(_latencyEma),
			lastMs: ms,
			lastTs: Date.now(),
			recent: _latencyRing,
			lastSummarize: _lastSummarize
		};
		fs.writeFileSync(path.join(dataDir, LATENCY_FILE), JSON.stringify(obj, null, 2));
	} catch (e) {
		if (process.env.MBSF_DEBUG) console.error("[MBSF] 耗时统计落盘失败:", e.message);
	}
}
/**  压缩事件日志（2026-09-03——E.86 线1④ 压缩产物抽查锚缺失闭环）：
*  mbsfSummarize 真发生压缩（compressed/folded/archived 任一 > 0）时，
*  append 一行 JSONL 到 compaction-log.jsonl——ts+sessionKey 定位会话，
*  数字字段给产物规模轮廓（抽查时凭锚回溯原文 vs 摘要比对质量）。正文
*  不落盘（防重复存储膨胀——session 文件已有原文/摘要）。type='fold' 与
*  历史 maintenance/ghost/rad 条目并存（旧写点已退役，条目保留只读）。
*  同步 append（压缩低频，毫秒级 IO 可忽略）；失败静默不干扰主流程。 */
function _recordFold(dataDir, evt) {
	try {
		dataDir = _derivedDirFor(dataDir);
		const line = JSON.stringify({
			ts: Date.now(),
			type: "fold",
			...evt
		}) + "\n";
		fs.appendFileSync(path.join(dataDir, COMPACTION_LOG_FILE), line);
	} catch (e) {
		if (process.env.MBSF_DEBUG) console.error("[MBSF] 压缩事件日志落盘失败:", e.message);
	}
}
/** 启动恢复压缩统计（2026-08-25 B 方案）：从 latency-stats.json 恢复
*  _latencyN/_latencyEma/_latencyRing/_lastSummarize——压缩次数/EMA/最近
*  压缩不再是「本次运行期间」语义，重启不丢。v1 文件无 lastSummarize
*  → 该字段保持 null（尚未压缩过）；坏数据防御性跳过，不阻塞启动。 */
function _loadLatency(dataDir) {
	try {
		const p = path.join(dataDir, LATENCY_FILE);
		if (!fs.existsSync(p)) return;
		const raw = JSON.parse(fs.readFileSync(p, "utf8"));
		if (typeof raw.n === "number" && raw.n > 0) {
			_latencyN = raw.n;
			_latencyEma = typeof raw.emaMs === "number" ? raw.emaMs : null;
			if (Array.isArray(raw.recent) && raw.recent.length > 0) _latencyRing = raw.recent.slice(-20);
		}
		const ls = raw.lastSummarize;
		if (ls && typeof ls.at === "number" && typeof ls.textChars === "number") _lastSummarize = ls;
		if (_latencyN > 0 || _lastSummarize !== null) log(`⏱️ 恢复压缩统计: ${_latencyN} 次${_lastSummarize ? `, 最近 ${new Date(_lastSummarize.at).toISOString()}` : ""}`);
	} catch (e) {
		console.error("[MBSF] 压缩统计恢复失败（不阻塞启动）:", e.message);
	}
}
/** 压缩耗时统计快照（stats-all 消费）。 */
function latencyStats() {
	return {
		n: _latencyN,
		emaMs: _latencyEma === null ? null : Math.round(_latencyEma),
		lastMs: _latencyRing.length > 0 ? _latencyRing[_latencyRing.length - 1].ms : null,
		recent: _latencyRing
	};
}
/** 前序摘要占正文预算的比例（历史浓缩与本轮内容按比例分配）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。）
*  ⚠️ 2026-11-03：主路径已不再用它分配预算（foldPreviousCheckpoint 改为
*  按行类型二分 + PREV_KEEP_CHARS 封顶）；仅在**兼容路径**（无可识别
*  结构）里作兜底截断比例。 */
const PREV_SUMMARY_RATIO = .5;
/** 前序保留行字符上限（2026-11-03）。
*
*  **为什么需要**：`keptAvail = max(0, keptBudget − chars)` 是代数关系——
*  前序块长度直接决定增量原文能分到多少预算。实测（session-f6ffb7bc）
*  前序块 ≈ 37k 字符 > keptBudget(17k) ⟹ keptAvail 恒 0 ⟹ 198/198 帧
*  增量原文 0 行。前序块必须有硬上限，否则方向被饿死。
*
*  ⚠️ **性质 = 工程护栏 **，不是结构产生的量——结构解（前序保留行
*  当特征再进 deltaCompact 的「再合」）是二期，一期用字符护栏保证方向
*  存活。可再校准。 */
const PREV_KEEP_CHARS = 600;
/** tool 结果压缩：每条要点最大字符数（执行产物只留可追溯的一瞥）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const TOOL_SAMPLE_CHARS = 60;
/** tool 结果压缩：最多附要点条数（按类别数截断，防压缩行自身膨胀）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const TOOL_SAMPLE_MAX = 3;
/** 完全识别压缩行：最多附预览条数（防压缩行自身膨胀，同 TOOL_SAMPLE_MAX
* 逻辑）。压缩行 = 两层离散识别的第一层产物（2026-08-25 §2.7）——
* 计数 + 少数预览，不占原文预算。工程上限 。 */
const FOLD_MAX_PREVIEWS = 5;
/** 完全识别压缩行：每条预览最大字符数（只留识别所需的一瞥）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const FOLD_PREVIEW_CHARS = 60;
/** 完全识别压缩行：预留预算占 maxChars 的比例——结构行（识别）优先
* 于增量原文，不被细节挤掉。工程标定 。 */
const FOLD_BUDGET_RATIO = .15;
/** 消息内部重复压缩的判定比例：识别块 ≥ 首段 × 本值 ⟹ 该消息 = 同段重复。
*   工程标定（3 = 至少重复 3 遍才算「重复结构」）。 */
const INTERNAL_FOLD_MIN_RATIO = 3;
/** 增量原文：无共享消息（keptCount === total）的未识别片段结构上限。
* keptCount === total ⟺ recognized 全 false ⟺ 相邻未识别 span 合并后
* 恒为 1 个片段（整条消息 = 一个片段）——结构恒等，非标定值：无共享 =
* 全新方向 = 整条保留，只受 keptBudget 硬约束。字符上限（旧 SELECTED_
* FULL_CHARS=1500）是外部连续量 ，撤出判定路径（经验规则 编码不是
* 类型 + 结构 5 连续量撤出判定）。 */
function log(...args) {
	if (!QUIET) console.log("[MBSF]", ...args);
}
/**
* 安全截断：按 UTF-16 码元截断后回退到完整码点边界。
*
* 🐾 = U+1F43E = \ud83d\udc3e（2 个 UTF-16 码元）。直接 `slice(0, N)` 若
* 切点落在多码元字符中间，会留下孤立代理项（如 \ud83d）——该文本经
* JSON.stringify 注入上下文发给 DeepSeek API → UTF-8 校验失败 → HTTP 400
* INVALID_REQUEST → 会话死亡（2026-08-17 会话死亡调查，附录D 修复）。
*
* 循环回退：切掉一个码元后新末尾仍可能是代理项（如连续 emoji），
* 故用 while 而非单次 if。
*/
function safeSlice(text, maxLen) {
	if (text.length <= maxLen) return text;
	let s = text.slice(0, maxLen);
	while (s.length > 0) {
		const cu = s.charCodeAt(s.length - 1);
		if (cu >= 55296 && cu <= 57343) {
			s = s.slice(0, -1);
			continue;
		}
		break;
	}
	return s;
}
/** 净化孤立代理项：只删未配对的 \uD800-\uDFFF，保留合法配对（emoji）。
*
*  注意不能直接用 `/[\uD800-\uDFFF]/g` 替换——完整 emoji（如 🐾 =
*  \ud83d\udc3e）本身就是两个代理项的合法配对，粗暴替换会连合法内容
*  一起删。遍历按配对判断：高代理项后紧跟低代理项 → 保留一对；其余
*  代理项（孤立）→ 丢弃。对已有坏文本免疫（历史坏摘要固化兜底——
*  修复截断后旧坏摘要仍可能带孤立代理项，输出前净化防漏网）。
*/
function stripLoneSurrogates(text) {
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const cu = text.charCodeAt(i);
		if (cu >= 55296 && cu <= 56319) {
			const next = i + 1 < text.length ? text.charCodeAt(i + 1) : -1;
			if (next >= 56320 && next <= 57343) {
				out += text.charAt(i) + text.charAt(i + 1);
				i++;
			}
		} else if (cu >= 56320 && cu <= 57343) {} else out += text.charAt(i);
	}
	return out;
}
function doEncode(text, omega0) {
	return _useResonance ? encodeResonance(text, omega0) : encode(text, omega0);
}
function contentHash(text) {
	return crypto.createHash("md5").update(text, "utf8").digest("hex").slice(0, 12);
}
/** 兼容 Harness Message / OpenClaw event message 的文本提取。 */
function extractText(msg) {
	if (typeof msg === "string") return msg;
	if (!msg) return "";
	const m = msg;
	if (m.content) {
		if (typeof m.content === "string") return m.content;
		if (Array.isArray(m.content)) return m.content.filter((c) => c?.type === "text").map((c) => String(c.text ?? "")).join("\n");
	}
	if (m.text) return String(m.text);
	if (m.message) return extractText(m.message);
	return "";
}
/** 压缩路径专用取文（2026-09-21 修复——②）：在 extractText 基础上**并入
*  `tool/result` 的嵌套正文**（`content[].content[].text`）。
*
*  为什么不能直接改 extractText：extractText 的「只取 text 块」语义被记忆
*  登记侧固化（tests/tools-echo-filter.spec.ts：工具回显不进记忆库——结构
*  过滤零语言知识，工具输出不是 D 的产物）。压缩侧的需求相反：压缩要把
*  **真实占用上下文的全部内容**折进摘要，工具输出虽不入记忆库，却是实打实
*  发出去的请求内容。
*
*  病灶（三会话实证 79e5ae2a/487b62a1/1568d895）：surface 里 tool/result 的
*  正文在 content[0].content[].text（嵌套一层），extractText 看不见 ⟹ 全部
*  判为「空文本」跳过 ⟹ mapped 只剩 system/skill-catalog 等零星几条（实测
*  mapped=3）⟹ force 压缩 endIdx=0 < 1 ⟹ 压缩救不了 ⟹ 守卫 reject ⟹ 死锁。
*  实测 79e5ae2a surface 3,521,910 字符中 tool-result 占 447,457（12.7%），
*  这些内容此前对压缩器完全不可见。
*
*  reasoning 块**不并入**（与 extractText 相同）：pi-ai 对 openai-completions
*  回放时不发 thinking 内容——实测相邻请求 Δctx 与 Δreasoning 完全脱钩
*  （831→838：Δctx=2,637 而 Δreasoning=136,176），reasoning 不占请求上下文。
*  （reasoning 占 surface 字符 83.9%，若并入会把估算虚高 4 倍——正是
*  surfaceTokens 判据的病灶，见 index.ts runContextGuard。）
*/
function extractCompactableText(msg) {
	if (typeof msg === "string") return msg;
	if (!msg) return "";
	const m = msg;
	if (m.content !== void 0 && !Array.isArray(m.content)) return extractText(m.content);
	if (Array.isArray(m.content)) {
		const parts = [];
		for (const c of m.content) {
			if (c === null || typeof c !== "object") continue;
			const block = c;
			if (block.type === "text") {
				parts.push(String(block.text ?? ""));
				continue;
			}
			if (block.type === "tool-result") {
				if (Array.isArray(block.content)) for (const inner of block.content) {
					if (inner === null || typeof inner !== "object") continue;
					const t = inner;
					if (t.type === "text") parts.push(String(t.text ?? ""));
				}
				else if (typeof block.content === "string") parts.push(block.content);
			}
		}
		return parts.join("\n");
	}
	if (m.message) return extractCompactableText(m.message);
	return extractText(msg);
}
/** 运行态文本识别：system-reminder / runtime-context 快照 = 环境描述
*  （当前状态的表述，非过去的记录）→ 不进特征、不进记忆库。
*  ：记忆 = 历史 D 的产物；运行态 = 前提/环境层——混入 = 三层混淆。 */
function isRuntimeContextText(text) {
	const t = text.trim();
	if (!t) return false;
	return t.startsWith("<system-reminder>") || t.startsWith("Current runtime context") || t.startsWith("This is an automatically generated checkpoint");
}
/** checkpoint 摘要帧开标签（压缩产物——元层，非历史 D 的产物）。
*  2026-09-14 改名：电子羊 → MBSF（电子羊这个名字已停用）。 */
const CHECKPOINT_OPEN_TAG = "<compacted-by-MBSF>";
/** checkpoint 摘要帧闭标签（与 OPEN_TAG 配对；index.ts 曾内联硬编码，
*  2026-08-25 归档增量下沉单一来源，防判定漂移）。 */
const CHECKPOINT_CLOSE_TAG = "</compacted-by-MBSF>";
/** 历史标签（2026-09-14 改名前的日志里写的）——**只读兼容，不再写入**。
*  为什么要认它：识别靠 `text.includes(OPEN_TAG)`，若不认旧标签，历史日志里
*  已压缩过的 checkpoint 会被当成普通正文**再折一次**（越折越肥），且前序
*  checkpoint 提取会找不到。改写历史日志 = 动用户数据，不做——读侧兼容即可。 */
const LEGACY_CHECKPOINT_OPEN_TAG = "<compacted-by-electronic-sheep>";
/** 历史闭标签——只读兼容。 */
const LEGACY_CHECKPOINT_CLOSE_TAG = "</compacted-by-electronic-sheep>";
/** checkpoint 帧识别（读写兼容的**单一入口**——新旧标签任一命中即算）。
*  所有「跳过 checkpoint / 提取前序」的判定都走这里，防各层判定漂移。 */
function isCheckpointText(text) {
	return text.includes("<compacted-by-MBSF>") || text.includes("<compacted-by-electronic-sheep>");
}
/** 注入消息文本前缀（记忆库读出的一瞥——读产物，非新内容）。 */
const INJECT_PREFIX = "📎 记忆";
/** 日期锚点消息文本前缀（位置落点——引擎读出系统时钟建立日期位置，非记忆
*  内容。与 INJECT_PREFIX 同角色：压缩侧/特征侧识别锚点消息自身。
*  （2026-09-02 下沉 mbsf-core 单一来源——原在 注入层，压缩侧
*  需要识别，防循环依赖。） */
const DATE_ANCHOR_PREFIX = "[MBSF 日期锚]";
/** 记忆注入消息来源标记。kind 取值 'mbsf-inject'（= 本插件自己的名字，正是
*  v4「生产者自有种类」的字面语义）。为什么不写 'plugin:mbsf-inject'：那是
*  v4 迁移器给「未登记生产者」的兜底命名（`producerKind()` 的
*  `return \`plugin:${plugin}\``），两版 UI 都直接拿 kind 当标签渲染（0.1.5
*  `contextProvenance` / 0.1.7 `contextProducer` 的 default 分支都是
*  `label = kind`）⟹ 会显示成「plugin:mbsf-inject」。用本名则标签仍是
*  「mbsf-inject」，与改动前 0.1.5 的显示相同。
*  两版宿主都**实测**接受：
*    · 0.1.7：判据只有「非空且 !== 'plugin'」⟹ 放行；
*    · 0.1.5：`SOURCE_KINDS` 白名单只作用于 **v2→v3 迁移口**
*      （`assertEvent(…, 2)`）；原生 v3 读写走 `assertV3Event` →
*      `messageSourceValue` 的 default 分支「非空字符串即合法」，不查白名单
*      ⟹ encode/decode 往返无损（2026-09-27 用 0.1.5 真实 codec 实测）。 */
const INJECT_SOURCE = Object.freeze({
	kind: "mbsf-inject",
	plugin: "mbsf-inject",
	form: "notice",
	summary: "未必记忆记忆一瞥"
});
/** 日期锚点消息来源标记（2026-09-02 与记忆注入拆分——一帆「日期锚的提示
*  应该和一瞥分开」）：plugin 独立（mbsf-anchor）+ summary 独立（未必记忆
*  日期锚），GUI 按 source 显示不再混成「未必记忆记忆一瞥」。同一 INJECT_SOURCE
*  原为记忆注入与日期锚共用——锚点是位置落点非记忆内容，显示层应直说。
*  （2026-09-20 改名：es-anchor → mbsf-anchor。）
*  kind 取值理由同 INJECT_SOURCE（v4 拒绝 'plugin' 保留字；用本名做标签）。 */
const ANCHOR_SOURCE = Object.freeze({
	kind: "mbsf-anchor",
	plugin: "mbsf-anchor",
	form: "notice",
	summary: "未必记忆日期锚"
});
/** 旧 plugin 名（2026-09-20 改名前的 es-* 品牌残留）——存量会话兼容。
*  实测存量：109 个历史会话文件里存着 'es-anchor' / 'es-inject' 串（改名
*  前落盘的 source 字段）。若不并认，旧会话恢复时那些注入消息会被当真实
*  对话进 γ 冗余判定/特征/入段 = 自我强化环（正是本判定要防的）。
*  与 LEGACY_CHECKPOINT_OPEN_TAG 同款先例（格式遗产并认，零数据迁移）。 */
const LEGACY_INJECT_PLUGIN = "es-inject";
const LEGACY_ANCHOR_PLUGIN = "es-anchor";
/** 旧 kind（2026-09-27 前的 'plugin' 包装层）——存量会话兼容。
*
*  与上面的旧 plugin 名**不同维度**：那是「同一个 kind 下的旧名字」，这是
*  「旧 kind 本身」。两种旧写法都要认，否则存量会话里的注入消息会被当真实
*  对话（自我强化环）。新写入一律用 `plugin:<name>`（见 INJECT_SOURCE），
*  所以旧 kind 只会出现在历史行里，不需要数据迁移。 */
const LEGACY_PLUGIN_KIND = "plugin";
/** 引擎注入消息判定（记忆注入 mbsf-inject + 日期锚 mbsf-anchor 统一识别；
*  并认旧名 es-inject/es-anchor 与旧 kind 'plugin'——存量会话兼容，见上）：
*  压缩侧跳过、特征排除、surface 溯源共用——都是引擎读产物注入，均非对话
*  流记录，一律不参与 γ 冗余判定/特征/入段（防自我强化环）。
*
*  kind 判定「新写法 plugin:<name> 或旧写法 plugin」双认：生产者身份由
*  plugin 名唯一确定，kind 只用来排除「别人的 kind 却借用了同名 plugin
*  字段」这种误伤。 */
function isInjectSource(source) {
	const kind = source?.kind;
	if (kind !== INJECT_SOURCE.kind && kind !== ANCHOR_SOURCE.kind && kind !== LEGACY_PLUGIN_KIND) return false;
	const plugin = source?.plugin;
	return plugin === INJECT_SOURCE.plugin || plugin === ANCHOR_SOURCE.plugin || plugin === LEGACY_INJECT_PLUGIN || plugin === LEGACY_ANCHOR_PLUGIN;
}
/**
* 环境层来源判定 —— **单一判定入口**（2026-11-04 审计根因修复）。
*
* ：记忆 = 历史 D 的产物；「环境层」= 前提/运行态/系统骨架，
* 不是动作的产物。三层分离要求环境层**不进任何 D 相关路径**
* （γ 采样 / 记忆库登记 / 特征推进 / 摘要预算 / 归档）。
*
* **为什么要有这个函数**：原实现把判据散在 4 个文件 30+ 处，每处各自
* `role === 'system' || isRuntimeContextText(...) || isInjectSource(...)`
* ——每次审计都是「发现漏一处 → 补一处」，因为**没人能一眼看全**。
* 实测代价（2026-11-04 两次审计）：
*  · 第一次补了 7 处，第二次又发现 2 类结构判据缺失（tool / goal）——
*    都是「某处写了 role 判据、另一处只写了 role 判据但 DSH 形态 role 是
*    'user'」这类不匹配。
*  · 根因不是漏，是**判据没有单一入口**：同一个概念（环境层）在不同地方
*    用不同判据表达，统一性只能靠人记得。
*
* 本函数把「环境层」的**结构判据**集中：role 类 + source.kind 类 + 文本形态类。
* 调用点按需取用（不是所有点都要全部判据——例如 γ 采样不判文本形态）。
*
* ⚠️ 边界：`isMemorableText` 的判据比本函数更严（还含 notice/checkpoint/
* 注入前缀/空文本等），二者不是替代关系——本函数只回答「这是环境层吗」，
* 「值得收录吗」仍由 isMemorableText 回答。
*/
function isEnvironmentSource(source, role) {
	if (role === "system" || role === "tool" || role === "toolResult") return true;
	if (role === "developer") return true;
	if (source === void 0) return false;
	if (source.kind === "tool" || source.kind === "goal") return true;
	if (source.form === "notice") return true;
	if (NON_HUMAN_KINDS.has(source.kind ?? "")) return true;
	if (isInjectSource(source)) return true;
	return false;
}
/**
* 非人类来源 kind 白名单 —— **正向枚举**（2026-11-04 第三次审计）。
*
* ── 为什么需要（前两次审计漏掉的根因）────────────────────────────────────
* 前两次审计都按「已知环境层类型 → 补判据」的**负向**方式做：
* `kind === 'tool' || kind === 'goal' || form === 'notice' || isInjectSource()`。
* 这在逻辑上只能覆盖「想过的那几种」。实测 `~/.dsh/sessions` 60 个真实
* 会话（94705 事件）后得到 `source.kind` 的真实取值全集 **24 种**，而旧判据
* 只覆盖 4 种——漏掉的 20 种里，凡是 role='user' 且没有 form='notice' 的，
* 都会被当作一帆的发言收进记忆库。
*
* ── 已确证的污染（不是理论风险）──────────────────────────────────────────
* 扫索引文件全部 76988 条 refs，实测已污染 **232 条**：
*  · tool-jobs      110 条  'background job … finished'（job 完成回执）
*  · subagent-settled 67 条  'Background subagent … finished'
*  · agent-message   37 条  'Agent <id> sent a message: …'（子代理转述）
*  · user-approval   13 条  'The approval policy changed …'
*  · tool-goal        5 条  '<goal_complete> Objective: …'
* 时间跨度 2026-08 ~ 2026-09（最后一条 09-20）。旧判据靠 `form='notice'`
* 顺手拦下了其中 3 类，但 `agent-message`（form='relay'）与
* `user-approval`（无 form）**今天仍在入库**——实测确认。
*
* ── 为什么改成白名单（而不是继续补 kind === 'xxx'）──────────────────────
* 负向判据的失效模式是「未知的未知」：DSH 新增一种来源，判据自动漏。
* 正向白名单的失效模式相反——新增来源默认**不收**，宁可漏收真记忆（可事后
* 补录）也不污染（污染会经 mbsf_recall 回流进上下文，形成自我强化环）。
* 两个方向的代价不对称，故取白名单。
*
* ── 收录判据（：记忆 = 历史 D 的产物）────────────────────────────
* 只收「会话内动作的产物」= 人类发言 + 模型推理输出。
* `HUMAN_KINDS` 之外的一切 kind 都是环境层/流水结构/元数据。
*/
const HUMAN_KINDS = /* @__PURE__ */ new Set(["user", "model"]);
const NON_HUMAN_KINDS = /* @__PURE__ */ new Set([
	"tool",
	"tool-jobs",
	"tool-goal",
	"tool-registry",
	"goal",
	"subagent-settled",
	"agent-message",
	"compact-checkpoint",
	"fallback",
	"provider",
	"model-selection",
	"dsh-session-title-llm",
	"runtime-context",
	"skill-catalog",
	"skill-invocation",
	"user-approval",
	"repeat-tool-reminder",
	"system-prompt",
	"mbsf-anchor",
	"mbsf-inject",
	"plugin:mbsf-anchor",
	"plugin:es-anchor",
	"plugin"
]);
/**
* 工具消息判定 —— **单一判定入口**（2026-11-04 审计）。
*
* 与 `isEnvironmentSource` 的区别：本函数只回答「这是工具执行产物吗」，
* 用于 γ 采样短路（isTool 字段）与 tool 结果压缩分组。goal/notice 属环境层
* 但不是工具——它们有内容长度，γ 采样照常（只是不入库），故不复用全量判据。
*
* **为什么单独抽出来**：DSH 的 tool/result 派生消息 role 是 **'user'**，
* `source.kind='tool'` 才是权威判据（实测，deltaCompact 原注释已记录）。
* 三处调用点（gammaProfile / deltaCompact / structuralTailStart）曾各写
* 一遍同样的三条件——2026-11-04 审计发现 gammaProfile 那一处漏了 kind
* 判据（只写 role），工具输出因此进了 γ 采样 + 记忆库。收敛到本函数，
* 三处不可能再漂移。
*/
function isToolMessage(source, role) {
	if (role === "tool" || role === "toolResult") return true;
	return source?.kind === "tool";
}
/**
* 统一可收录性判定：一段文本是否值得进记忆库（位置层记录）。
* ：记忆库 = 历史记录（动作的产物）的记录——只收「会话内动作
* 的产物」；排除五类非-D 产物：
*   1. system 角色 = 环境层（前提/运行态描述——非 D 的产物）
*   2. 运行态文本（system-reminder / runtime-context / harness checkpoint）
*   3. 压缩摘要帧（CHECKPOINT_OPEN_TAG——元层对历史的二次表述）
*   4. 注入文本（INJECT_PREFIX——记忆库读产物，收它 = 回声自复制）
*   5. producer 声明的完成通知（source.form='notice'——job 完成通知 =
*      流水结构事件广播（回执），既非一帆输入也非小爪推理特征——tip 期②b
*      toolCall/toolResult 按消息 schema 类型排除同构：form 由 producer
*      声明于消息结构（ContextFormed 判别，dsh-llm message.ts）——
*      **结构字段判据，非文本形态拟合**（原「识别 job 通知需 background
*      job 前缀模板 = 拟合红线」前提不成立——结构标识在源头就有，E.87）
* 单一判定入口 → 压缩侧/特征侧/净化侧共用，防各层判定漂移（层混淆根治）。
* @param sourceForm 消息 source.form（producer 声明的结构类型；存量净化侧
*  snippet 文本无 source 信息 → 不传，行为不变）
* @param source 消息 source 全量（2026-11-04 补——注入消息按结构标识排除，
*  不再只靠前缀。存量净化侧 snippet 无 source → 不传，走前缀兜底）
*/
function isMemorableText(text, role, sourceForm, source) {
	const t = text.trim();
	if (t.length === 0) return false;
	if (fragmentTokenSpans(t).length === 0) return false;
	if (isEnvironmentSource(source ?? (sourceForm === void 0 ? void 0 : { form: sourceForm }), role)) return false;
	if (source !== void 0 && source.kind !== void 0 && !HUMAN_KINDS.has(source.kind)) return false;
	if (isRuntimeContextText(t)) return false;
	if (isCheckpointText(t)) return false;
	if (t.startsWith("📎 记忆")) return false;
	if (t.startsWith("[MBSF 日期锚]")) return false;
	return true;
}
function normalizeSessionKey(sessionKey, messages) {
	if (sessionKey) return sessionKey;
	if (messages && messages.length) for (const m of messages) {
		const t = extractText(m);
		const src = m?.source;
		if (isInjectSource(src)) continue;
		if (t.startsWith("📎 记忆") || t.startsWith("[MBSF 日期锚]")) continue;
		if (t.length > 20) return "fp:" + contentHash(t);
	}
	return "__default__";
}
const _sessionOmegas = /* @__PURE__ */ new Map();
const _sessionTraces = /* @__PURE__ */ new Map();
const _sessionDeltas = /* @__PURE__ */ new Map();
const _sessionAccess = [];
const _sessionLastAccess = /* @__PURE__ */ new Map();
function _touchSessionAccess(key) {
	const idx = _sessionAccess.indexOf(key);
	if (idx >= 0) _sessionAccess.splice(idx, 1);
	_sessionAccess.push(key);
}
function getSessionOmega(sessionKey) {
	let omega = _sessionOmegas.get(sessionKey);
	if (!omega) {
		omega = symmetricInitial();
		_sessionOmegas.set(sessionKey, omega);
		_touchSessionAccess(sessionKey);
		if (_sessionOmegas.size > MAX_SESSIONS) {
			const lru = _sessionAccess[0];
			if (lru !== void 0) {
				_sessionOmegas.delete(lru);
				_sessionTraces.delete(lru);
				_sessionDeltas.delete(lru);
				_sessionLastAccess.delete(lru);
				_sessionAccess.shift();
			}
		}
	} else _touchSessionAccess(sessionKey);
	return omega;
}
function getSessionTrace(sessionKey) {
	let hist = _sessionTraces.get(sessionKey);
	if (!hist) {
		hist = new Float64Array(NP);
		_sessionTraces.set(sessionKey, hist);
	}
	return hist;
}
function getSessionDeltas(sessionKey) {
	let deltas = _sessionDeltas.get(sessionKey);
	if (!deltas) {
		deltas = [];
		_sessionDeltas.set(sessionKey, deltas);
	}
	return deltas;
}
/** : 旋转 walk 编码 → 更新会话 ω。ω IS state。 */
function updateSessionOmega(messages, sessionKey) {
	if (!sessionKey) return;
	let allText = "";
	for (let i = messages.length - 1; i >= 0; i--) {
		const role = messages[i]?.role;
		const text = extractText(messages[i]);
		const source = messages[i]?.source;
		if (isInjectSource(source)) continue;
		if (text.startsWith("📎 记忆") || text.startsWith("[MBSF 日期锚]")) continue;
		if (role === "assistant" && allText.length < 3e3) allText = safeSlice(text, 1e3) + "\n" + allText;
		if (role === "user" && allText.length < 3e3) allText = safeSlice(text, 500) + "\n" + allText;
	}
	if (!allText || allText.length < 20) return;
	const sessionOmega = getSessionOmega(sessionKey);
	const oldOmega = sessionOmega.slice();
	try {
		const result = doEncode(safeSlice(allText, 2e3), sessionOmega);
		let nextOmega = result.omega;
		if (result.trace?.length) {
			const sessionHist = getSessionTrace(sessionKey);
			for (const step of result.trace) sessionHist[step.projIdx] += step.gamma;
		}
		let deltaNorm = 0;
		for (let i = 0; i < D; i++) deltaNorm += (nextOmega[i] - oldOmega[i]) ** 2;
		deltaNorm = Math.sqrt(deltaNorm);
		const deltas = getSessionDeltas(sessionKey);
		deltas.push(deltaNorm);
		if (deltas.length > DELTA_DECAY_WINDOW * 2) deltas.shift();
		const risk = collapseRisk(nextOmega);
		if (risk > COLLAPSE_RISK_FUSE) {
			log(`⚠️ session ω 退化风险(保险丝): ${risk.toFixed(2)} > ${COLLAPSE_RISK_FUSE}, 注入反退化扰动`);
			nextOmega = antiCollapse(nextOmega, ANTI_COLLAPSE_EPSILON);
		}
		_sessionOmegas.set(sessionKey, nextOmega);
	} catch (e) {
		console.error("[mbsf] updateSessionOmega failed:", e.message);
	}
}
/** γ 分布直方图桶数（覆盖 0-1，桶宽 1/HIST_BUCKETS）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const HIST_BUCKETS = 100;
/** 会话 γ 直方图参与边界产生的最小样本数（< 此值 = 冷启动，用全局兜底边界）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const GRAY_ZONE_MIN_SAMPLES = 30;
/** 灰区边界分位（从会话 γ 分布产生——相对基线标定）：
*  MIN = p20，MAX = p70——仅服务灰区观测统计（recordGamma 诊断 +
*  gray-zone.json 记录）。2026-08-25 起主压缩路径不消费灰区（deltaCompact =
*  两层离散识别，§2.7 干净方案；E.29 压缩侧保留 γ_A 连续判定作诊断参考，
*  tail 判定已撤出 γ——「中间 50% 按 KEEP_RATIO 保留」表述退役：KEEP_RATIO
*  仅退化路径 degenerateCompress 长度启发式兜底使用）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const GRAY_ZONE_P20 = .2;
const GRAY_ZONE_P70 = .7;
/**
* 存量测试键卫生名单（一次性，2026-09-03）——历史测试脚本（tests/*.ts 手动
* 验证、部分已删）未设 MBSF_DATA → 显式 sessionKey（smoke-test-session 等）
* 直接记录进生产脑 ~/.mbsf 的 gamma-stats/gray-zone（n 合计 3778 ≈ 真实 5%，
* 曾以 ~4.8% 权重摊薄 globalEMA）。入口隔离已治本（package.json test:tsx +
* 脚本自隔离——测试 = 第二层观测，须带自己观测域，见 tests 文档），此名单仅
* 在**恢复过滤**（数据卫生执行点）滤除存量/备份回滚兜底——**不进任何登记
* 判定路径**（isMemorableText/updateGammaStats 记录侧零名单——判定词典红线：
* 名单会过时，新测试键不在名单则漏——防再犯靠入口隔离，不靠名单扩张）。
* 下次重启恢复时内存净；下次 gamma 写盘时盘文件自动瘦身。
*/
const HISTORICAL_TEST_SESSION_KEYS = /* @__PURE__ */ new Set([
	"smoke-test-session",
	"boundary-test",
	"engine-test-session",
	"scale-test",
	"tool-fold-test",
	"cluster-fold-s2",
	"gray-compare",
	"sem-eval",
	"compare-on",
	"per-turn-e2e",
	"tail-fold-s1",
	"lib-smoke-s1",
	"lib-smoke-s2",
	"lib-smoke-s3"
]);
/**
* 恢复过滤谓词（gamma/gray-zone 恢复共用——导出仅为可测，不进判定路径）：
*  fp: 伪会话（观测域分离 2026-09-02）+ 存量测试键（一次性卫生 2026-09-03）
*  不在恢复之列——内存态只含真实会话键；盘文件下次写盘时自动瘦身。
*/
function isRecoverableSessionKey(k) {
	return !k.startsWith("fp:") && !HISTORICAL_TEST_SESSION_KEYS.has(k);
}
/**
* 恢复过滤纯函数（initMbsf 恢复与单测共用——导出仅为可测，不进判定路径）：
*  ① 观测域分离（2026-09-02）：fp: 伪会话键不恢复（无稳定会话身份——内容指纹
*    键稀释真实分布、挤占 LRU）。
*  ② 存量测试键卫生（2026-09-03）：HISTORICAL_TEST_SESSION_KEYS 一次性名单——
*    历史测试脚本误入生产脑的存量/备份回滚兜底（入口隔离已治本，名单不扩张）。
* 返回保留条目与原顺序相同（恢复后 _touchGammaAccess 保持盘上 LRU 顺序）。
*/
function sanitizeGammaRecovery(raw) {
	const keys = [];
	const entries = [];
	let skippedFp = 0;
	let skippedTest = 0;
	for (const [k, v] of Object.entries(raw)) {
		if (k.startsWith("fp:")) {
			skippedFp++;
			continue;
		}
		if (HISTORICAL_TEST_SESSION_KEYS.has(k)) {
			skippedTest++;
			continue;
		}
		keys.push(k);
		entries.push(v);
	}
	return {
		keys,
		entries,
		skippedFp,
		skippedTest
	};
}
const _gammaStats = /* @__PURE__ */ new Map();
const _gammaAccess = [];
let _grayZoneSummary = {
	totalMessages: 0,
	grayHits: 0,
	clearCompress: 0,
	clearPreserve: 0,
	sessions: {}
};
let _gammaStatsPath = null;
let _grayZonePath = null;
let _gammaSaveTimer = null;
function _touchGammaAccess(key) {
	const idx = _gammaAccess.indexOf(key);
	if (idx >= 0) _gammaAccess.splice(idx, 1);
	_gammaAccess.push(key);
}
function updateGammaStats(sessionKey, gamma) {
	if (!sessionKey || !Number.isFinite(gamma) || gamma <= 0) return;
	if (sessionKey.startsWith("fp:")) return;
	let s = _gammaStats.get(sessionKey);
	const b = Math.min(HIST_BUCKETS - 1, Math.max(0, Math.floor(gamma * HIST_BUCKETS)));
	if (!s) {
		const hist = new Array(HIST_BUCKETS).fill(0);
		hist[b] = 1;
		s = {
			ema: gamma,
			n: 1,
			recent: [gamma],
			hist
		};
		_gammaStats.set(sessionKey, s);
		_touchGammaAccess(sessionKey);
		if (_gammaStats.size > MAX_SESSIONS) {
			const lru = _gammaAccess[0];
			if (lru && _gammaStats.has(lru)) {
				_gammaStats.delete(lru);
				_gammaAccess.shift();
			}
		}
		return;
	}
	_touchGammaAccess(sessionKey);
	s.ema = s.ema * (1 - GAMMA_EMA_ALPHA) + gamma * GAMMA_EMA_ALPHA;
	s.n++;
	if (!s.recent) s.recent = [];
	s.recent.push(gamma);
	if (s.recent.length > 10) s.recent.shift();
	if (!s.hist) s.hist = new Array(HIST_BUCKETS).fill(0);
	s.hist[b] = (s.hist[b] ?? 0) + 1;
	const gz = getSessionGrayZone(sessionKey);
	if (!_grayZoneSummary.sessions[sessionKey]) _grayZoneSummary.sessions[sessionKey] = {
		hits: 0,
		total: 0,
		crossLangHints: 0
	};
	const gs = _grayZoneSummary.sessions[sessionKey];
	gs.total++;
	if (gamma >= gz.min && gamma <= gz.max) {
		gs.hits++;
		gs.crossLangHints++;
	}
}
/**
* 会话局部灰区边界——从该会话 γ 分布直方图现场产生（已知边界 自适应落地，
* 2026-08-18 一帆拍板方案 A：每个 session 单独维护分布，边界跟会话走）。
*
* （相对基线 + 两型以结构重现与窗口规模无关）：
* 判定边界必须对照背景分布——分位是分布的结构量（相对），绝对 γ 值跨会话
* 漂移 2-3 倍（稳定性实验：真实对话 med 0.28-0.58、系统注入 med 0.07-0.21，
* 变异系数 30-37%）→ 固定 γ 边界 = 结构错配。边界从本会话记录分布产生：
*  - MIN = p20，MAX = p70——当前用途 = 灰区命中观测（recordGamma →
*    _grayZoneSummary 统计 + gray-zone.json 持久化， 诊断量）；
*    不参与压缩保留决策（主路径 = 两层离散识别；KEEP_RATIO 仅退化路径
*    degenerateCompress 兜底——2026-08-25 后灰区不再按比例保留）。
* 样本不足（冷启动）→ 全局标定兜底（GRAY_ZONE_MIN/MAX——最近一次分布标定值，
* 作为无会话数据时的临时边界；会话积累 ≥ GRAY_ZONE_MIN_SAMPLES 后自动切换）。
*
* 理论身份（已答 2026-08-18——C.10.1）：判定边界从 判定依据 内部看 =
* 离散等价类分界（+ 定义-2.1.1 同型无中间态 + 分合不对称（识别
* 即止——C.8 同构）——识别是二值离散动作，「分布产生边界」的内部身份 =
* 工程对二值判定结果的统计聚集 （判定的内部形式是离散的，「分布」
* 是连续化投影——经验规则：编码不是类型）；分位数值 = 工程采样
* （经验规则 数值只证伪不证实——边界「是多少」不可内部推导）。
*/
function getSessionGrayZone(sessionKey) {
	const s = sessionKey ? _gammaStats.get(sessionKey) : void 0;
	if (!s || (s.n ?? 0) < GRAY_ZONE_MIN_SAMPLES || !s.hist) return {
		min: GRAY_ZONE_MIN,
		max: GRAY_ZONE_MAX
	};
	const total = s.n;
	const q = (p) => {
		const target = p * total;
		let cum = 0;
		for (let i = 0; i < HIST_BUCKETS; i++) {
			cum += s.hist[i] ?? 0;
			if (cum >= target) return (i + .5) / HIST_BUCKETS;
		}
		return 1;
	};
	let min = q(GRAY_ZONE_P20);
	let max = q(GRAY_ZONE_P70);
	const MIN_GRAY_GAP = .03;
	if (max - min < MIN_GRAY_GAP) {
		const med = q(.5);
		min = Math.max(0, med - MIN_GRAY_GAP);
		max = Math.min(1, med + MIN_GRAY_GAP);
	}
	return {
		min,
		max
	};
}
/** 全局 gamma EMA 平均（继承 OpenClaw 的压缩习惯作为新 session 冷启动值）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
function globalGammaEMA() {
	if (_gammaStats.size === 0) return null;
	let sum = 0, weight = 0;
	for (const s of _gammaStats.values()) {
		sum += s.ema * s.n;
		weight += s.n;
	}
	return weight > 0 ? sum / weight : null;
}
function getGammaEMA(sessionKey) {
	const s = _gammaStats.get(sessionKey);
	if (!s || s.n < COLD_START_ROUNDS) {
		if (s && s.recent && s.recent.length > 0) {
			const recent = s.recent;
			const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
			const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
			return .02 + Math.min(.03, Math.sqrt(variance) * .6);
		}
		return COLD_START_THRESHOLD;
	}
	return Math.max(COLD_START_THRESHOLD, s.ema);
}
let _sessionsSeedLoaded = false;
function initMbsf(dataDir) {
	const statDir = _derivedDirFor(dataDir);
	_gammaStatsPath = path.join(statDir, "gamma-stats.json");
	_grayZonePath = path.join(statDir, "gray-zone.json");
	try {
		_loadLatency(dataDir);
	} catch (e) {
		console.error("[MBSF] 压缩统计恢复失败（不阻塞启动）:", e.message);
	}
	try {
		if (fs.existsSync(_gammaStatsPath)) {
			const { keys, entries, skippedFp, skippedTest } = sanitizeGammaRecovery(JSON.parse(fs.readFileSync(_gammaStatsPath, "utf8")));
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				const v = entries[i];
				const s = {
					ema: v.ema,
					n: v.n,
					recent: v.recent ?? [],
					hist: v.hist ?? new Array(HIST_BUCKETS).fill(0)
				};
				_gammaStats.set(k, s);
				_touchGammaAccess(k);
			}
			const skippedNote = [skippedFp > 0 ? `滤除 fp: 伪会话 ${skippedFp}` : "", skippedTest > 0 ? `滤除存量测试键 ${skippedTest}` : ""].filter(Boolean).join("，");
			log(`📊 恢复 gamma EMA: ${_gammaStats.size} 会话${skippedNote ? `（${skippedNote}）` : ""}`);
		}
	} catch (e) {
		console.error("[MBSF] gamma 恢复失败:", e.message);
	}
	try {
		if (fs.existsSync(_grayZonePath)) {
			_grayZoneSummary = JSON.parse(fs.readFileSync(_grayZonePath, "utf8"));
			const realSessions = {};
			for (const [k, v] of Object.entries(_grayZoneSummary.sessions ?? {})) if (isRecoverableSessionKey(k)) realSessions[k] = v;
			_grayZoneSummary.sessions = realSessions;
			log(`🌫️ 恢复 gray-zone: ${_grayZoneSummary.grayHits}/${_grayZoneSummary.totalMessages} hits`);
		}
	} catch (e) {
		console.error("[MBSF] gray-zone 恢复失败:", e.message);
	}
	if (!_sessionsSeedLoaded) {
		try {
			const sessionsPath = path.join(dataDir, "sessions.json");
			if (fs.existsSync(sessionsPath)) {
				const raw = JSON.parse(fs.readFileSync(sessionsPath, "utf8"));
				let seeded = 0;
				for (const [k, v] of Object.entries(raw)) if (v?.omega && _sessionOmegas.size < MAX_SESSIONS) {
					_sessionOmegas.set(k, v.omega);
					_touchSessionAccess(k);
					seeded++;
				}
				log(`🧠 种子 session ω: ${seeded} 个 (来自 OpenClaw sessions.json)`);
			}
		} catch (e) {
			console.error("[MBSF] -sessions 种子加载失败:", e.message);
		}
		_sessionsSeedLoaded = true;
	}
}
function _saveGammaStats() {
	if (!_gammaStatsPath) return;
	if (_gammaStats.size === 0 && !fs.existsSync(_gammaStatsPath)) return;
	if (_gammaSaveTimer) return;
	_gammaSaveTimer = setTimeout(() => {
		_gammaSaveTimer = null;
		try {
			const dataDir = path.dirname(_gammaStatsPath);
			if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
			const obj = {};
			for (const [k, v] of _gammaStats) obj[k] = v;
			fs.writeFileSync(_gammaStatsPath, JSON.stringify(obj));
			if (_grayZonePath) fs.writeFileSync(_grayZonePath, JSON.stringify(_grayZoneSummary));
		} catch (e) {
			console.error("[MBSF] gamma 保存失败:", e.message);
		}
	}, GAMMA_SAVE_DEBOUNCE_MS);
}
/** γ 计算采样窗口（2026-08-26 降本）：γ 已退出压缩判定（§2.7 两层
*  离散识别接管），gammaProfile 只作位置层诊断登记；全量 doEncode 是
*  latency 大头（~600ms EMA），采样最近 N 条保留观察，历史条 γ 置 -1
*  （未采样标记——非真实冗余度，消费方应跳过）。记忆登记（indexMessage）
*  不受采样影响——全量进行。 */
const GAMMA_PROFILE_SAMPLE = 20;
function gammaProfile(messages, sessionKey, agent, onRecord) {
	const sessionOmega = sessionKey ? getSessionOmega(sessionKey) : symmetricInitial();
	const profile = [];
	for (let i = 0; i < messages.length; i++) {
		const role = messages[i]?.role || "?";
		const text = extractText(messages[i]);
		const sourceForm = messages[i]?.source?.form;
		const src = messages[i]?.source;
		const isTool = isToolMessage(src, role);
		if (text.length < 10) {
			profile.push({
				index: i,
				gamma: 0,
				role,
				preview: "[short]",
				isTool
			});
			continue;
		}
		if (isTool) {
			profile.push({
				index: i,
				gamma: 0,
				role,
				preview: `[tool|${text.length}B]`,
				isTool
			});
			continue;
		}
		let gamma;
		if (i >= messages.length - GAMMA_PROFILE_SAMPLE) {
			try {
				const { omega } = doEncode(text);
				gamma = 1 - cosineSimilarity(omega, sessionOmega);
			} catch (e) {
				if (process.env.MBSF_DEBUG) console.error("[MBSF] gammaProfile encode 失败:", e.message);
				gamma = 0;
			}
			updateGammaStats(sessionKey, gamma);
		} else gamma = -1;
		let regTopicId;
		let regIsNew;
		if (onRecord && isMemorableText(text, role, sourceForm, src)) try {
			const reg = onRecord({
				text,
				sessionKey,
				index: i,
				ts: Date.now(),
				...agent ? { agent } : {},
				...role === "user" || role === "assistant" ? { msgRole: role } : {}
			});
			if (reg) {
				regTopicId = reg.topicId;
				regIsNew = reg.isNew;
			}
		} catch (e) {
			if (process.env.MBSF_DEBUG) console.error("[MBSF] 索引登记失败:", e.message);
		}
		profile.push({
			index: i,
			gamma,
			role,
			preview: safeSlice(text, 50).replace(/\n/g, " "),
			isTool: false,
			...regTopicId === void 0 ? {} : { topicId: regTopicId },
			...regIsNew === void 0 ? {} : { isNew: regIsNew }
		});
	}
	return profile;
}
function buildFootprintIndex(segments = []) {
	const fp = {
		segments: [],
		index: /* @__PURE__ */ new Map()
	};
	for (const seg of segments) addFootprintSegment(fp, seg);
	return fp;
}
/** 追加一段特征（增量更新索引）。 */
function addFootprintSegment(fp, seg) {
	const si = fp.segments.length;
	fp.segments.push(seg);
	seg.forEach((tok, pi) => {
		let arr = fp.index.get(tok);
		if (!arr) {
			arr = [];
			fp.index.set(tok, arr);
		}
		arr.push({
			seg: si,
			pos: pi
		});
	});
}
/** spans[start..start+len) 是否在某段内作为连续子串出现（第一层整条判定）。 */
function _containsRun(spans, start, len, fp) {
	if (len <= 0) return true;
	const cands = fp.index.get(spans[start].tok);
	if (!cands) return false;
	for (const { seg, pos } of cands) {
		const segArr = fp.segments[seg];
		if (pos + len > segArr.length) continue;
		let ok = true;
		for (let j = 1; j < len; j++) if (segArr[pos + j] !== spans[start + j].tok) {
			ok = false;
			break;
		}
		if (ok) return true;
	}
	return false;
}
/** 从 start 起的最长共享片段长度（在特征某段中连续出现）。 */
function _longestRunAt(spans, start, fp) {
	const cands = fp.index.get(spans[start].tok);
	if (!cands) return 0;
	let best = 0;
	for (const { seg, pos } of cands) {
		const segArr = fp.segments[seg];
		let k = 1;
		while (start + k < spans.length && pos + k < segArr.length && segArr[pos + k] === spans[start + k].tok) k++;
		if (k > best) best = k;
	}
	return best;
}
/** 两层离散识别判定（§2.7，2026-08-25）：
*  第一层：整条连续子串 → fully=true，全部压缩（识别——同一条消息
*    再次出现 = 结构的重复展开，不占原文预算）；
*  第二层：贪心最长共享片段切分（从左到右），逐片段二值——已识别片段
*    压缩（承接点延续等同冗余步），未识别 token 保留（增量 = 新方向）；
*  无共享 → 全部保留（真新方向）。
*  单 token 共享 = 该已识别（压缩该 token，保留其余）。
*  零阈值零比例零编码——判定 = 纯 token 级子串包含（二值），无近似。 */
function recognizeLevels(spans, fp) {
	if (spans.length === 0) return {
		fully: true,
		recognized: []
	};
	if (_containsRun(spans, 0, spans.length, fp)) return {
		fully: true,
		recognized: spans.map(() => true)
	};
	const recognized = spans.map(() => false);
	let i = 0;
	while (i < spans.length) {
		const k = _longestRunAt(spans, i, fp);
		if (k >= 1) {
			for (let j = 0; j < k; j++) recognized[i + j] = true;
			i += k;
		} else i += 1;
	}
	return {
		fully: false,
		recognized
	};
}
/** 消息内自识别判定（2026-11-03 审计——与 recognizeLevels 的跨消息判定
*  结构，只换参照范围）。
*
*  为什么单列而不改 recognizeLevels：recognizeLevels 另有调用方
*  （structuralTailStart）语义是「这条消息相对**之前一切**」——那里若允许
*  消息内自识别，同一条消息内部的重复会被当成「已闭合链回声」推进闭合
*  边界 ⟹ 闭合边界失真（该消息其实还在展开）。故 recognizeLevels 保持纯
*  语义不动，自识别的范围扩到「消息内已走过的 token + 跨消息特征」只在此
*  判定使用。
*
*  ：同一动作重复——同一条消息里第二次出现的相同串 token 与跨消息
*  第二次出现是同一件事（到达同一结果），没有理由一个压缩一个不压缩。
*  旧实现只在消息之间推进特征（addFootprintSegment 在循环末尾），消息内
*  800 次重复全算「全新方向」⟹ 单条 30k 粘贴自带 95% 冗余却不被识别。
*
*  段边界保持：pending 暂存未识别 token，**不边判定边进 fp**——否则一条
*  消息的未识别部分会碎成多段，破坏「跨段不匹配」的承接点语义（只能匹配
*  单 token）。判定完成后仍作为一个整段交给调用方。
*
*  零阈值零比例零编码——仍是纯 token 级连续子串包含（二值），无近似。 */
function recognizeLevelsSelf(spans, fp) {
	if (spans.length === 0) return {
		fully: true,
		recognized: []
	};
	if (_containsRun(spans, 0, spans.length, fp)) return {
		fully: true,
		recognized: spans.map(() => true)
	};
	const recognized = spans.map(() => false);
	const local = {
		segments: [spans.map((s) => s.tok)],
		index: /* @__PURE__ */ new Map()
	};
	const SELF_MIN_RUN = 2;
	/** 已扫过的原文前缀长度（= 参照域边界）。 */
	let walked = 0;
	const walk = (upto) => {
		for (; walked < upto; walked++) {
			const tok = spans[walked].tok;
			const arr = local.index.get(tok);
			if (arr) arr.push({
				seg: 0,
				pos: walked
			});
			else local.index.set(tok, [{
				seg: 0,
				pos: walked
			}]);
		}
	};
	let i = 0;
	while (i < spans.length) {
		let k = _longestRunAt(spans, i, fp);
		if (k === 0) {
			const lk = _longestRunAt(spans, i, local);
			if (lk >= SELF_MIN_RUN) k = lk;
		}
		if (k >= 1) {
			for (let j = 0; j < k; j++) recognized[i + j] = true;
			i += k;
			walk(i);
		} else {
			i += 1;
			walk(i);
		}
	}
	return {
		fully: false,
		recognized
	};
}
/**
* 保留文本（类代表）——两种形态，按消息内部结构选：
*
*  ① **内部重复压缩**：消息 = 同段重复 N 遍（首段未识别 + 其后整块识别，
*     且识别块 ≥ 3× 首段）→ 保留首段 + `…（×N）`。这是消息内部的类内归并
*     （②）——同一条消息里的副本也是类内冗余，不该全带进摘要。
*  ② **整条保留**：其余情形一律整条原文。理由：第二层单 token 命中会把长句
*     的大部分判成「已识别」，只拼未识别段会留下孤立字（实测「👤 2日志级」
*     = 「第 2 个问题：日志分级…」的残段）——碎片认不出类别，不能作类代表
*     （③ 链节点须完整段）。中间的零星已识别字属于同一句的虚词，
*     整条保留才读得通。
*
*  2026-11-08：替代旧的「按字符 safeSlice 硬切」（切碎类代表，实测 96% 碎片）
*  与「短间隙合并」（实机的已识别块往往整句长，合并后仍碎）。 */
function _keptTextForSummary(spans, recognized, text) {
	const segs = [];
	let i = 0;
	while (i < spans.length) {
		const r = recognized[i] === true;
		let end = spans[i].end;
		let count = 1;
		let j = i + 1;
		while (j < spans.length && recognized[j] === true === r) {
			end = spans[j].end;
			count++;
			j++;
		}
		segs.push({
			start: spans[i].start,
			end,
			recognized: r,
			count
		});
		i = j;
	}
	const first = segs[0];
	if (first && !first.recognized && segs.length <= 3 && segs.slice(1).every((x) => x.recognized)) {
		const repCount = segs.slice(1).reduce((n, x) => n + x.count, 0);
		if (repCount >= first.count * INTERNAL_FOLD_MIN_RATIO) return `${text.slice(first.start, first.end)}…（×${Math.round(repCount / Math.max(1, first.count)) + 1}）`;
	}
	return text;
}
/** 两层离散识别压缩摘要：完全识别压缩（识别）、部分识别保留增量
* （未识别片段 = 新方向）、无共享全保留。零 LLM、零 γ/cos 判定
* （2026-08-25 §2.7 干净方案——判定 = token 级子串包含，见头注释）。
* 输出顺序：前序摘要 → 压缩行（本轮结构）→ 增量原文（本轮方向）→
* tool 压缩（执行产物）。 */
/** 前序 checkpoint 帧压缩——**按行类型二分，不按层**（2026-11-03 重写）。
*
*  ⚠️ 2026-11-03 撤回旧实现（2026-08-30 版）：旧实现「每层只留标签行
*  （γ 帧头 + 识别压缩计数）」——留的恰好是**运行记录**，丢的恰好是
*  **记录**。实测（session-f6ffb7bc）：835 层帧里 840 条子行 = 835 条
*  `[γ 压缩 …]` + **5 条识别预览**（唯一载荷），且 198/198 帧增量原文
*  （👤/🐾）为 **0 行**——方向 100% 饿死。根因是代数必然：
*  `keptAvail = max(0, keptBudget − chars)`，chars 含 836 行 ≈ 37k，
*  keptBudget = 17k ⟹ 恒为 0 ⟹ 每条待保留消息 alloc=0。
*
*  **判据（先验，不靠实测）：测地线原则——每个结构只在它第一次产生的
*  地方定义。**
*    · `[γ 压缩 N→摘要 | 保留 M | EMA x | Tms]` = 压缩动作的**运行记录**，
*      首现处 = `compaction-log.jsonl`（`_recordFold` 已独立落盘）⟹ 帧体
*      里是**重复定义** ⟹ 删。
*    · `· 第 209 轮。先读上轮 2530-3 的原文…` = 被识别出来的**方向**，
*      首现处 = 只在这里 ⟹ 保留。
*  旧实现把这两类**恰好反着**处理。
*
*  **为什么不按「层」切**：旧帧的层与层之间没有可靠分界（`[前序压缩 N 层]`
*  只有块头，子行平铺）——实测 836 条子行里 835 条 γ + 1 条内容混在一起，
*  按层切会切错。按行类型切对**新旧两种格式同时成立**：835 层旧帧自动
*  塌成「无块头 + 内容若干行」，零数据迁移。
*
*  输出 = 保留行（识别压缩块 / 增量原文 / tool 压缩），封顶
*  `PREV_KEEP_CHARS`。历史要点本已在内容层/记忆库（可收录消息压缩前已入段
*  indexMessage，不可收录的由 archiveShadowedFrame 归档补内容层）——
*  checkpoint 帧 = 临时上下文不是唯一存储，需要细节时 recall。
*
*  🟡 诚实边界：`PREV_KEEP_CHARS` 是 **工程护栏 **，不是结构产生的
*  量。真正的结构解 = 把前序保留行当特征再进一次 deltaCompact（再合），
*  是二期；一期只保证方向不被饿死（前序块有界 ⟹ keptAvail 恢复正数）。
*/
function foldPreviousCheckpoint(previousSummary, maxChars) {
	/** 丢弃：γ 运行记录行（首现处 compaction-log.jsonl）。 */
	const gammaRe = /^·?\s*\[γ 压缩 [^\]]+\]/;
	/** 丢弃：前序压缩块头（旧格式的层标签容器——层信息已无意义）。 */
	const tagRe = /^\[前序压缩 \d+ 层/;
	const lines = previousSummary.split("\n");
	const kept = [];
	let budget = PREV_KEEP_CHARS;
	for (const raw of lines) {
		const ln = raw.trim();
		if (ln === "") continue;
		if (ln === "<compacted-by-MBSF>" || ln === "</compacted-by-MBSF>") continue;
		if (gammaRe.test(ln)) continue;
		if (tagRe.test(ln)) continue;
		if (budget <= 0) break;
		const take = safeSlice(ln, budget);
		kept.push(take);
		budget -= take.length;
	}
	if (kept.length === 0) return safeSlice(previousSummary.replace(/^\[γ 压缩 [^\]]+\]$/gm, "").trim(), Math.max(1, Math.min(PREV_KEEP_CHARS, Math.floor(maxChars * PREV_SUMMARY_RATIO))));
	return kept.join("\n");
}
function deltaCompact(messages, previousSummary, _sessionKey, maxChars = 4e3) {
	if (!messages?.length) return "";
	if (messages.length > 2e3) messages = messages.slice(-2e3);
	const fp = buildFootprintIndex(previousSummary ? [fragmentTokenSpans(previousSummary).map((s) => s.tok)] : []);
	const toolGroups = /* @__PURE__ */ new Map();
	let toolTotal = 0;
	const folded = /* @__PURE__ */ new Map();
	const kept = [];
	for (let i = 0; i < messages.length; i++) {
		const text = extractCompactableText(messages[i]);
		const role = messages[i]?.role || "unknown";
		const source = messages[i]?.source;
		if (isToolMessage(source, role)) {
			toolTotal++;
			const h = contentHash(text);
			const g = toolGroups.get(h);
			if (g) g.count++;
			else toolGroups.set(h, {
				count: 1,
				sample: text
			});
			continue;
		}
		if (role === "system" || isRuntimeContextText(text) || isInjectSource(source)) continue;
		const spans = fragmentTokenSpans(text);
		if (spans.length === 0) {
			const h = contentHash(text);
			const g = folded.get(h);
			if (g) g.count++;
			else folded.set(h, {
				count: 1,
				preview: safeSlice(text.replace(/\s+/g, " ").trim(), FOLD_PREVIEW_CHARS)
			});
			continue;
		}
		const rec = recognizeLevelsSelf(spans, fp);
		const keptCount = rec.recognized.reduce((n, r) => n + (r ? 0 : 1), 0);
		if (rec.fully || keptCount === 0) {
			const h = contentHash(text);
			const g = folded.get(h);
			if (g) g.count++;
			else folded.set(h, {
				count: 1,
				preview: safeSlice(text.replace(/\s+/g, " ").trim(), FOLD_PREVIEW_CHARS)
			});
			continue;
		}
		if (!rec.fully) {
			const keptToks = [];
			for (let j = 0; j < spans.length; j++) if (!rec.recognized[j]) keptToks.push(spans[j].tok);
			addFootprintSegment(fp, keptToks);
		}
		kept.push({
			index: i,
			text,
			role,
			keptCount,
			total: spans.length,
			spans,
			recognized: rec.recognized
		});
	}
	const roleTags = {
		user: "👤",
		assistant: "🐾",
		tool: "🔧",
		unknown: "❓"
	};
	const lines = [];
	if (previousSummary) lines.push(foldPreviousCheckpoint(previousSummary, maxChars), "");
	let chars = lines.join("\n").length;
	const foldedList = [...folded.values()];
	if (foldedList.length > 0) {
		const headLn = `[识别压缩 ${foldedList.reduce((n, g) => n + g.count, 0)} 条]`;
		const foldLines = [headLn];
		let fChars = headLn.length;
		for (const g of foldedList.slice(0, FOLD_MAX_PREVIEWS)) {
			const one = `  · ${g.preview}… ×${g.count}`;
			if (fChars + one.length > Math.floor(maxChars * FOLD_BUDGET_RATIO)) break;
			foldLines.push(one);
			fChars += one.length;
		}
		lines.push(...foldLines, "");
		chars = lines.join("\n").length;
	}
	const keptBudget = Math.max(0, maxChars - Math.floor(maxChars * FOLD_BUDGET_RATIO));
	const keptAvail = Math.max(0, keptBudget - chars);
	const order = [...kept].sort((a, b) => b.keptCount / b.total - a.keptCount / a.total || a.index - b.index);
	let rem = keptAvail;
	let droppedMessages = 0;
	let droppedSegmentsCount = 0;
	const chosen = [];
	for (const k of order) {
		if (rem <= 0) {
			droppedMessages++;
			droppedSegmentsCount += k.keptCount;
			continue;
		}
		const keptText = _keptTextForSummary(k.spans, k.recognized, k.text);
		const ln = `${roleTags[k.role] || ""} ${keptText}`;
		if (ln.length <= rem) {
			chosen.push({
				index: k.index,
				text: ln
			});
			rem -= ln.length;
		} else {
			droppedMessages++;
			droppedSegmentsCount += k.keptCount;
		}
	}
	for (const c of chosen.sort((a, b) => a.index - b.index)) {
		lines.push(c.text);
		chars += c.text.length;
	}
	if (droppedMessages > 0 || droppedSegmentsCount > 0) {
		const dropLn = `[丢弃 ${droppedMessages} 条未入摘要（${droppedSegmentsCount} 个未识别片段）]`;
		if (chars + dropLn.length <= maxChars) {
			lines.push(dropLn);
			chars += dropLn.length;
		}
	}
	if (toolTotal > 0) {
		const foldLn = `🔧 [${toolTotal} 条 tool 结果压缩 (${toolGroups.size} 类)]`;
		const samples = [...toolGroups.values()].sort((a, b) => b.count - a.count).slice(0, TOOL_SAMPLE_MAX);
		if (chars + foldLn.length <= maxChars && samples.length > 0) {
			lines.push(foldLn);
			chars += foldLn.length;
			for (const s of samples) {
				const one = `  · ${safeSlice(s.sample.replace(/\s+/g, " ").trim(), TOOL_SAMPLE_CHARS)}`;
				if (chars + one.length > maxChars) break;
				lines.push(one);
				chars += one.length;
			}
		} else if (chars + foldLn.length <= maxChars) {
			lines.push(foldLn);
			chars += foldLn.length;
		}
	}
	return stripLoneSurrogates(lines.join("\n"));
}
/**
* 结构 tail 起点（2026-08-25 审计——§2.7 残留 ⑥：γ 驱动 tail 撤出，
* 0.10.4  标定禁作判定 + 经验规则 编码不是类型 + 结构 5 连续量撤出判定路径）。
*
* ：tail = 当前未闭合链的锚点窗口。链头判定用识别结构（零阈值
* 零状态）：**闭合边界** = 整条消息完全识别（rec.fully 或第二层全部 token
* 已识别）——已闭合链的回声/总结（识别即止——分合不对称）；推进消息 =
* 有未识别内容，进增量特征（与 deltaCompact 压缩判定结构，tail 边界
* 与压缩边界同源）。tail 起点 = 最后闭合边界之后 = 当前未闭合链的链头；
* 无闭合边界（会话持续单链推进）= 无闭合证据，链头 = 区间起点，窗口上限
* MAX_TAIL_MESSAGES 兜底（近因窗口，前段链推进由 deltaCompact 增量压缩
* 进摘要——已识别内容不重复存储，不因窗口截断丢方向）。
* 特征 = 前序摘要片段 + 更早消息的未识别片段（增量）。全消息等同冗余步
* （无新增，不推进也不闭合）。零状态：不依赖会话 ω/γ EMA/时间。
*/
function structuralTailStart(messages, previousSummary, opts) {
	const raw = opts?.tailMessages;
	const tailMessages = typeof raw === "number" && Number.isFinite(raw) ? Math.min(256, Math.max(8, Math.round(raw))) : 64;
	const fp = buildFootprintIndex(previousSummary ? [fragmentTokenSpans(previousSummary).map((s) => s.tok)] : []);
	let lastClosed = -1;
	for (let i = 0; i < messages.length; i++) {
		const text = extractText(messages[i]);
		const role = messages[i]?.role || "unknown";
		const source = messages[i]?.source;
		if (isToolMessage(source, role)) continue;
		if (role === "system" || isRuntimeContextText(text) || isInjectSource(source)) continue;
		const spans = fragmentTokenSpans(text);
		if (spans.length === 0) continue;
		const rec = recognizeLevels(spans, fp);
		const keptCount = rec.recognized.reduce((n, r) => n + (r ? 0 : 1), 0);
		if (rec.fully || keptCount === 0) {
			lastClosed = i;
			continue;
		}
		const keptToks = [];
		for (let j = 0; j < spans.length; j++) if (!rec.recognized[j]) keptToks.push(spans[j].tok);
		addFootprintSegment(fp, keptToks);
	}
	const chainHead = lastClosed + 1;
	return Math.max(chainHead, messages.length - tailMessages);
}
function structuralTurnGate(events, mapped, endIdx, force, opts = {}) {
	let lastTurnEndSeq = -1;
	let lastTurnStartSeq = -1;
	for (let s = 0; s < events.length; s++) {
		const ev = events[s];
		if (ev === void 0) continue;
		if (ev.type === "turn/end") lastTurnEndSeq = s;
		else if (ev.type === "turn/start") lastTurnStartSeq = s;
	}
	return structuralTurnGateFromSeqs(lastTurnEndSeq, lastTurnStartSeq, mapped, endIdx, force, opts);
}
/**
* 同上，但**判据下标由调用方给出**（2026-09-14 阻塞治本）。
*
*  背景（看门狗实测 + 只读调查）：全量阻塞事件里 46%（252/547）的首位自耗时
*  是宿主的 `get events` / `snapshotEvents` 全量重建（1.3~2.1s/次），触发点
*  是本引擎 `index.ts` 为了喂本门而 `session.snapshotEvents()` 把整个事件数组
*  materialize 出来——而本门**只用两个下标**（最后一个 `turn/end`、最后一个
*  `turn/start`）。每回合两处压缩各付一次全量重建（pre-step + turn-stopping）。
*
*  倒扫版与全扫版**逐位等价**：全扫取「最后一个匹配下标」，倒扫取「第一个
*  匹配」（从尾部往前）＝ 同一个下标。调用方用 `session.eventAt(s)` 按序取
*  事件类型即可，无需整数组。无法安全判定时调用方回退全量路径（见 index.ts）。
*/
function structuralTurnGateFromSeqs(lastTurnEndSeq, lastTurnStartSeq, mapped, endIdx, force, opts = {}) {
	const closing = force || opts.allowOpenTurn === true;
	if (lastTurnEndSeq < 0) {
		if (!closing) return null;
	} else if (lastTurnStartSeq > lastTurnEndSeq && !closing) {
		while (endIdx >= 1 && mapped[endIdx].seq >= lastTurnStartSeq) endIdx--;
		if (endIdx < 1) return null;
	}
	return endIdx;
}
/**
* 未必记忆 γ 压缩主入口：对区间消息做 γ 分析 → 冗余压缩 + tail 保留判定 →
* 生成纯文本摘要。零 LLM 调用。
*/
function mbsfSummarize(messages, opts = {}) {
	const t0 = Date.now();
	const _timer = (tag) => {
		if (process.env.MBSF_TIMER) console.error(`[MBSF-TIMER] ${tag}: ${Date.now() - t0}ms`);
	};
	const dataDir = opts.dataDir ?? process.env.MBSF_DATA ?? path.join(process.env.HOME || "/tmp", ".mbsf");
	initMbsf(dataDir);
	_timer("initMbsf");
	const sk = normalizeSessionKey(opts.sessionKey, messages);
	_sessionLastAccess.set(sk, Date.now());
	updateSessionOmega(messages, sk);
	const profile = gammaProfile(messages, sk, opts.agent, opts.onRecord);
	_timer("gammaProfile");
	const tailStart = opts.wholeRegion ? Math.max(0, messages.length - 2) : structuralTailStart(messages, opts.previousSummary, { tailMessages: opts.tailMessages });
	const compactable = messages.slice(0, tailStart);
	const preserved = messages.slice(tailStart);
	_timer("structuralTailStart");
	let finalTailStart = tailStart;
	if (preserved.length < 2 && compactable.length > 0) finalTailStart = tailStart - Math.min(2 - preserved.length, compactable.length);
	const foldStart = Math.max(finalTailStart, profile.length - 2);
	const foldIdxs = [];
	let tailFpSegments = 0;
	if (foldStart > finalTailStart) {
		const fpTail = buildFootprintIndex(opts.previousSummary ? [fragmentTokenSpans(opts.previousSummary).map((s) => s.tok)] : []);
		tailFpSegments = fpTail.segments.length;
		for (let i = 0; i < finalTailStart; i++) addFootprintSegment(fpTail, fragmentTokenSpans(extractText(messages[i])).map((s) => s.tok));
		for (let i = finalTailStart; i < foldStart; i++) {
			const msg = messages[i];
			const role = msg?.role || "unknown";
			if (isToolMessage(msg?.source, role)) continue;
			if (msg?.source?.kind === "goal") continue;
			if (isInjectSource(msg?.source)) {
				foldIdxs.push(i);
				continue;
			}
			const spans = fragmentTokenSpans(extractText(messages[i]));
			if (spans.length === 0) {
				foldIdxs.push(i);
				continue;
			}
			if (recognizeLevels(spans, fpTail).fully) foldIdxs.push(i);
		}
	}
	_timer("tailFold");
	const compressable = messages.slice(0, finalTailStart);
	const tail = [];
	let foldedCount = 0;
	for (let i = finalTailStart; i < messages.length; i++) if (foldIdxs.includes(i)) {
		compressable.push(messages[i]);
		foldedCount++;
	} else tail.push(messages[i]);
	const compressedCount = compressable.length;
	const preservedCount = tail.length;
	const archivedCount = 0;
	const text = deltaCompact(compressable, opts.previousSummary, sk, opts.maxChars);
	_timer("deltaCompact");
	updateSessionOmega(messages, sk);
	_saveGammaStats();
	_timer("saveGammaStats");
	const gammaEMA = getGammaEMA(sk);
	log(`结构tail: ${messages.length}条 → tail=${preservedCount}条 压缩=${compressedCount}条${foldedCount > 0 ? ` (完全识别压缩${foldedCount})` : ""}, EMA=${gammaEMA.toFixed(4)}, ${Date.now() - t0}ms`);
	_lastSummarize = {
		at: Date.now(),
		elapsedMs: Date.now() - t0,
		messages: messages.length,
		compressed: compressedCount,
		preserved: preservedCount,
		archived: archivedCount,
		tailFpSegments,
		textChars: text.length
	};
	_recordLatency(dataDir, Date.now() - t0, messages.length, compressedCount);
	if (compressedCount > 0 || foldedCount > 0 || false) {
		const shadowChars = compressable.reduce((n, m) => n + extractCompactableText(m).length, 0);
		_recordFold(dataDir, {
			sessionKey: sk,
			inputMessages: messages.length,
			tailStart: finalTailStart,
			compressed: compressedCount,
			folded: foldedCount,
			archived: archivedCount,
			shadowChars,
			textChars: text.length,
			ema: gammaEMA,
			elapsedMs: Date.now() - t0
		});
	}
	return {
		text,
		profile,
		tailStart: finalTailStart,
		compressedCount,
		preservedCount,
		archivedCount,
		gammaEMA,
		elapsedMs: Date.now() - t0,
		newCoords: profile.filter((p) => p.isNew === true && typeof p.topicId === "string").slice(0, 12).map((p) => ({
			topicId: p.topicId,
			label: p.preview
		}))
	};
}
/**  压缩收益探针（2026-11-03 一帆「补探针，用真实数据再决定」固化）。
*
*  **为什么需要**：`_recordFold` 的 `textChars` 字段存的是**摘要长度**
*  （`text.length`），没有被压原文长度 ⟹ 「压缩到底省没省」算不出来 ⟹
*  无法判断压缩策略是正收益还是负收益，也无法判断「按字符密度选区间」
*  这个改造方向值不值得做。本探针把收支两面同时落盘。
*
*  **判据**（**纯字符差——工程定义，无需理论背书**；2026-11-03 审计撤回原注
*  「交替递推的工程含义」——字符减法与交替递推无关，属名称借用）：
*    净值 netChars = shadowChars − summaryChars
*    netChars ≤ 0        = 该次压缩净亏（理论上 shrink 校验会拦硬亏，
*                          但探针记录实际发生值——校验失效时可发现）
*    netChars 很小的正数 = 低效压缩（摘要省下的还不够补偿帧开销）
*
*  **为什么单开一个文件**：与 compaction-log.jsonl 分离——那个是「压缩
*  事件历史」（用户可查），这个是「收益诊断采样」（分析用），混在一起
*  会污染压缩历史的语义。文件名 compaction-yield.jsonl。
*
*  同步 append（压缩低频，毫秒级 IO 可忽略）；失败静默不影响主流程。
*/
function _recordCompactionYield(evt) {
	try {
		const dataDir = _derivedDirFor(process.env.MBSF_DATA ?? path.join(process.env.HOME || "/tmp", ".mbsf"));
		const line = JSON.stringify({
			ts: Date.now(),
			type: "yield",
			...evt
		}) + "\n";
		fs.appendFileSync(path.join(dataDir, "compaction-yield.jsonl"), line);
	} catch (e) {
		if (process.env.MBSF_DEBUG) console.error("[MBSF] 压缩收益探针落盘失败:", e.message);
	}
}
/** 压缩收益探针（供 compaction.ts 的 summarize 调用）。
*  参数语义见 `_recordCompactionYield`。 */
function recordCompactionYield(evt) {
	_recordCompactionYield(evt);
}
/** 脑状态总览（skill 自检/监控用）。 */
function mbsfStats() {
	return {
		encoder: {
			D,
			NP,
			version: " 编码",
			resonance: _useResonance
		},
		sessions: {
			active: _sessionOmegas.size,
			seededFromOpenClaw: _sessionsSeedLoaded
		},
		gamma: {
			trackedSessions: _gammaStats.size,
			globalEMA: globalGammaEMA()
		},
		grayZone: _grayZoneSummary
	};
}
_loadLatency(process.env.MBSF_DATA ?? path.join(process.env.HOME || "/tmp", ".mbsf"));
//#endregion
//#region lib/types/attempt-throttle.js
let _turnStop = /* @__PURE__ */ new WeakMap();
let _userTurn = /* @__PURE__ */ new WeakMap();
/** 回合收尾兜底：认领 (agent, surface 末节点 seq) —— 同一状态位置只压一次。 */
function claimTurnStopAttempt(agent, seq) {
	if ((_turnStop.get(agent) ?? -1) >= seq) return false;
	_turnStop.set(agent, seq);
	return true;
}
/** user-message 折叠：认领 (agent, 回合号) —— 同一回合只压一次。 */
function claimUserTurnFold(agent, turn) {
	if (_userTurn.get(agent) === turn) return false;
	_userTurn.set(agent, turn);
	return true;
}
/** 已折叠的回合号（只读——调用方原有的 `!== turn` 判断）。 */
function userTurnFoldedOf(agent) {
	return _userTurn.get(agent);
}
/** 压缩 tail 近因窗口（条）的范围与默认值（2026-11-08 一帆定：8–256）。
*  工程值——N 是窗口参数（非结构量），无明确依据。
*  `tailStart = max(chainHead, len − N)`：
*   N 越大 → `len − N` 越小 → 结构边界 chainHead 越容易被采用；
*   但 chainHead 从未靠后时（无闭合），`len − N` 变小只是让 tail 保留更多；
*   当 **N ≥ 当前消息数** 时 `len − N ≤ 0` ⟹ tailStart 退化为 chainHead
*   （无闭合则 0）⟹ 该会话**不压缩**（静默失效——UI 需提示）。 */
const COMPACT_TAIL_MESSAGES_MIN = 8;
const COMPACT_TAIL_MESSAGES_MAX = 256;
/** 把任意输入钳到合法 tail 窗口（8–256，整数）。 */
function clampTailMessages(value) {
	return Math.min(256, Math.max(8, typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 64));
}
/** DSH 堆上限默认值（MB）——16GB 机器的一半（与 dsh-web 启动器的
*  DEFAULT_HEAP_MB 同值——两条启动路径的默认必须一致）。 */
/** [OBS] 物理资源参照（本机 16GB 的一半）——**外部约束值不是内容常数**：必须与
*  dsh-web 启动器的 `DEFAULT_HEAP_MB` 一致（两条启动路径默认不同 = 用户换个入口
*  就崩，2026-11-01 事故即此类）。不进判定层。 */
const DSH_HEAP_DEFAULT_MB = 8192;
/** 堆上限的合法下界（MB）——低于 node 默认（本机实测 4288）无意义。
*  [OBS] 物理资源护栏——V8 老生代下限，低于它设了也等于没设。 */
const DSH_HEAP_MIN_MB = 4096;
/** 自动释放阈值的合法下界（%）——防「一启动就清」（启动窗口缓存在建，清了必白清）。
*  [OBS] UI 输入护栏——启动路径实测只到 ~1.2GB（initMemoryIndex 586MB +
*  prewarm 1222MB），20% × 4192 ≈ 838MB 恰好在其下 ⟹ 不会白清。 */
const AUTO_RECLAIM_PCT_MIN = 20;
/** 自动释放阈值的合法上界（%）——留安全余量（100% = 已经 OOM，来不及清）。
*  [OBS] UI 输入护栏——⚠️ **注意分母不可靠**：实测 V8 在 ~3050MB（名义 4192MB
*  的 73%）就 `last resort` ⟹ 高百分比区间实际不可用（见 `EMERGENCY_PCT` 注释）。 */
const AUTO_RECLAIM_PCT_MAX = 95;
/** 自动释放阈值的默认值（%）——60% 时清一次，兼顾「别太频繁」与「别到 OOM 才动」。
*  [OBS] 与 `EMERGENCY_PCT`（65%）同量级但**语义不同**：60% = 常规路径阈值
*  （还要等 `isIdle()`），65% = 紧急路径阈值（不等空闲）。60% × 4192 ≈ 2515MB，
*  比最低死亡点 3022.7MB 低 508MB ⟹ 常规路径理论上先于紧急路径触发。 */
const AUTO_RECLAIM_PCT_DEFAULT = 60;
/** 系统保留内存（MB）——算上限时从物理内存里扣掉（macOS 系统 + 浏览器
*  + 其他应用）。
*  [OBS] 物理资源参照（6GB 经验值）——16GB 机器 → 上限 16−6 = 10GB，
*  再向下取整到 GB。外部约束值，不进判定层。 */
const DSH_HEAP_RESERVE_MB = 6144;
/** 本机允许的最大堆上限（MB）——物理内存 − 系统保留，向下取整到 GB，
*  下界 4096。
*
*  **为什么用 totalmem 而非 freemem**：macOS 把空闲内存尽量用作文件缓存，
*  freemem 实测只有 88MB（用它算上限会得到 0）。物理总量才是真边界。 */
function resolveDshHeapMaxMb() {
	const totalMb = totalmem() / 1048576;
	const maxMb = Math.floor((totalMb - DSH_HEAP_RESERVE_MB) / 1024) * 1024;
	return Math.max(DSH_HEAP_MIN_MB, maxMb);
}
/** 堆上限默认值——不超过本机允许的最大值（小内存机器自动降档）。 */
function defaultDshHeapMb() {
	return Math.min(DSH_HEAP_DEFAULT_MB, resolveDshHeapMaxMb());
}
/** 堆上限合法域钳制：0（不注入）或 ≥ 4096（取整到 1024）。
*  同 normalizeCleanupPruneTurns 的「0 或 ≥N」形态（UI 滑块拖进空洞时用）。 */
function normalizeDshHeapMb(value) {
	if (!Number.isFinite(value) || value <= 0) return 0;
	if (value < 4096) return DSH_HEAP_MIN_MB;
	return Math.floor(value / 1024) * 1024;
}
/** 崩溃快照目录（`--diagnostic-dir` 指向它）。**必须在起 dsh 前建好**——
*  V8 不会自建（实测：目录不存在时快照静默丢失）。 */
function heapSnapshotDir() {
	return join(resolveMbsfDataDir(), "heap-snapshots");
}
/**
* 把堆配置注入 execArgv（重启 dsh 用）。
*
* 规则：
*  - `dshHeapMb <= 0` → 原样返回（不注入，尊重 node 默认）
*  - 已含 `--max-old-space-size` → 原样返回（尊重显式配置，同 dsh-web 先例）
*  - 否则追加 `--max-old-space-size=N` + `--heapsnapshot-near-heap-limit=1`
*    + `--diagnostic-dir=<快照目录>`
*
*  **为什么连 heapsnapshot 一起注入**：接近上限时 V8 自动 dump 堆快照——
*  下次 OOM 崩了有确凿证据（当前 3.6G/4.28G 余量只剩 600MB，需要证据链）。
*
*  **为什么必须带 diagnostic-dir**：`--heapsnapshot-near-heap-limit` 默认
*  把快照写进 **cwd**——dsh 的 cwd 是 `/Users/ai/deepseek-harness`，一次
*  268MB 的快照会污染 dsh 检出（实测确认）。指向 `~/.mbsf/heap-snapshots/`
*  才是对的落点。
*
* @param execArgv - 原 execArgv（不改原数组）。
* @returns 注入后的新数组。
*/
function withDshHeapFlags(execArgv) {
	const next = [...execArgv];
	const config = getRuntimeConfig();
	if (config.dshHeapMb <= 0) return next;
	const isDesktop = Boolean(process.versions.electron);
	if (!isDesktop && next.some((a) => a.startsWith("--max-old-space-size"))) return next;
	const filtered = isDesktop ? next.filter((a) => !a.startsWith("--max-old-space-size")) : next;
	filtered.push(`--max-old-space-size=${config.dshHeapMb}`);
	filtered.push("--heapsnapshot-near-heap-limit=1");
	filtered.push(`--diagnostic-dir=${heapSnapshotDir()}`);
	return filtered;
}
/** 确保快照目录存在（起 dsh 前调用——V8 不自建）。 */
function ensureHeapSnapshotDir() {
	try {
		mkdirSync(heapSnapshotDir(), { recursive: true });
	} catch {}
}
const CONFIG_FILE = "config.json";
let _runtimeConfig = null;
let _configPath = null;
/** 脑数据目录（与 mbsfSummarize 同一解析：env 覆盖，默认 ~/.mbsf）。 */
function resolveMbsfDataDir() {
	return process.env.MBSF_DATA ?? join(process.env.HOME || "/tmp", ".mbsf");
}
function defaults() {
	return {
		injectEnabled: process.env.MBSF_INJECT_DISABLED === "0",
		dateAnchorEnabled: process.env.MBSF_DATE_ANCHOR_DISABLED !== "1",
		autoCompact: true,
		restartCleanupEnabled: false,
		cleanupPruneTurns: 0,
		backupKeepCount: 3,
		restartButtonVisible: false,
		activityIndicatorEnabled: true,
		activityLabelEnabled: true,
		sessionStreamKeepCount: 200,
		dshHeapMb: defaultDshHeapMb(),
		autoReclaimEnabled: false,
		autoReclaimThresholdPct: 60,
		compactTailMessages: 64
	};
}
/** 加载（首次）或返回缓存的运行时配置；config.json 覆盖 env 默认。 */
function loadRuntimeConfig() {
	if (_runtimeConfig) return _runtimeConfig;
	const value = defaults();
	const p = join(resolveMbsfDataDir(), CONFIG_FILE);
	_configPath = p;
	try {
		if (existsSync(p)) {
			const raw = JSON.parse(readFileSync(p, "utf8"));
			if (typeof raw.injectEnabled === "boolean") value.injectEnabled = raw.injectEnabled;
			if (typeof raw.dateAnchorEnabled === "boolean") value.dateAnchorEnabled = raw.dateAnchorEnabled;
			if (typeof raw.autoCompact === "boolean") value.autoCompact = raw.autoCompact;
			if (typeof raw.restartCleanupEnabled === "boolean") value.restartCleanupEnabled = raw.restartCleanupEnabled;
			if (typeof raw.cleanupPruneTurns === "number" && Number.isFinite(raw.cleanupPruneTurns) && (raw.cleanupPruneTurns === 0 || raw.cleanupPruneTurns >= 3)) value.cleanupPruneTurns = Math.floor(raw.cleanupPruneTurns);
			if (typeof raw.backupKeepCount === "number" && Number.isFinite(raw.backupKeepCount) && raw.backupKeepCount >= 0) value.backupKeepCount = Math.floor(raw.backupKeepCount);
			if (typeof raw.restartButtonVisible === "boolean") value.restartButtonVisible = raw.restartButtonVisible;
			if (typeof raw.activityIndicatorEnabled === "boolean") value.activityIndicatorEnabled = raw.activityIndicatorEnabled;
			if (typeof raw.activityLabelEnabled === "boolean") value.activityLabelEnabled = raw.activityLabelEnabled;
			if (typeof raw.sessionStreamKeepCount === "number" && Number.isFinite(raw.sessionStreamKeepCount) && raw.sessionStreamKeepCount >= 0) value.sessionStreamKeepCount = Math.floor(raw.sessionStreamKeepCount);
			if (typeof raw.dshHeapMb === "number" && Number.isFinite(raw.dshHeapMb) && (raw.dshHeapMb === 0 || raw.dshHeapMb >= 4096)) value.dshHeapMb = normalizeDshHeapMb(raw.dshHeapMb);
			if (typeof raw.autoReclaimEnabled === "boolean") value.autoReclaimEnabled = raw.autoReclaimEnabled;
			if (typeof raw.autoReclaimThresholdPct === "number" && Number.isFinite(raw.autoReclaimThresholdPct) && raw.autoReclaimThresholdPct >= 20 && raw.autoReclaimThresholdPct <= 95) value.autoReclaimThresholdPct = Math.round(raw.autoReclaimThresholdPct);
			if (typeof raw.compactTailMessages === "number" && Number.isFinite(raw.compactTailMessages)) value.compactTailMessages = clampTailMessages(raw.compactTailMessages);
		}
	} catch {}
	_runtimeConfig = value;
	return _runtimeConfig;
}
/** 当前运行时配置（惰性加载）。 */
function getRuntimeConfig() {
	return loadRuntimeConfig();
}
/**
* 应用部分配置变更：更新内存单例 + 合并落盘 config.json。
* @param partial - 变更字段（undefined 字段忽略）。
* @returns 应用后的完整配置（副本）。
*/
function setRuntimeConfig(partial) {
	const current = loadRuntimeConfig();
	if (partial.injectEnabled !== void 0) current.injectEnabled = partial.injectEnabled;
	if (partial.dateAnchorEnabled !== void 0) current.dateAnchorEnabled = partial.dateAnchorEnabled;
	if (partial.autoCompact !== void 0) current.autoCompact = partial.autoCompact;
	if (partial.restartCleanupEnabled !== void 0) current.restartCleanupEnabled = partial.restartCleanupEnabled;
	if (partial.cleanupPruneTurns !== void 0 && Number.isFinite(partial.cleanupPruneTurns) && (partial.cleanupPruneTurns === 0 || partial.cleanupPruneTurns >= 3)) current.cleanupPruneTurns = Math.floor(partial.cleanupPruneTurns);
	if (partial.backupKeepCount !== void 0 && Number.isFinite(partial.backupKeepCount) && partial.backupKeepCount >= 0) current.backupKeepCount = Math.floor(partial.backupKeepCount);
	if (partial.restartButtonVisible !== void 0) current.restartButtonVisible = partial.restartButtonVisible;
	if (partial.activityIndicatorEnabled !== void 0) current.activityIndicatorEnabled = partial.activityIndicatorEnabled;
	if (partial.activityLabelEnabled !== void 0) current.activityLabelEnabled = partial.activityLabelEnabled;
	if (partial.sessionStreamKeepCount !== void 0 && Number.isFinite(partial.sessionStreamKeepCount) && partial.sessionStreamKeepCount >= 0) current.sessionStreamKeepCount = Math.floor(partial.sessionStreamKeepCount);
	if (partial.dshHeapMb !== void 0 && Number.isFinite(partial.dshHeapMb) && (partial.dshHeapMb === 0 || partial.dshHeapMb >= 4096)) current.dshHeapMb = normalizeDshHeapMb(partial.dshHeapMb);
	if (partial.autoReclaimEnabled !== void 0) current.autoReclaimEnabled = partial.autoReclaimEnabled;
	if (partial.autoReclaimThresholdPct !== void 0 && Number.isFinite(partial.autoReclaimThresholdPct) && partial.autoReclaimThresholdPct >= 20 && partial.autoReclaimThresholdPct <= 95) current.autoReclaimThresholdPct = Math.round(partial.autoReclaimThresholdPct);
	if (partial.compactTailMessages !== void 0 && Number.isFinite(partial.compactTailMessages)) current.compactTailMessages = clampTailMessages(partial.compactTailMessages);
	const p = _configPath ?? join(resolveMbsfDataDir(), CONFIG_FILE);
	_configPath = p;
	try {
		mkdirSync(dirname(p), { recursive: true });
		const existing = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
		writeFileSync(p, JSON.stringify({
			...existing,
			...current
		}, null, 2));
	} catch {}
	return { ...current };
}
//#endregion
//#region lib/types/session-reset.js
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
const SESSION_RESET_MIN_TURNS = 10;
/** 请求文件路径（脑数据目录内，会话目录之外）。 */
/**
* 查出**本进程**（引擎跑在 host 进程内 ⟹ 就是 host）正在监听的 web 端口。
*
* 用 `lsof -a -p <pid> -iTCP -sTCP:LISTEN` 取本进程的 LISTEN 端口，排除进度页
* （3081）与本地网关（8790）之类非 web 面端口；取不到返回 undefined（调用方回退
* 到候选表）。
*/
function detectOwnWebPort() {
	try {
		const out = execFileSync("lsof", [
			"-a",
			"-p",
			String(process.pid),
			"-iTCP",
			"-sTCP:LISTEN",
			"-P",
			"-n"
		], { encoding: "utf8" });
		const ports = [];
		for (const line of out.split("\n").slice(1)) {
			const m = /:(\d+)\s*\(LISTEN\)/.exec(line);
			if (m === null) continue;
			const port = Number(m[1]);
			if (Number.isSafeInteger(port) && port > 0 && port !== 3081 && port !== 8790 && !ports.includes(port)) ports.push(port);
		}
		return ports[0];
	} catch {
		return;
	}
}
function resetRequestPath() {
	return join(resolveMbsfDataDir(), "session-reset-request.json");
}
/** 读请求文件；不存在/坏 JSON 返回 undefined。 */
function readResetRequest() {
	const path = resetRequestPath();
	if (!existsSync(path)) return void 0;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return;
	}
}
/** 清请求文件（幂等）。 */
function clearResetRequest() {
	try {
		rmSync(resetRequestPath(), { force: true });
	} catch {}
}
/** 陈旧阈值：请求写出后超过此时长仍未被 runner 消费，即视为陈旧。 */
/** [OBS] 请求文件陈旧阈值（30 分钟）——超过即视为 runner 没消费（崩溃/被杀），
*  清理掉防堆积。纯资源护栏，不参与剪裁判定。 */
const RESET_REQUEST_TTL_MS = 30 * 6e4;
/**
* 请求是否陈旧（写出后超过 TTL 仍未被消费）。
*
* 2026-09-14 加固（一帆「两条加固都做」）：陈旧请求是**静默死锁**——
* 两个调度入口（`shouldResetSessionLog` / `maybeScheduleRestart`）都以
* 「已有挂起请求 ⟹ 直接返回」为守卫，于是任何一次写成功但没跑起来的请求
* （09-10 副本缺 runner、09-14 stale 副本缺 runner）都会**永久堵死后续所有
* 重启与自动重置**，且毫无痕迹。TTL 让这种情况自愈。
*/
function isResetRequestStale(request, now = Date.now()) {
	return now - request.at > RESET_REQUEST_TTL_MS;
}
/**
* 读「新鲜」的挂起请求；陈旧则顺手清掉并返回 undefined（自愈，幂等）。
* 调度入口一律走本函数，不走裸 `readResetRequest`。
*/
function peekFreshResetRequest(now = Date.now()) {
	const request = readResetRequest();
	if (request === void 0) return void 0;
	if (isResetRequestStale(request, now)) {
		clearResetRequest();
		return;
	}
	return request;
}
/** spawn 失败报告路径（与 runner 报告同目录，便于一起看）。 */
function resetSpawnLogPath() {
	return join(resolveMbsfDataDir(), "session-reset-spawn-errors.log");
}
/** 本地时区 'YYYY-MM-DD HH:mm:ss'（2026-09-24 round 22：原 toISOString 恒
*  UTC——日志时间与本地差 8 小时；显示层一律本地时区）。 */
function _fmtLocalDateTimeSec(ts = Date.now()) {
	const d = new Date(ts);
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
/** 记一条 spawn 失败痕迹（spawn 是 detached + stdio ignore，出错会完全静默）。 */
function noteSpawnFailure(message) {
	try {
		mkdirSync(dirname(resetSpawnLogPath()), { recursive: true });
		writeFileSync(resetSpawnLogPath(), `[${_fmtLocalDateTimeSec()}] ${message}\n`, { flag: "a" });
	} catch {}
}
/**
* 派 runner（共用实现）。
*
* 2026-09-14 加固：spawn 用 `detached + stdio: 'ignore'`，失败**完全无痕**——
* 09-10 与 09-14 两次事故都是「请求写了、runner 没跑、日志一行没有」。这里
* 补三道可见性：① spawn 前查 runner 是否存在（两次事故的共同失败模式就是
* 文件不在）② spawn 抛错 ③ child 异步 'error' 事件。任一失败都记报告
* **并把请求清掉**（否则留下的请求会按上面的 TTL 逻辑堵死后续 30 分钟）。
*
* @returns 派生成功 true；失败 false（调用方应返回 undefined）。
*/
function spawnRunner() {
	const runner = resetRunnerPath();
	if (!existsSync(runner)) {
		noteSpawnFailure(`runner 不存在：${runner} ⟹ 请求已清，不阻塞后续`);
		clearResetRequest();
		return false;
	}
	try {
		const env = {
			...process.env,
			MBSF_HOST_ARGV: JSON.stringify(process.argv.slice(0, 8))
		};
		const child = spawn(process.execPath, [runner], {
			detached: true,
			stdio: "ignore",
			env
		});
		child.on("error", (error) => {
			noteSpawnFailure(`spawn 异步失败：${String(error)} ⟹ 请求已清`);
			clearResetRequest();
		});
		child.unref();
		return true;
	} catch (error) {
		noteSpawnFailure(`spawn 抛错：${String(error)} ⟹ 请求已清`);
		clearResetRequest();
		return false;
	}
}
/**
* runner 入口路径——**包内构建产物** `<lib>/bin/session-reset.js`。
*
* 2026-09-10 事故：原先指向 `<engine>/scripts/session-reset.mjs`，而 DSH 经
* profile 的 node_modules 副本加载引擎（`file:` 依赖复制），副本里只有包内
* 构建产物 ⟹ 派生路径不存在 ⟹ runner 静默不跑（请求写了、进程没动）。放进
* `src/bin/` 随构建落 `lib/bin/`，任何部署形态都在。
*/
function resetRunnerPath() {
	return join(dirname(fileURLToPath(import.meta.url)), "bin", "session-reset.js");
}
/**
* 面板「重启 DSH」按钮：写 restart 请求并派 runner。
*
* 清理与否由 `restartCleanupEnabled` 开关决定（runner 侧读）——本函数只负责
* 「派一次重启」。自动重置退役后这是**唯一**触发路径。
*/
function maybeScheduleRestart(input) {
	if (peekFreshResetRequest() !== void 0) return void 0;
	const ownWebPort = detectOwnWebPort();
	ensureHeapSnapshotDir();
	const request = {
		sessionId: input.sessionId,
		logPath: input.logPath ?? "",
		goalActive: false,
		logBytes: 0,
		ceilingMb: 0,
		...ownWebPort === void 0 ? {} : { webPort: ownWebPort },
		restart: {
			execPath: process.execPath,
			execArgv: withDshHeapFlags(process.execArgv),
			argv: [...process.argv.slice(1)],
			cwd: process.cwd()
		},
		source: "settings-button",
		mode: "restart",
		at: Date.now()
	};
	try {
		mkdirSync(dirname(resetRequestPath()), { recursive: true });
		writeFileSync(resetRequestPath(), `${JSON.stringify(request, null, 2)}\n`);
	} catch {
		return;
	}
	if (!spawnRunner()) return void 0;
	return request;
}
//#endregion
//#region lib/types/loop-watch.js
/**
* 事件循环看门狗（2026-09-13 小爪，一帆「发消息卡住，别的会话 LLM 回复也同时暂停、
* 设置里状态读不出来」现象定位产物）。
*
* 宿主 = 单一「当场介质」（单进程单事件循环）⟹ 一次**不可让出的原子步**
* （同步 spawn / 大 JSON 序列化 / 大循环）会把该介质上**所有**其他的观一起停摆——
* 现象即「本会话卡 ⟹ 其他会话与状态面板同时卡」。
*
* 病因实例（实测）：`工具层` 的 `execFileSync` 同步 spawn CLI，
* `lang.js walk` 一次 = 11.76s ⟹ 全局冻结 11.76s（2026-09-13 已改异步 execFile）。
*
* ── v2（2026-09-13 当晚升级：手标阶段不够用）──────────────────────────────
* 首批实测报出「阻塞 11409ms｜当时阶段: 空闲」——阶段标记覆盖不到真凶（阻塞发生在
* 未标记路径上，比如 idle / 状态网关 / 落盘 / 宿主自身）。手标 = 自觉，覆盖不到就
* 归因失败。⟹ 改为**机制化归因**：
*   ① **V8 CPU 采样归因**：`inspector` 的 `Profiler` 滚动采集（每窗口 stop→取样本→
*      start），阻塞发生时直接打该窗口**自耗时 top 5 函数**（函数名 + 文件行）——
*      不依赖任何手标，未标记路径也能点名。
*   ② **阶段轨迹环**：最近 8 次 markPhase 切换存环，报告里带轨迹——看得出「阻塞前
*      最后在做的事」。
* 关闭 CPU 归因：`MBSF_LOOP_PROFILE=0`（采样有极小开销，排查期默认开）。
*
* [OBS] 阈值与轮询间隔皆工程标定（非判定阈值，不参与任何结构判定）。
*/
/** 阻塞判定阈值（ms）——低于它不值得报（正常 GC/IO 抖动级）。
*  [OBS] 诊断阈值（只决定「报不报」不决定「是什么」）——800ms ≈ 正常 GC/IO
*  抖动的上界，超出即人可感知。不进判定层。 */
const BLOCK_THRESHOLD_MS = 800;
/** 轮询间隔（ms）——每个间隔汇报一次窗口内最大阻塞。
*  [OBS] 纯采样节律——只影响报告的粒度（5s 窗口），不影响被测对象。 */
const CHECK_INTERVAL_MS = 5e3;
/** 阶段轨迹环容量。
*  [OBS] 展示窗口——只保留最近 8 个阶段名供事后归因（崩溃时看「死在哪一步」），
*  容量大小不改变任何行为。 */
const PHASE_RING = 8;
let _phase = "空闲";
let _phaseSince = Date.now();
let _ring = [{
	ts: Date.now(),
	name: "空闲"
}];
let _session = null;
let _profiling = false;
let _started = false;
/** 标记当前阶段（阻塞报告里的「当时阶段」）。返回撤销函数 = 恢复上一阶段。 */
function markPhase(name) {
	const push = (entry) => {
		_phase = entry;
		_phaseSince = Date.now();
		_ring.push({
			ts: _phaseSince,
			name: entry
		});
		if (_ring.length > PHASE_RING) _ring = _ring.slice(-8);
	};
	const prev = _phase;
	push(name);
	return () => push(prev);
}
/** 阶段名（只读，供外部调试）。 */
function currentPhase() {
	return _phase;
}
function post(session, method) {
	return new Promise((resolve, reject) => {
		session.post(method, (err, result) => err ? reject(err) : resolve(result));
	});
}
/** 启动滚动 CPU 采样（失败则静默——归因增强不阻断主路径）。 */
async function startProfiler() {
	if (_profiling) return;
	try {
		const session = new Session();
		session.connect();
		await post(session, "Profiler.enable");
		await post(session, "Profiler.start");
		_session = session;
		_profiling = true;
	} catch {
		_session = null;
		_profiling = false;
	}
}
/** 结束当前窗口采样 → 返回自耗时 top 函数 → 立刻开始下一窗口。 */
async function harvestProfile(topN = 5) {
	if (!_session || !_profiling) return [];
	try {
		const res = await post(_session, "Profiler.stop");
		const agg = /* @__PURE__ */ new Map();
		for (const node of res?.profile?.nodes ?? []) {
			const hits = node.hitCount ?? 0;
			if (!hits) continue;
			const cf = node.callFrame ?? {};
			const name = (cf.functionName || "(anonymous)").slice(0, 60);
			const url = String(cf.url || "");
			const where = url ? `${url.replace(/^.*\/(?=[^/]+$)/, "")}:${(cf.lineNumber ?? 0) + 1}` : "(native)";
			const key = `${name}|${where}`;
			const cur = agg.get(key) ?? {
				name,
				where,
				hits: 0
			};
			cur.hits += hits;
			agg.set(key, cur);
		}
		await post(_session, "Profiler.start");
		return [...agg.values()].sort((a, b) => b.hits - a.hits).slice(0, topN);
	} catch {
		_profiling = false;
		return [];
	}
}
/** 阻塞报告落盘路径（终端之外留痕——事后可查，不靠人在场）。 */
const BLOCK_LOG = join(homedir(), ".mbsf", "loop-blocks.log");
/** 阻塞报告落盘上限（2MB，超出轮转）。
*  [OBS] 磁盘护栏——防长跑进程把日志写满盘；与 `PROBE_LOG_MAX_BYTES` 同型。 */
const BLOCK_LOG_MAX = 2 * 1024 * 1024;
/** 报告 = 终端 + 落盘（终端错过也不丢）。
*  ⚠️ 走 **stderr**（2026-09-24 round 22 修复）：本模块在模块顶层 import 即启动
*  （index.ts 顶部 startLoopWatchdog()），原先的 console.log 打到 **stdout**——
*  污染所有把本库当 CLI 用的消费者（mbsf.js / lang.js 的 JSON 输出第一行是
*  看门狗横幅，runCli 直接把 stdout 交给 LLM）。诊断输出不是命令结果——
*  stdout 只放结果，诊断一律 stderr。
*
*  ⚠️ 2026-09-27：**仅在真终端（TTY）上写 stderr**。桌面 app 里 host 的 stderr
*  是**管道**——Electron shell 把它收集成 64KB 尾巴，一旦 host 意外退出就
*  整段塞进「应用无法启动」对话框（用户看到的正是满屏 [MBSF] 噪声 +
*  「错误详情已截短」）。诊断本就落盘到 loop-blocks.log，终端那一路对管道
*  消费者毫无价值 ⟹ 非 TTY 一律只落盘（`MBSF_WATCHDOG_STDERR=1` 可强制打开）。 */
function emit(line) {
	if (process.stderr.isTTY === true || process.env.MBSF_WATCHDOG_STDERR === "1") console.error(line);
	try {
		if (statSync(BLOCK_LOG).size > BLOCK_LOG_MAX) {
			renameSync(BLOCK_LOG, `${BLOCK_LOG}.1`);
			writeFileSync(BLOCK_LOG, "");
		}
	} catch {}
	try {
		appendFileSync(BLOCK_LOG, `${(/* @__PURE__ */ new Date()).toISOString()} ${line}\n`);
	} catch {}
}
function phaseTrace() {
	const now = Date.now();
	return _ring.slice().reverse().map((e) => `${e.name}(+${Math.round((now - e.ts) / 100) / 10}s)`).join(" ← ");
}
/** 启动看门狗（幂等——重复调用无副作用）。 */
function startLoopWatchdog() {
	if (_started) return;
	_started = true;
	const h = monitorEventLoopDelay({ resolution: 50 });
	try {
		h.enable();
	} catch {
		return;
	}
	const profileOn = process.env.MBSF_LOOP_PROFILE !== "0";
	if (profileOn) startProfiler();
	if (process.stderr.isTTY === true || process.env.MBSF_WATCHDOG_STDERR === "1") console.error(`[MBSF] 看门狗已启动（阈值 ${BLOCK_THRESHOLD_MS}ms / 轮询 ${CHECK_INTERVAL_MS}ms / CPU 归因=${profileOn ? "开" : "关"}）`);
	setInterval(() => {
		const maxMs = Math.round(h.max / 1e6);
		const meanMs = Math.round(h.mean / 1e6);
		h.reset();
		const blocked = maxMs >= BLOCK_THRESHOLD_MS;
		harvestProfile().then((top) => {
			if (!blocked) return;
			const heldS = Math.round((Date.now() - _phaseSince) / 1e3);
			emit(`[MBSF] 事件循环阻塞 ${maxMs}ms（窗口均 ${meanMs}ms）｜当时阶段: ${_phase}` + (heldS >= 1 ? `（该阶段已持续 ${heldS}s）` : ""));
			emit(`[MBSF]   阶段轨迹: ${phaseTrace()}`);
			if (top.length > 0) emit(`[MBSF]   窗口自耗时 top（采样 ${top.reduce((s, t) => s + t.hits, 0)} 点）: ` + top.map((t) => `${t.name} ${t.hits}@${t.where}`).join(" ｜ "));
		});
	}, CHECK_INTERVAL_MS).unref?.();
}
//#endregion
//#region lib/types/idle-signal.js
/**
* 空闲信号（2026-09-27 小爪）——「现在能不能安全清缓存」的唯一判据。
*
* ── 为什么需要（一轮实测后的结论）─────────────────────────────────────────
*  手动释放（`mbsfStatus/reclaimMemory`）**全停时才真释放**，忙时点了等于白点：
*  清掉的派生缓存（archLabelInv / labelToks / fragToks…）全是**按需惰性重建**，
*  下一个 recall 立刻把它们长回来——代价白付。
*
*  ⟹ 问题不在「怎么清得更狠」，而在**「什么时候清」**。本模块提供那个判据。
*
* ── 判据 = 在途计数 ∧ 阶段空闲（两个都要）───────────────────────────────
*  · **在途计数**：`工具层` 的 `runCli` / `runLangCli` 是 recall /
*    recall_content / walk / wengu 四个工具的唯一出口 ⟹ 在那里 `enter()` /
*    `leave()` 一对覆盖住。**第五个工具 `mbsf_forget` 不走 CLI**（写路径必须
*    本进程直调引擎，见该工具注释）——它在自己的 `execute` 里单独配对
*    （2026-09-28 补漏，补上前它是本判据的盲区）。
*  · **阶段空闲**：`loop-watch.markPhase` 覆盖压缩 / 登记 / 落盘 / CLI 路径。
*  · 两者取**与**——`currentPhase()` 报「空闲」并不代表真闲（当场 recall 那条
*    路径历史上就没标 phase，正是 loop-watch 头注里「阻塞发生在未标记路径上」
*    的同一个盲区）。计数补上这个盲区。
*
* ── 已知边界（诚实标注）─────────────────────────────────────────────────
*  · 只覆盖**本进程内**经 `工具层` 发起的调用。别的会话若通过其他路径
*    （bash 直接跑 CLI）访问引擎，计数看不见——此时判据退化为「阶段空闲」。
*    这是**保守方向**的误差（可能误判为闲）——但 bash 起的 CLI 是独立进程，
*    清宿主缓存不会与它冲突，实际风险低。
*  · 计数只增不减的 bug 会让自动释放**永不触发**（静默失效）。故 `leave()`
*    用 `Math.max(0, n-1)` 夹住，且 `isIdle()` 附带「计数长期不归零」的
*    自愈：见 `_staleGuardMs`。
*  · **看不见「LLM 正在吐字」的回合**（2026-09-28 复核）：此时无 mbsf 调用，
*    判据为真。手动释放**已改用本判据**（原用会话层 `agent.status`，太粗
*    ——吐字时那是 running 但其实完全安全，反之卡在未标 phase 路径上的
*    recall 会话层又看不见）。本判据放行时，吐字回合最多感到短暂卡顿 +
*    随后 recall 需冷启动重建缓存（实测 1376ms）——**性能代价，非正确性
*    风险**（清理前后 5 组查询结果逐字节一致）。
*
* @module mbsf-compaction/src/idle-signal
*/
/** 在途调用计数（>0 = 有 mbsf 工具在跑）。 */
let _inflight = 0;
/**
* 真闲？= 无在途 mbsf 调用 **且** 阶段空闲。
*
* @returns true = 现在清缓存不会被立刻重建（释放的收益能留住）。
*/
function isIdle() {
	return currentPhase() === "空闲";
}
/** 空闲判据的人类可读快照（状态面板 / 日志用）。 */
function idleSnapshot() {
	return {
		idle: isIdle(),
		inflight: _inflight,
		phase: currentPhase()
	};
}
//#endregion
//#region lib/types/session-format-catalog-compat.js
/**
* 会话格式 catalog 双版本兼容层 —— engine 侧接触 DSH 存储格式的统一入口。
*
* ── 为什么需要（2026-09-26 App 版适配）─────────────────────────────────────
* 引擎同时要活在两个宿主里：
*   · CLI 0.1.5（`~/.dsh`）        → catalog 当前版本 = **v3**（`session.v3.jsonl`）
*   · App 0.1.7（`~/dsh-desktop-trial`）→ catalog 当前版本 = **v4**（`session.v4.jsonl`）
* 两边 catalog 包的 **API 形状不同**（2026-09-26 逐行比对两包 lib/index.js 实测）：
*
*   ┌──────────────────────┬──────────────────────┬────────────────────────────┐
*   │                      │ 0.1.5 catalog        │ 0.1.7 catalog              │
*   ├──────────────────────┼──────────────────────┼────────────────────────────┤
*   │ sessionFormatCatalog │ currentVersion = 3   │ currentVersion = 4         │
*   │ 读 v3 日志           │ ✅ current           │ ⚠️ migration-required，但  │
*   │                      │                      │    v3→v4 迁移要 children    │
*   │                      │                      │    证据（缺 → unsupported） │
*   │ historicalSession…   │ ❌ 无此导出          │ ✅ 读 v3 = current（完整）  │
*   │ 读 v4 日志           │ ❌ unsupported       │ ✅ current                 │
*   └──────────────────────┴──────────────────────┴────────────────────────────┘
*
* ── 取用策略：探测 + 兜底（零硬失败）──────────────────────────────────────
* 构建期 catalog 被 **内联** 进 bundle（tsdown 只 external 化 peerDependencies，
* 而 catalog 不在其中——实测 lib/index.js 无该 import）。内联副本 = 构建时
* 引擎 node_modules 里那份（CLI 场景 = 0.1.5）。
*
* 因此本层在**运行时探测宿主**是否有更新的 catalog（App 场景 pnpm 会把它装到
* 插件自己的 node_modules 下，因为 2026-09-26 起它进了 peerDependencies）：
*   · 探测成功且版本更高 → 用它（App：拿到 v4 能力）
*   · 探测失败/版本不高   → 用内联那份（CLI：行为与改动前完全一致）
* ⟹ **任何情况下都有可用 catalog，不存在「探测失败 → 引擎起不来」**。
*
* ── 读侧选法（按目标文件头）──────────────────────────────────────────────
*  1. `historicalSessionFormatCatalog`（0.1.7 独有）——current = v3，读 v3 是
*     「原生」路径，不需要 children 证据；
*  2. 宿主 catalog——0.1.5 下它就是 v3 原生；0.1.7 下是 v4（读 v4 靠它）。
*  判定用 `readHeader` 的 status：`current` / `migration-required` 都算可读
*  （与旧 `openLogReader` 同判据）；其余（unsupported / malformed）→ 换下一个。
*
* ── 写侧选法（按宿主 current，与读侧不同）────────────────────────────────
* 写侧产物要被**宿主**读回，所以必须跟宿主 currentVersion 走，而不是跟输入
* 文件版本走。0.1.5 宿主 → v3 行；0.1.7 宿主 → v4 行。
*
* ── 保守性（安全第一）────────────────────────────────────────────────────
* 探测失败/API 形状不认识 → 一律 null（调用方按「不可读/不可写」处理——跳过该
* 文件，绝不猜、绝不写坏）。读口 `decodeAll` 任一行失败 → null。
*/
function isCatalogLike(v) {
	if (v === null || typeof v !== "object") return false;
	const o = v;
	return typeof o["readHeader"] === "function" && typeof o["createRestore"] === "function" && typeof o["encodeCurrentHeader"] === "function" && typeof o["encodeCurrentEvent"] === "function" && typeof o["currentVersion"] === "number";
}
function asCatalog(v) {
	return isCatalogLike(v) ? v : null;
}
/**
* 探测基准列表：引擎自身 + **宿主进程 argv 里的路径**。
*
* ── 为什么不能只用 import.meta.url（2026-09-29 重启清理零产出根因）────────
* App 场景下引擎被装进 profile：`~/.dsh/profiles/desktop/node_modules/
* mbsf-compaction/`。`createRequire(import.meta.url)` 从那里
* 向上找 `@deepseek-ai/dsh-session-format-catalog`，会命中
* `~/.dsh/profiles/node_modules/` 下那份 —— 那是 **CLI 时代 0.1.5 的 v3-only
* 副本**。于是探测「成功」但拿到 v3，池里永远没有 v4 → App 自带的 v4 日志
* （最大的那批文件）一律读不出，重启清理 187 个文件全 skipped、释放 0 字节。
* 实测：`catalogProbeReport()` = { bundled: 3, probed: 3, effective: 3 }。
*
* 宿主的真身在 `process.argv` 里（App：`…/app.asar/dsh` 是 dsh root，
* `…/dsh-desktop-host/lib/index.js` 是宿主入口），从那解析才能拿到 App 自带的
* 0.1.7 / v4 catalog。逐个基准试，取 currentVersion **最大**的那份。
*/
function probeBases() {
	const out = [import.meta.url];
	const args = [...process.argv];
	const inherited = process.env.MBSF_HOST_ARGV;
	if (inherited !== void 0 && inherited !== "") try {
		const parsed = JSON.parse(inherited);
		if (Array.isArray(parsed)) {
			for (const a of parsed) if (typeof a === "string") args.push(a);
		}
	} catch {}
	for (const arg of args) {
		if (typeof arg !== "string" || !arg.startsWith("/")) continue;
		const isFile = /\.(m?js|cjs)$/.test(arg);
		out.push(isFile ? arg : `${arg.replace(/\/+$/, "")}/index.js`);
	}
	return out;
}
/**
* 运行时探测宿主 catalog 包（App 场景拿到 0.1.7 / v4）。
* 多基准逐个试，取 currentVersion 最大者；全部失败/形状不认识 → null。
*/
function probeHostCatalogPkg() {
	let best = null;
	let bestVersion = -1;
	for (const base of probeBases()) try {
		const mod = createRequire(base)("@deepseek-ai/dsh-session-format-catalog");
		if (mod === null || typeof mod !== "object") continue;
		const v = asCatalog(mod["sessionFormatCatalog"])?.currentVersion ?? -1;
		if (v > bestVersion) {
			best = mod;
			bestVersion = v;
		}
	} catch {}
	return best;
}
const bundledPkg = bundledCatalogPkg;
const probedPkg = probeHostCatalogPkg();
/** 内联（构建期）catalog 包。 */
const bundledHostCatalog = asCatalog(bundledPkg["sessionFormatCatalog"]);
/** 运行时探测到的 catalog 包（可能为 null）。 */
const probedHostCatalog = probedPkg === null ? null : asCatalog(probedPkg["sessionFormatCatalog"]);
/**
* 全部可用 catalog（读侧候选池）——**按 currentVersion 降序**。
*
* 为什么要池化而不是「只选一个」：pnpm 可能把 peer 依赖装成**任意版本**
* （`>=0.1.0-rc.5` 是宽区间，registry 上 `latest` 标签停在 0.1.3-alpha.2）。
* 若只看「探测到的那份」会漏掉内联那份的能力，反之亦然。池化后由读口逐个试
* （能读的头才算数），能力最大化且不会误判。
*/
const catalogPool = (() => {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	const add = (cat, via) => {
		if (cat === null || seen.has(cat)) return;
		seen.add(cat);
		out.push({
			cat,
			via
		});
	};
	if (probedPkg !== null) add(asCatalog(probedPkg["historicalSessionFormatCatalog"]), "historical");
	add(probedHostCatalog, "host-probed");
	add(bundledHostCatalog, "host-bundled");
	return out.sort((a, b) => b.cat.currentVersion - a.cat.currentVersion);
})();
/**
* 宿主 catalog（**写侧**用）：池里 currentVersion 最大的那份——产物要能被宿主
* 读回，所以跟最高版本走。池空 → null。
*/
const hostCatalog = catalogPool[0]?.cat ?? null;
/**
* v0–v3 历史读口：0.1.7 独有导出（其 sessionFormatCatalog 本身 current = 3）。
* 0.1.5 没有这个导出 → null。
*/
const historicalCatalog = probedPkg === null ? null : asCatalog(probedPkg["historicalSessionFormatCatalog"]);
/** 读口选项（与旧 openLogReader 一致——strict + transformed）。 */
const RESTORE_OPTS = {
	recovery: "strict",
	validation: "transformed"
};
/**
* 按**目标文件头**选 catalog 开读口。
*
* ⚠️ 关键：`readHeader` 接受 ≠ 真能读完。0.1.7 的 v4 catalog 对 v3 头返回
* `migration-required`（看似可读），但 `createRestore` 走 v3→v4 迁移时需要
* **children 证据**，缺证据直接抛 → 解码失败。所以本实现**不**在 readHeader
* 通过时就定下 catalog，而是把候选池整个带进 `decodeAll`：逐个真读，谁读出
* 来算谁的（首读失败 → 换下一个）。这样「能读」是实测结论，不是静态推测。
*
* @returns 读口；池里所有 catalog 都读不出 → decodeAll 返回 null（调用方按
*   不可读处理）。
*/
function openCompatLogReader(headerObj) {
	if (catalogPool.length === 0) return null;
	const accepting = catalogPool.filter(({ cat }) => {
		try {
			const status = cat.readHeader(headerObj).status;
			return status === "current" || status === "migration-required";
		} catch {
			return false;
		}
	});
	if (accepting.length === 0) return null;
	const state = { via: "none" };
	return {
		get via() {
			return state.via;
		},
		decodeAll(rows) {
			for (const { cat, via } of accepting) try {
				const restore = cat.createRestore(headerObj, RESTORE_OPTS);
				for (const row of rows) restore.decodeRow(row);
				const artifact = restore.finish();
				state.via = via;
				return {
					header: artifact.header,
					inheritedEventCount: artifact.inheritedEventCount,
					events: [...artifact.events]
				};
			} catch {
				continue;
			}
			state.via = "none";
			return null;
		}
	};
}
/**
* 事件数组 → **宿主**兼容行（每事件一行）+ 迁好的头行。
*
* ⚠️ 写侧跟宿主 current（产物要被宿主读回），与读侧的「按文件版本选」不同。
*
* @returns null = 头被宿主拒绝（调用方跳过写盘——绝不写坏）。
*/
function encodeCompatLogRows(headerObj, events, inheritedEventCount = 0) {
	if (hostCatalog === null) return null;
	let read;
	try {
		read = hostCatalog.readHeader(headerObj);
	} catch {
		return null;
	}
	if (read.status !== "current" && read.status !== "migration-required") return null;
	try {
		return {
			headerLine: JSON.stringify(hostCatalog.encodeCurrentHeader(read.header, inheritedEventCount)),
			rows: events.map((event) => hostCatalog.encodeCurrentEvent(event)),
			via: "host"
		};
	} catch {
		return null;
	}
}
function isVerifierLike(v) {
	if (v === null || typeof v !== "object") return false;
	const o = v;
	return typeof o["validateStoredEvents"] === "function" && typeof o["assertContiguous"] === "function";
}
function isSessionLibLike(v) {
	if (v === null || typeof v !== "object") return false;
	const o = v;
	return typeof o["foldSurface"] === "function" && typeof o["SessionId"] === "function";
}
/** 从宿主探测基准里 require 一个包，取**能力最强**的那份。
*
*  ⚠️ 判据是 `score`（越大越强），**不是基准顺序**（2026-10-02 实测教训）：
*  `process.argv[0]` 是 Electron 可执行文件路径，它被当成目录补 `/index.js`
*  后向上解析，会**再次命中引擎自己的 0.1.5 副本**；而「第一个宿主基准」
*  与「引擎自身基准」解析到同一个文件时，按顺序取首个就取错了那份。
*  改用能力评分后，无论 argv 怎么排、有几个基准，都取到真正知道新事件类型的
*  那一份（这正是 catalog 池「取 currentVersion 最大」的同一策略）。 */
function probePkg(name, accept, score) {
	let best = null;
	for (const base of probeBases()) try {
		const req = createRequire(base);
		const mod = req(name);
		if (!accept(mod)) continue;
		const s = score(mod, base);
		const from = base === import.meta.url ? "engine" : "host";
		let path = "";
		try {
			path = req.resolve(name);
		} catch {}
		if (best === null || s > best.score) best = {
			mod,
			from,
			score: s,
			path
		};
	} catch {}
	return best;
}
/** `@deepseek-ai/dsh-session` 的已知事件类型数——能力评分。
*
*  App 0.2.0 = 59（含 developer/message、workspace/changes），
*  CLI 0.1.5 = 56（都不含）。**越大越新**，故取最大者。 */
function sessionCapability(v) {
	const k = v.KNOWN_SESSION_EVENT_TYPES;
	return typeof k?.size === "number" ? k.size : 0;
}
/** 从某个基准解析 `@deepseek-ai/dsh-session` 的能力分（解析不到 → -1）。
*
*  ⚠️ 这是给 **persistence** 打分的代理：persistence 内部 `import` 的
*  `KNOWN_SESSION_EVENT_TYPES` 来自**与它同一 node_modules 树**的
*  `dsh-session`（它自己不 re-export 该常量，无法直接问）。从同一基准解析
*  `dsh-session`，得到的正是 persistence 实际会用的那份 ⟹ 评分可靠。 */
function sessionCapabilityAt(base) {
	try {
		return sessionCapability(createRequire(base)("@deepseek-ai/dsh-session"));
	} catch {
		return -1;
	}
}
/** 官方存储验证器（取**配套 session 能力最强**的那份；解析不到 → null，
*  调用方退回静态 import）。
*
*  评分用「同一基准下 `dsh-session` 的已知类型数」——这样 persistence 与
*  session 必然取自**同一棵树**，不会出现「验证器是新的、类型表是旧的」那种
*  自相矛盾的组合（2026-10-02 实测：单看 persistence 形状两版都合格，
*  按基准顺序取首个会拿到 0.1.5 那份 ⟹ 仍拒新事件类型）。 */
function resolveOfficialVerifier() {
	const hit = probePkg("@deepseek-ai/dsh-session-persistence", isVerifierLike, (_mod, base) => sessionCapabilityAt(base));
	return hit === null ? null : {
		mod: hit.mod,
		from: hit.from,
		path: hit.path
	};
}
/** 会话库（`foldSurface` / `SessionId`；取已知类型最多的那份）。
*
*  ⚠️ 必须与 `resolveOfficialVerifier` **配套**：persistence 的
*  `validateStoredEvents` 内部 `import` 的是它自己那份 `dsh-session` 的
*  `KNOWN_SESSION_EVENT_TYPES`。两份各自取到「最强」时才是自洽的一对。 */
function resolveSessionLib() {
	const hit = probePkg("@deepseek-ai/dsh-session", isSessionLibLike, sessionCapability);
	return hit === null ? null : {
		mod: hit.mod,
		from: hit.from,
		path: hit.path
	};
}
/** 诊断：验证器实际解析到哪一份、能力几何（状态面板 / 排查用）。
*
*  `path` 是判读的**硬证据**（`host`/`engine` 标签只是粗分类，影子 profile
*  等场景下会同名歧义）；`sessionTypes` / `knowsNewTypes` 是**结论**——
*  `knowsNewTypes: false` ⟹ 剪裁必然全跳过（静默失效）。 */
function verifierProbeReport() {
	const v = resolveOfficialVerifier();
	const s = resolveSessionLib();
	const types = s === null ? 0 : sessionCapability(s.mod);
	const known = s?.mod?.KNOWN_SESSION_EVENT_TYPES;
	return {
		verifier: v?.from ?? null,
		sessionLib: s?.from ?? null,
		verifierPath: v?.path ?? null,
		sessionPath: s?.path ?? null,
		sessionTypes: types,
		knowsNewTypes: known?.has?.("developer/message") === true
	};
}
/** 诊断快照：本次进程实际用到的 catalog 来源与版本。 */
function catalogProbeReport() {
	return {
		bundled: bundledHostCatalog?.currentVersion ?? null,
		probed: probedHostCatalog?.currentVersion ?? null,
		effective: hostCatalog?.currentVersion ?? null,
		historical: historicalCatalog !== null
	};
}
//#endregion
//#region lib/types/session-format-v3.js
/**
* 0.1.5 会话日志格式适配层（v3）——**薄壳**，实现已迁至 `session-format-catalog-compat.ts`。
*
* 保留本模块是为了不动调用方（session-prune / session-health / tests 的 import 面），
* 语义与旧实现一致；差异只有一处：catalog 从「写死内联的 0.1.5」改为
* 「运行时探测宿主版本，取能力更强的那份」（详见 compat 模块头注释）。
*
* ── 历史背景（旧实现原文，保留作档案）──────────────────────────────────
* DSH-0.1.1 的 `decodeStorageRecord` / `packChunkRuns`（`@deepseek-ai/dsh-session`）
* 在 0.1.5 全树消失，存储格式整体换代到 v3（文件名 `session.v3.jsonl`）。
* 0.1.5 的公开口是 `sessionFormatCatalog`：
*
*   读：readHeader(头对象)                        // 状态机；v0 返回 migration-required
*        → createRestore(头对象, {recovery,validation})   // 不能跳步（物理头须过 codec 校验）
*        → decodeRow(row) × N                      // ⚠️ 返回 void —— 单趟收集器，不产出事件
*        → finish()                                // → { header, inheritedEventCount, events }
*
*   写：encodeEvent(event) × N                     // 逐事件产行
*        + encodeHeader(header, inheritedEventCount)
*
* 实测（2026-09-13，真日志 session.jsonl.zstd）：v0 头经 readHeader 返回
* `migration-required`，回传 header 已是迁好的 v3 头 ⟹ 历史日志自动迁移。
* 实测（2026-09-26，App 0.1.7）：同一份代码在 0.1.7 宿主下经探测拿到 v4 catalog，
* v3/v4 两种日志都能读（见 compat 模块头的两版本对照表）。
*
* @module mbsf-compaction/session-format-v3
*/
/** 头对象是否被（宿主/历史）catalog 接受（current / migration-required 都算可读）。 */
function openLogReader(headerObj) {
	return openCompatLogReader(headerObj);
}
/** 事件数组 → 宿主兼容行（每事件一行）+ 迁好的头行文本。 */
function encodeLogRows(headerObj, events, inheritedEventCount = 0) {
	const encoded = encodeCompatLogRows(headerObj, events, inheritedEventCount);
	if (encoded === null) return null;
	return {
		headerLine: encoded.headerLine,
		rows: encoded.rows
	};
}
//#endregion
//#region lib/types/session-log-reader.js
/**
* 会话流水读取器 — trace 走（回想第二步）的原文重演底座
*
* 设计（附录F F.6.3 ② / F.6.4 回想条目 + 2026-08-21 消息级索引治本）：
*  - 回想两步：① 入口 = 离散同型判定（C.8 落位 A）
*    ② 展开 = trace 走——位置寻址 + 重演（⚠️ 7.3.2 措辞修正：refs =
*    识别边/位置索引，不是路径边，不「沿边反向走回」；位置寻址 =
*    refs 定位流水原文）→ 重演该段线（重演 = 照流水记录复原同一区分
*    序列 = 精确；重新区分 = 在当下语境再走一遍 = 新动作 = 有损）。
*  - 位置必须指向流水原文（不能只指向话题节点）——本模块实现「位置 →
*    流水原文」的读取侧：kind='session' 的位置（sessionKey + msgIndex）
*    定位到 DSH 会话存档里的原文。
*
* 消息级索引（2026-08-21 治本——OOM 修复）：
*  - 旧实现整条流水 readFileSync + 全量解压所有帧拼接（119MB 压缩 →
*    ~1GB 明文）→ split('\n') 33 万行 JSON.parse → _msgCache 整线驻留
*    = 峰值内存 O(线长)（1GB 明文 + 33 万事件对象）= OOM 根源。
*  - 实测（真实流水 118.5MB）：zstd 拼接帧 33 万帧，其中对话消息仅
*    1134 条（其余全是 turn/step/注入事件帧）——全量 1GB 明文里 99.9%
*    是事件结构，对话原文只有 ~1MB。治本 = 只保留对话消息原文：
*    ① 消息级索引 = 建索引时逐帧解压（峰值 = 单帧明文，非整线）+ 只
*       提取对话消息原文 push 进索引（1134 条 ≈ 1-2MB/会话——1000 倍
*       缩容），持久化 ~/.mbsf/session-message-index/
*       <uuid>.json（原子写），进程重启免解压；
*    ② 测地线展开 = 定位时 O(消息数) 前缀匹配（与旧语义 100% 一致：
*       snippet 内容识别 + msgIndex 仅作偏差排序键——msgIndex 是 DSH
*       消息列表下标，与流水对话消息序不成线性，**不能作定位键**，
*       2026-08-21 帧索引位置系错误实测 0/200 命中后修正）——用完即弃，
*       会话索引 LRU(cap 8)，内存 O(消息数) 不 O(线长)；
*    ③ append-only 增量——只扫尾部新帧（逐帧解压提取追加），不重建。
*  - 索引失效（流水截断/轮转/原地改写）→ size/mtime 校验不通过 →
*    重建或返回 null 诚实降级（位置保留 snippet 一瞥）。
*
* 流水形态（DSH session-persistence-jsonl，同仓 MIT）：
*  - 路径：`~/.dsh/sessions/<workspace>/session-<uuid>/session.jsonl.zstd`
*    （明文 `session.jsonl` 兜底）。sessionKey = agent.session.id =
*    `session-<uuid>`，与目录名一致。
*  - 格式：zstd 拼接帧（Node `node:zlib` zstdDecompressSync 零外部依赖）
*    的 JSONL——首行 session 头，后续每行一个 SessionEvent：
*    `user/message` / `assistant/message`（data.content[] text + role）、
*    `turn/start`、`step/start`、`agent/inbox/spliced` 等。
*
* 消息口径（msgIndex 对齐）：
*  - 位置的 msgIndex = SummarizeInput.messages（DSH 重放的消息列表）下标；
*    流水是事件流（含 runtime snapshot 等注入的 user/message），不逐行
*    对应。本模块用「内容识别」定位：收集 user/assistant 消息后，用
*    位置的 snippet（消息前 60 字符，空白归一化）做前缀/包含匹配——
*    从位置走回原文 = 识别同一（= 动作），而非机械下标；msgIndex 只做
*    多候选排序键（偏差最小者优先）。
*
* 零依赖：node:zlib zstd（Node ≥22.17）→ 失败降级明文 .jsonl →
* 再失败返回 null（位置保留 snippet 一瞥，诚实降级）。
*
* 状态标注：与 索引层 同标  层（「记忆」正典零出现，工程实现）。
*
* @module mbsf-compaction/session-log-reader
*/
/** 流水根（环境变量可覆写；默认 ~/.dsh/sessions）。 */
const SESSIONS_ROOT = process.env.MBSF_SESSIONS_ROOT ?? path.join(process.env.HOME || "/tmp", ".dsh", "sessions");
/** 提取 sessionKey 中的 uuid（`session-<uuid>` 或裸 `<uuid>`）。 */
function sessionUuid(sessionKey) {
	const m = /(?:session-)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(sessionKey);
	return m && m[1] ? m[1].toLowerCase() : "";
}
/**
* 定位会话流水文件。
*
* 路径形态（2026-09-24 round 22 实测修复——原实现只认旧形态，
* 87% 会话 miss ⟹ 每次 miss 递归全扫 166 目录 = readdir 热点根因）：
*  - 目录名：旧 `session-<uuid>` / 新裸 `<uuid>`（0.1.5 现行）；
*  - 文件名：旧 `session.jsonl`(.zstd) / 0.1.5 `session.v3.jsonl`(.zstd) /
*    0.1.7 `session.v4.jsonl`(.zstd)（App 版实测写 v4——2026-09-26 补齐）。
*  候选文件名 × 两种目录名 = 先直查，命中即返回——常见情形零递归）。
*  workspace 层（`<root>/<workspace>/<dir>/`）用一层 readdir 兜底缓存；
*  深层递归仅最后兜底（且**不再重复递归**——命中失败即 null）。
*/
const _wsDirsCache = /* @__PURE__ */ new Map();
/** workspace 目录缓存 TTL。
*   纯缓存参数——60s 内复用 readdir 结果（避免每次解析都扫盘）；
*  过期只是重扫一次，不影响任何结果。 */
const WS_CACHE_TTL_MS = 6e4;
/**
* 流水文件名候选（新→旧）。
* ⚠️ 单一真源：v4 文件名于 2026-09-26 补入（App 版 0.1.7 实测写
* `session.v4.jsonl.zstd`）。任何新增格式版本在此处加一行即可。
*/
const SESSION_FILE_NAMES = [
	"session.v4.jsonl.zstd",
	"session.v3.jsonl.zstd",
	"session.jsonl.zstd",
	"session.v4.jsonl",
	"session.v3.jsonl",
	"session.jsonl"
];
function _workspaceDirs(root) {
	const hit = _wsDirsCache.get(root);
	const now = Date.now();
	if (hit && now - hit.at < WS_CACHE_TTL_MS) return hit.dirs;
	let dirs = [];
	try {
		dirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {}
	_wsDirsCache.set(root, {
		at: now,
		dirs
	});
	return dirs;
}
function findSessionLog(sessionKey, root = SESSIONS_ROOT) {
	const uuid = sessionUuid(sessionKey);
	if (!uuid) return null;
	const dirNames = [`session-${uuid}`, uuid];
	for (const d of dirNames) for (const f of SESSION_FILE_NAMES) {
		const c = path.join(root, d, f);
		if (fs.existsSync(c)) return c;
	}
	for (const ws of _workspaceDirs(root)) for (const d of dirNames) for (const f of SESSION_FILE_NAMES) {
		const c = path.join(root, ws, d, f);
		if (fs.existsSync(c)) return c;
	}
	return null;
}
const ZSTD_MAGIC$1 = 4247762216;
/**
* 扫描 zstd 拼接帧边界（不解压）——从 offset 起逐帧解析帧头/块头，
* 返回每帧的 [start, end) 字节区间。供索引建表/增量用；解压由调用方
* 按需逐帧做（峰值 = 单帧明文，不整线拼接）。
* @throws 帧结构损坏。
*/
function scanZstdFrameBounds(buffer, offset = 0) {
	const frames = [];
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) throw new Error("corrupt zstd log: truncated frame magic");
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC$1) throw new Error(`corrupt zstd log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) throw new Error("corrupt zstd log: truncated frame header");
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error("corrupt zstd log: reserved frame-header bit");
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) throw new Error("corrupt zstd log: truncated frame header fields");
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) throw new Error("corrupt zstd log: truncated block header");
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error("corrupt zstd log: reserved block type");
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) throw new Error("corrupt zstd log: truncated block payload");
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) throw new Error("corrupt zstd log: truncated checksum");
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
	}
	return frames;
}
//#endregion
//#region lib/types/session-override.js
/**
* 会话级配置覆盖（sessions.json）+ 继承链解析
*
* 分层（2026-09-02 一帆固化——子代理/分叉会话默认继承父会话设置）：
*  - 全局 config.json（runtime-config.ts）：新建会话的默认值。
*  - 会话覆盖 `~/.mbsf/sessions.json`：`<sessionId>` →
*    `{ injectEnabled?, dateAnchorEnabled? }`。当前会话无显式覆盖时沿
*    `parentSession` 链向上找第一个覆盖；全链无 → 回落全局（返回 null）。
*  - 生效顺序：会话显式覆盖 > 父会话链 > 全局 config.json > env 默认。
*  - 引擎每次压缩/注入从内存单例读取（mtime 校验实时生效，无需重启）。
*
* parentSession 链读取：当前 agent 的 header 由调用方直接传入（免读盘）；
* 祖先会话经 session-log-reader 读流水首帧首行（zstd 拼接帧第一帧解压）。
*
* @module mbsf-compaction/session-override
*/
const SESSIONS_FILE = "sessions.json";
let _sessionOverrides = null;
let _sessionOverridesMtime = 0;
/** 加载（mtime 校验缓存）全部会话覆盖。 */
function loadSessionOverrides() {
	const p = join(resolveMbsfDataDir(), SESSIONS_FILE);
	try {
		if (existsSync(p)) {
			const mtime = statSync(p).mtimeMs;
			if (_sessionOverrides !== null && _sessionOverridesMtime === mtime) return _sessionOverrides;
			const raw = JSON.parse(readFileSync(p, "utf8"));
			const out = {};
			for (const [sid, v] of Object.entries(raw)) {
				if (typeof v !== "object" || v === null) continue;
				const rec = v;
				const ov = {};
				if (typeof rec.injectEnabled === "boolean") ov.injectEnabled = rec.injectEnabled;
				if (typeof rec.dateAnchorEnabled === "boolean") ov.dateAnchorEnabled = rec.dateAnchorEnabled;
				if (typeof rec.autoCompact === "boolean") ov.autoCompact = rec.autoCompact;
				if (typeof rec.sessionTailMessages === "number" && Number.isFinite(rec.sessionTailMessages)) ov.sessionTailMessages = clampTailMessages(rec.sessionTailMessages);
				if (Object.keys(ov).length > 0) out[sid] = ov;
			}
			_sessionOverrides = out;
			_sessionOverridesMtime = mtime;
			return out;
		}
	} catch {}
	_sessionOverrides = {};
	_sessionOverridesMtime = 0;
	return _sessionOverrides;
}
/** 当前会话自身的显式覆盖（不含父链）。 */
function getSessionOverride(sessionId) {
	return loadSessionOverrides()[sessionId] ?? null;
}
/**
* 读指定会话流水首帧首行的 header.parentSession（明文/zstd 都支持）。
* 找不到/损坏 → null（链在此截断，回落全局）。
*/
function readParentSession(sessionKey) {
	const logPath = findSessionLog(sessionKey);
	if (logPath === null) return null;
	try {
		const buf = readFileSync(logPath);
		let head;
		if (logPath.endsWith(".zstd")) {
			const frames = scanZstdFrameBounds(buf);
			if (frames.length === 0) return null;
			const first = frames[0];
			head = zstdDecompressSync(buf.subarray(first.start, first.end)).toString("utf8");
		} else head = buf.toString("utf8");
		const firstLine = head.split("\n", 1)[0]?.trim();
		if (!firstLine) return null;
		const parsed = JSON.parse(firstLine);
		return typeof parsed.parentSession === "string" && parsed.parentSession !== "" ? parsed.parentSession : null;
	} catch {
		return null;
	}
}
/**
* 解析会话生效覆盖：自身 → parentSession 链 → null（回落全局）。
* 字段级继承（2026-09-02 固化）：链上所有覆盖并集合并，近者优先——
* 子会话只覆盖 dateAnchor 时，injectEnabled 仍继承父会话的值。
* @param identity - 会话身份；parentSessionId 传入时免读盘（当前 agent 场景）。
*/
function resolveSessionOverrideFor(identity) {
	const seen = /* @__PURE__ */ new Set();
	let current = identity.sessionId;
	let knownParent = identity.parentSessionId;
	const chain = [];
	while (current !== void 0 && !seen.has(current)) {
		seen.add(current);
		const ov = getSessionOverride(current);
		if (ov !== null) chain.push(ov);
		const parent = knownParent ?? readParentSession(current);
		knownParent = void 0;
		current = parent ?? void 0;
	}
	if (chain.length === 0) return null;
	const merged = {};
	for (let i = chain.length - 1; i >= 0; i--) {
		const ov = chain[i];
		if (ov.injectEnabled !== void 0) merged.injectEnabled = ov.injectEnabled;
		if (ov.dateAnchorEnabled !== void 0) merged.dateAnchorEnabled = ov.dateAnchorEnabled;
		if (ov.autoCompact !== void 0) merged.autoCompact = ov.autoCompact;
		if (ov.sessionTailMessages !== void 0) merged.sessionTailMessages = ov.sessionTailMessages;
	}
	return merged;
}
/**
* 会话生效的运行时配置 = 全局 + 覆盖链（覆盖优先，仅三个布尔开关可被覆盖）。
* @param global - 全局运行时配置（getRuntimeConfig() 的结果）。
* @param identity - 会话身份。
*/
function getRuntimeConfigForSession(global, identity) {
	const ov = resolveSessionOverrideFor(identity);
	if (ov === null) return global;
	return {
		...global,
		...ov.injectEnabled !== void 0 ? { injectEnabled: ov.injectEnabled } : {},
		...ov.dateAnchorEnabled !== void 0 ? { dateAnchorEnabled: ov.dateAnchorEnabled } : {},
		...ov.autoCompact !== void 0 ? { autoCompact: ov.autoCompact } : {},
		...ov.sessionTailMessages !== void 0 ? { compactTailMessages: ov.sessionTailMessages } : {}
	};
}
//#endregion
//#region lib/types/session-prune.js
/**
* 会话日志瘦身（γ-prune）——方案 B'：尾部帧提取 + 内联修复 + CLEAN 验证
*
* DSH 的会话日志（`~/.dsh/sessions/<workspace>/session-<id>/session.jsonl` 或
* `.jsonl.zstd`）是纯追加的：compaction 每折叠一段历史，就把被折叠的
* 原文永远留在文件里。日志无限增长（实测一条长会话可到 116MB+ / 数百万
* 事件），而 checkpoint 已经完整代表了被折叠历史——被 shadow 的原文对
* 恢复毫无用处。
*
* 本模块在**行级**裁剪：把文件重写为「最后一个完整 compaction 段及其后
* 的全部事件」（checkpoint 代表历史，后续事件照旧），被 shadow 的旧帧
* 全部丢弃。裁剪后重放的会话面与裁剪前完全一致（checkpoint 归一为
* append 语义，代表消息不变），文件物理变小，DSH 读侧是 layout-blind
* 的（逐帧解压 + 逐行解析），无需任何改动。
*
* 为什么是 B' 而不是旧 A 方案（findLastCheckpointFrameIndex 全量解码 +
* foldSurface 验证，2026-08-28 审视淘汰）：
*  - **内存**：旧方案全量解码，116MB zstd 日志解码峰值 844MB；B' 从后
*    往前逐帧反向扫描，找到锚点即停，峰值 ~12MB（只保留尾部增量）。
*  - **锚点可达**：旧方案要求「同帧 start/end 配对 + 帧内含 summary +
*    replace checkpoint」——真实日志里 compaction start/end 几乎总跨帧
*    （写入批次边界），同帧配对要求导致锚点回退到极早帧（tail≈全文件）；
*    B' 锚点 = 最后一个无 error 的 compaction/start（其后跨帧累积已见
*    无 error 的 compaction/end），行级切分（从 start 事件行起），不要求
*    summary/checkpoint 在场。
*  - **验证哲学**：旧方案「有 violation 即拒绝」——9ffe 尾部天然带 2 个
*    step 配对缺口（跨锚点 step/start 被剪），大文件永远剪不了；B'
*    裁剪后**内联修复**（补插 step/start）再验证 CLEAN，不拒绝。
*  - **chunk 行保护**：repairStepStarts 的 `event.seq = index` 无条件重
*    编号会破坏 chunk 打包行的语义（text-chunks 等物理行 envelope 只有
*    seq0/time0/data，没有 seq 字段——加了 seq 字段即破坏 DSH 打包格式）；
*    B' 内联修复只重编号消息级 seq + 平移 chunk 行 seq0，chunk 行不加
*    seq 字段。
*
* 裁剪安全设计（对齐 session-health）：
*  - 三重验证全部通过才写盘：① step 配对 CLEAN（detectStepViolations）；
*    ② v3 decodeRow 展开 + seq 连续 + foldSurface 重放（与 DSH
*    读侧 SessionLogScanner 的加载校验同构）；③ 编码读回一致性（产物
*    重读逐事件深比较）。
*  - 备份原日志（默认开）到 `prune-backups/`（脑数据目录内，不参与再扫描）；
*  - 临时文件 + fsync + 原子 rename（POSIX），绝不写坏原文件；
*  - 扫描层 mtime 防线：只处理 mtime 早于 minAgeMs 的日志（排除活跃
*    会话——活跃会话可能正在写尾部，裁剪会丢事件），由调用方传入
*    （引擎启动扫描传 1 小时）。
*  - **状态类事件保留**（2026-09-10 一帆「裁的时候保留状态类事件，
*    否则 resume 后 goal 会丢」）：裁剪只丢「被 checkpoint 代表的材料」，
*    不丢「当前状态」——状态不是历史，是当前值。goal/change ·
*    todo/write · plan/mode · permission/preset · sandbox/mode ·
*    approval/policy · session/title 全量保留并插入锚点段之后（先于尾部
*    较新的同类型事件，fold 顺序正确）。新增状态类事件类型必须登记进
*    STATE_EVENT_TYPES，否则裁剪会静默丢状态。
*
* @module mbsf-compaction/session-prune
*/
const ZSTD_MAGIC = 4247762216;
constants.ZSTD_c_checksumFlag;
/** 结构不完整的末帧恢复参数：解到当前 flush 点为止（与 DSH torn-tail 恢复一致）。 */
const ZSTD_INCOMPLETE_PARAMS = { finishFlush: constants.ZSTD_e_flush };
/**
* 结构扫描拼接 zstd 流：读帧头描述符 + 逐块块头定位完整帧，不依赖魔数
* 搜索（压缩内容里出现的魔数序列不会误切帧），与 DSH 写入侧的
* scanZstdFrames 同构。EOF 落在某帧内部时返回该帧起点作为 tornStart。
*/
function scanZstdFrames(buffer) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error(`corrupt Zstandard session log: reserved frame-header bit at byte ${offset - 1}`);
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return {
			frames,
			tornStart: start
		};
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error(`corrupt Zstandard session log: reserved block type at byte ${offset - 3}`);
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
	}
	return { frames };
}
/**
* 解码完整日志：zstd 模式按结构扫描逐帧解压拼接后按行解析；plaintext
* 模式直接按行解析。完整帧内的记录必须以换行收尾（写侧保证），否则视为
* 半个 JSONL 记录抛错；结构不完整的末帧只恢复以换行收尾的完整行（半行
* 丢弃——与 DSH torn-tail 语义一致），不可恢复则跳过。解析失败抛错
* （调用方捕获后跳过）。
*/
function decodeSessionLog(buffer, zstd) {
	const events = [];
	let header;
	const consume = (lines) => {
		for (const line of lines) {
			if (line.trim() === "") continue;
			const parsed = JSON.parse(line);
			if (header === void 0 && parsed.type === "session") header = parsed;
			else events.push(parsed);
		}
	};
	if (zstd) {
		const { frames, tornStart } = scanZstdFrames(buffer);
		if (frames.length === 0) throw new Error("no complete zstd frame found");
		for (const frame of frames) {
			const decoded = zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString("utf8");
			if (decoded.length > 0 && !decoded.endsWith("\n")) throw new Error("corrupt Zstandard session log: complete frame contains a torn JSONL record");
			consume(decoded.split("\n"));
		}
		if (tornStart !== void 0) try {
			const decoded = zstdDecompressSync(buffer.subarray(tornStart), ZSTD_INCOMPLETE_PARAMS).toString("utf8");
			const lastNewline = decoded.lastIndexOf("\n");
			if (lastNewline !== -1) consume(decoded.slice(0, lastNewline + 1).split("\n"));
		} catch {}
	} else consume(buffer.toString("utf8").split("\n"));
	if (header === void 0) throw new Error("log has no session header line");
	return {
		header,
		events,
		zstd
	};
}
/**
* token meter 规则的 step 配对检测：返回违规事件 seq 列表。
*
* 规则（与 token meter `_foldEvent` 逐条对齐，2026-09-26 补 START_WHILE_OPEN）：
*  - assistant/message 与 step/end 必须落在「当前打开的 step/start 的同
*    turn/step」内；step/end 闭合后 open 清空；
*  - **step/start 到达时 open 必须为空**——未闭合就开下一个 = 违规
*    （token meter 抛 "step/start ... arrived before turn X/step Y ended"）。
*    2026-09-26 修复：旧实现直接覆盖 open，漏检此形态；剪裁管线产出的
*    孤儿 step/start（6b6d48c3/a287c0b1/7a66a93c 三例）因此通过三重验证
*    写盘，token meter 重放抛错 → 会话压缩全面停摆 → 上下文爆表 400。
*  - chunk 打包行（text-chunks 等物理行）不参与配对。
* 只读检测——B' 裁剪后先 repair 再验证 CLEAN。
*/
function detectStepViolations(events) {
	const bad = [];
	let open = null;
	for (const event of events) {
		const data = event.data;
		if (event.type === "step/start") {
			if (open !== null) bad.push(event.seq);
			open = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
		} else if (event.type === "assistant/message" || event.type === "step/end" || event.type === "system/message" || event.type === "developer/message" || event.type === "assistant/attempt") {
			const need = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
			if (!(open !== null && open.turn === need.turn && open.step === need.step)) bad.push(event.seq);
			if (event.type === "step/end") open = null;
		}
	}
	return bad;
}
/**
* B' 内联修复：对提取尾部行执行
*  1. step 配对修复——在违规的 assistant/message 或 step/end 前补插
*     step/end（闭合旧 step）+ step/start（打开新 step）；
*  2. 逻辑 seq 重编号 0 起连续——消息级 seq = 计数器++；chunk 行
*     seq0 = 计数器（成员按 texts/args 长度推进计数器）。**chunk 行不
*     添加 seq 字段**（DSH 打包格式 envelope 只有 seq0/time0/data，加
*     seq 字段即破坏 validateRow 的 hasExactKeys 校验）；
*  3. 引用重映射——sourceEventSeqs / data.shadowedSeqs / data.shadowedRange
*     按旧→新 seq 映射表平移；映射不到（引用被裁历史）= 坏引用保留原值
*     （两字段永不删——见下注释），空则删字段；
*  3b. **影子价格同步**（2026-09-26 新增）：收窄 / 后置覆盖 pass 重算
*     checkpoint 的 replace 区间后，把结果回写到其 `compactionId` 对应
*     summary 的 `shadowedRange`/`shadowedSeqs`/`shadowedTokenCount`——
*     否则 token-meter 的 `foldSurfaceProjection` 契约（claim 区间必须 =
*     紧邻 replace 区间）被违反，整条日志在 GUI 读侧抛错不可加载；
*  4. surfaceOp replace **收窄**（2026-09-25 修订——取代旧「无条件归一
*     append」）：被折叠区间随裁剪消失后，checkpoint 的 replace 区间按
*     「存活阴影节点的表面跨度」重算——存活非空 → 保留 replace（区间 =
*     表面位置上首末存活节点；`sourceEventSeqs` 同步 = 跨度内全部节点，
*     满足宿主 `assertProvenance` 的「必须含每个阴影节点」）；存活为空 →
*     归一 append。**障碍保护**：跨度内若含「原文可见」节点（旧 seq ∈
*     finalSurface）→ 收缩到不含可见节点的单侧连续段，绝不吞可见内容。
*  5. **后置覆盖 pass**（2026-09-25 新增）：主 pass 结束后，表面上仍残留
*     「原文不可见」（旧 seq ∉ finalSurface）的节点（典型 = 救援注入的
*     goal 轮次行——阴影它们的 op 在锚点之前、已随裁剪消失）→ 由锚点段
*     checkpoint 承担覆盖（区间 = 残留节点的连续跨度；约束 = 跨度内不得
*     含可见节点，否则收缩到安全子段）。
*
* 不修改调用方行数组（新分配事件对象）。返回修复后事件与补插数。
*/
/**
* 把「seq 引用列表」打平成**扁平的非负整数数组**（2026-10-03 补）。
*
* **为什么必须做**：DSH 的 `assertSourceEventReferences` 要求
* `sourceEventSeqs` 是扁平的非负安全整数数组：
*   `session event "<type>" sourceEventSeqs must densely contain
*    non-negative safe integers`
* 嵌套元素（如 `[587, [589, 591], 592]`）直接判非法 ⟹ `foldSurface` 抛错
* ⟹ **会话投影不出任何消息** ⟹ 界面「有列表、点开是空的」。
*
* 历史产物里确有此类嵌套（实测 -232c-49 19 处 / 293c2740 1 处）——它经
* `shadowedSeqs` → `summaryShadow` → `span` → `sourceEventSeqs` 自我
* 强化传播。本函数是**兜底打平**，与 `shadowCandidates` 源头打平配套。
*
* 打平语义：递归展开、只保留非负安全整数、去重、升序（升序是 DSH 的
* `densely` 契约所要求的形态）。
*/
function flatSeqs(value) {
	const out = [];
	const take = (v) => {
		if (Array.isArray(v)) {
			for (const item of v) take(item);
			return;
		}
		if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) out.push(v);
	};
	take(value);
	return [...new Set(out)].sort((a, b) => a - b);
}
/** 让行（见 SCAN_YIELD_BUDGET_MS）。budget 由调用方持有、跨文件累计。 */
async function yieldToEventLoop(budget) {
	if (Date.now() - budget.last < 20) return;
	budget.last = Date.now();
	await new Promise((resolve) => {
		setImmediate(resolve);
	});
}
//#endregion
//#region lib/types/session-health.js
/**
* 会话日志健康自愈（session-health）——补 step 配对缺口
*
* 背景：会话日志是纯追加的，理论上 event 流里每个 assistant/message 与
* step/end 都必须有匹配的 step/start（DSH token meter 的严格不变量）。
* 但 OpenClaw→DSH 的迁移种子可能从某个 step 的 chunks 中途开始（缺少该
* step 的 step/start），或历史上异常写入留下配对缺口——这类日志在
* `/compact`（token meter 校验）时会直接报错，压缩功能瘫痪。
*
* 本模块在**事件级**扫描：解包打包行（reasoning-chunks 等）后按 token
* meter 规则逐事件核对 step 配对，发现缺口就**原地补插** step/start
* （必要时先补插 step/end 闭合上一个未结束 step），seq 重编号为 0 起
* 连续，引用（sourceEventSeqs / shadowedSeqs / shadowedRange）经 seqMap
* 精确重映射（映射不到的坏引用删除——顺带清理历史污染帧），然后
* encodeCurrentEvent 逐事件产 v3 行 + 多帧 zstd 写回（与 DSH 写侧一致）。
*
* 安全设计（与 session-prune 对齐）：
*  - 修复前 foldSurface + step 配对重扫双重验证，不通过则不动原文件；
*  - 备份原日志（默认开）到 `health-backups/`（脑数据目录内，不参与再扫描）；
*  - 临时文件 + fsync + 原子 rename（POSIX），绝不写坏原文件；
*  - 扫描层 mtime 防线：只处理 mtime 早于 minAgeMs 的日志（排除活跃会话）。
*
* @module mbsf-compaction/session-health
*/
/** 事件级解包：header + 全部事件（seq 0 起连续校验）。解码失败返回 null。 */
function decodeEventsFull(buffer, zstd) {
	let log;
	try {
		log = decodeSessionLog(buffer, zstd);
	} catch {
		return null;
	}
	const reader = openLogReader(log.header);
	if (reader === null) return null;
	const artifact = reader.decodeAll(log.events);
	if (artifact === null) return null;
	const events = [];
	for (const event of artifact.events) {
		if (event === null || typeof event !== "object") return null;
		const ev = event;
		if (ev.seq !== events.length) return null;
		events.push(ev);
	}
	return {
		header: log.header,
		events
	};
}
/** token meter 规则的 step 配对检测：返回违规事件 seq 列表。
*  （实现见 session-prune.ts——B' 裁剪与健康检查共用。） */
/**
* 补插缺失的 step/start（必要时先 step/end 闭合旧 step），seq 重编号为
* 0 起连续。返回修复后事件与插入数。
*/
function repairStepStarts(events) {
	const out = [];
	let open = null;
	let inserted = 0;
	for (const event of events) {
		const data = event.data;
		if (event.type === "step/start") {
			if (open !== null) {
				const t = typeof event.time === "number" ? event.time : Date.now();
				out.push({
					type: "step/end",
					seq: -1,
					time: t - 2,
					data: {
						turn: open.turn,
						step: open.step
					}
				});
				inserted++;
			}
			open = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
			out.push({ ...event });
			continue;
		}
		if (event.type === "assistant/message" || event.type === "step/end" || event.type === "system/message" || event.type === "developer/message" || event.type === "assistant/attempt") {
			const need = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
			if (!(open !== null && open.turn === need.turn && open.step === need.step)) {
				const t = typeof event.time === "number" ? event.time : Date.now();
				if (open !== null) out.push({
					type: "step/end",
					seq: -1,
					time: t - 2,
					data: {
						turn: open.turn,
						step: open.step
					}
				});
				out.push({
					type: "step/start",
					seq: -1,
					time: t - 1,
					data: {
						turn: need.turn,
						step: need.step
					}
				});
				inserted++;
				open = need;
			}
			out.push({ ...event });
			if (event.type === "step/end") open = null;
			continue;
		}
		out.push({ ...event });
	}
	const seqMap = /* @__PURE__ */ new Map();
	out.forEach((event, index) => {
		if (typeof event.seq === "number" && event.seq >= 0) seqMap.set(event.seq, index);
	});
	/**
	* 新 index → {type,turn,step}，供 assistant/message 的 sourceEventSeqs 做
	* 同 turn/step 校验（2026-09-10 加固，与 session-prune.repairPrunedTail
	* 同判据——两处不一致时健康检查会把坏引用放回去）。
	*/
	const metaAt = /* @__PURE__ */ new Map();
	out.forEach((event, index) => {
		const d = event.data;
		metaAt.set(index, {
			type: event.type,
			...d?.turn !== void 0 ? { turn: d.turn } : {},
			...d?.step !== void 0 ? { step: d.step } : {}
		});
	});
	const remap = (value) => seqMap.get(value);
	out.forEach((event, index) => {
		event.seq = index;
		if (Array.isArray(event.sourceEventSeqs)) {
			const mapped = [];
			const owner = event.type === "assistant/message" ? event.data : void 0;
			for (const source of flatSeqs(event.sourceEventSeqs)) {
				const next = remap(source);
				if (next === void 0 || next >= event.seq || mapped.includes(next)) continue;
				if (owner !== void 0) {
					const meta = metaAt.get(next);
					if (meta !== void 0 && meta.turn !== void 0 && meta.step !== void 0 && (meta.turn !== owner.turn || meta.step !== owner.step)) continue;
				}
				mapped.push(next);
			}
			if (mapped.length > 0) event.sourceEventSeqs = mapped;
			else delete event.sourceEventSeqs;
		}
		const data = event.data;
		if (data) {
			const range = data.shadowedRange;
			const hasRange = range !== void 0 && typeof range.start === "number" && typeof range.end === "number";
			if (Array.isArray(data.shadowedSeqs)) {
				const mapped = [];
				for (const source of data.shadowedSeqs) {
					const next = remap(source);
					if (next !== void 0 && next < event.seq && !mapped.includes(next)) mapped.push(next);
				}
				if (mapped.length > 0) {
					data.shadowedSeqs = mapped;
					if (hasRange) {
						range.start = mapped[0];
						range.end = mapped[mapped.length - 1];
					}
				}
			}
		}
		const op = event.surfaceOp;
		if (op !== void 0 && op !== null && typeof op === "object") {
			const range = op;
			if (range.op === "replace" && typeof range.startSeq === "number" && typeof range.endSeq === "number") {
				const start = remap(range.startSeq);
				const end = remap(range.endSeq);
				if (start !== void 0 && end !== void 0 && start < event.seq && end < event.seq && start <= end) {
					range.startSeq = start;
					range.endSeq = end;
				} else event.surfaceOp = "append";
			}
		}
	});
	return {
		events: out,
		inserted
	};
}
/**
* 事件数组 → DSH 写侧兼容字节：0.1.5 v3 逐事件编码（encodeCurrentEvent）+
* 多帧 zstd（header 一帧 + body 一帧，带 content-checksum）。
*/
function encodeEventsLog(header, events, zstd) {
	const encoded = encodeLogRows(header, events);
	if (encoded === null) throw new Error("encodeEventsLog: 头格式不被 0.1.5 接受");
	const headerLine = encoded.headerLine + "\n";
	const body = encoded.rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
	if (!zstd) return Buffer.from(headerLine + body, "utf8");
	const checksum = { params: { [constants.ZSTD_c_checksumFlag]: 1 } };
	return Buffer.concat([zstdCompressSync(Buffer.from(headerLine, "utf8"), checksum), zstdCompressSync(Buffer.from(body, "utf8"), checksum)]);
}
/** 对单个会话日志做健康检查；发现违规则修复写盘。返回结果或 undefined（健康/不可读）。 */
/**
* zstd 容器分帧不变量校验（2026-09-27 事故后加——§6.10）。
*
* **DSH 容器不变量：首帧恰好一行（header），次帧 = 正文。** DSH 读侧据此校验，
* 违反时报 `corrupt Zstandard session log: first frame is not exactly one
* header line`，整个会话打不开。
*
* **为什么需要这个函数**：`encodeSessionLog` 本身是对的（`Buffer.concat` 两个
* 帧），但「绕过它手搓 `zstdCompressSync` 整文件压一帧」的错误它挡不住——
* 2026-09-27 一次批量改写脚本正是如此，把 27 个会话压成单帧全部打不开。
* 逻辑内容当时完全正确（decode 正常），坏的只有物理分帧。
*
* 明文（非 zstd）无分帧概念，恒返回 true。
*
* @param buffer - 会话日志原始字节。
* @param zstd - 是否为 zstd 容器。
* @returns 合规 `{ ok: true }`；违规 `{ ok: false, reason }`。
*/
function checkZstdFraming(buffer, zstd) {
	if (!zstd) return { ok: true };
	let scan;
	try {
		scan = scanZstdFrames(buffer);
	} catch (error) {
		return {
			ok: false,
			reason: `zstd frame scan failed: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	if (scan.frames.length === 0) return {
		ok: false,
		reason: "zstd container has no frame"
	};
	const first = scan.frames[0];
	if (first === void 0) return {
		ok: false,
		reason: "zstd container has no frame"
	};
	let head;
	try {
		const end = scan.frames.length >= 2 ? scan.frames[1].start : buffer.length;
		head = zstdDecompressSync(buffer.subarray(first.start, end)).toString("utf8");
	} catch (error) {
		return {
			ok: false,
			reason: `first frame failed to decompress: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	if (head.indexOf("\n") !== head.length - 1) return {
		ok: false,
		reason: `first frame is not exactly one header line (got ${String((head.match(/\n/g) ?? []).length)} lines)`
	};
	return { ok: true };
}
function repairSessionFile(path, options = {}) {
	let buffer;
	try {
		buffer = readFileSync(path);
	} catch {
		return;
	}
	const zstd = path.endsWith(".zstd");
	const framing = checkZstdFraming(buffer, zstd);
	const framingBad = !framing.ok;
	const decoded = decodeEventsFull(buffer, zstd);
	if (decoded === null) return {
		path,
		violations: 0,
		repaired: false,
		error: framingBad ? `framing: ${framing.reason ?? "unknown"}` : "decode-fail"
	};
	const { header, events } = decoded;
	const bad = detectStepViolations(events);
	if (bad.length === 0 && !framingBad) return void 0;
	const { events: repaired, inserted } = repairStepStarts(events);
	let surfaceOk = false;
	try {
		foldSurface(repaired);
		surfaceOk = true;
	} catch {
		surfaceOk = false;
	}
	const badAfter = detectStepViolations(repaired);
	if (!surfaceOk || badAfter.length > 0) return {
		path,
		violations: bad.length,
		repaired: false,
		error: `verify-fail surface=${surfaceOk} stepBad=${badAfter.length}`
	};
	if (options.backup !== false) {
		const backupDir = options.backupDir ?? join(resolveMbsfDataDir(), "health-backups");
		const backupName = `${basename(dirname(path))}.${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.${zstd ? "jsonl.zstd" : "jsonl"}`;
		try {
			mkdirSync(backupDir, { recursive: true });
			writeFileSync(join(backupDir, backupName), buffer);
		} catch {}
	}
	const content = encodeEventsLog(header, repaired, zstd);
	const directory = dirname(path);
	const tmp = join(directory, `.mbsf-health-${process.pid}-${Date.now()}.tmp`);
	try {
		writeFileSync(tmp, content);
		const fd = openSync(tmp, "r+");
		try {
			fsyncSync(fd);
		} finally {
			closeSync(fd);
		}
		renameSync(tmp, path);
		try {
			const dirFd = openSync(directory, "r");
			try {
				fsyncSync(dirFd);
			} finally {
				closeSync(dirFd);
			}
		} catch {}
	} catch (error) {
		if (options.quiet !== false) return {
			path,
			violations: bad.length,
			repaired: false,
			error: error instanceof Error ? error.message : String(error)
		};
		throw error;
	} finally {
		rmSync(tmp, { force: true });
	}
	return {
		path,
		violations: bad.length,
		repaired: true,
		inserted,
		...framingBad ? { framingRepaired: true } : {},
		beforeBytes: buffer.length,
		afterBytes: content.length
	};
}
/** 扫描 dshHome/sessions 下全部会话日志，检测并修复 step 配对缺口。 */
async function scanAndRepairSessions(dshHome, options = {}) {
	const result = {
		repaired: [],
		skipped: 0
	};
	const yieldBudget = { last: Date.now() };
	const sessionsRoot = join(dshHome, "sessions");
	let workspaceDirs;
	try {
		workspaceDirs = readdirSync(sessionsRoot);
	} catch {
		return result;
	}
	const cutoff = options.minAgeMs !== void 0 && options.minAgeMs > 0 ? Date.now() - options.minAgeMs : 0;
	for (const workspace of workspaceDirs) {
		let sessionDirs;
		try {
			sessionDirs = readdirSync(join(sessionsRoot, workspace));
		} catch {
			continue;
		}
		for (const session of sessionDirs) {
			const directory = join(sessionsRoot, workspace, session);
			for (const name of [
				"session.v4.jsonl.zstd",
				"session.v3.jsonl.zstd",
				"session.jsonl.zstd",
				"session.v4.jsonl",
				"session.v3.jsonl",
				"session.jsonl"
			]) {
				const path = join(directory, name);
				if (!existsSync(path)) continue;
				if (cutoff > 0) try {
					if (statSync(path).mtimeMs > cutoff) {
						result.skipped += 1;
						continue;
					}
				} catch {
					continue;
				}
				if (options.thresholdBytes !== void 0 && options.thresholdBytes > 0) try {
					if (statSync(path).size < options.thresholdBytes) {
						result.skipped += 1;
						continue;
					}
				} catch {
					continue;
				}
				await yieldToEventLoop(yieldBudget);
				const outcome = repairSessionFile(path, {
					...options.minAgeMs === void 0 ? {} : { minAgeMs: options.minAgeMs },
					...options.backup === void 0 ? {} : { backup: options.backup },
					...options.backupDir === void 0 ? {} : { backupDir: options.backupDir },
					...options.quiet === void 0 ? {} : { quiet: options.quiet }
				});
				if (outcome !== void 0 && outcome.repaired) result.repaired.push(outcome);
			}
		}
	}
	return result;
}
//#endregion
//#region lib/types/date-anchor.js
/**
* 日期锚点 + 时区解析（自包含模块）。
*
* 公开版不打包记忆注入层——但日期锚是压缩的工程基础设施（时间坐标注入
* 与输出日期校验），必须自包含。
*
* 语义：浏览器时区优先 →
* 会话缓存 → 进程时区兜底，来源如实标注。
*/
/** 进程时区（Intl 解析；解析失败退回 UTC——时区名只用于标注与格式化，
*  格式化失败会退回进程默认，不阻断锚点）。 */
function processTimeZone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}
/** 校验 IANA 时区名（形态 + Intl 可解析——非法名会让格式化抛 RangeError，
*  必须前置拦截，否则锚点注入整体失败）。 */
function isValidTimeZone(zone) {
	if (zone === "") return false;
	try {
		return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone === zone;
	} catch {
		return false;
	}
}
/** 从消息 source 提取浏览器时区（DSH user-rpc 消息携带；非法名丢弃——
*  宁退回进程时区也不写错坐标）。 */
function browserTimeZoneOf(source) {
	if (typeof source !== "object" || source === null) return void 0;
	const s = source;
	if (s.kind !== "user") return void 0;
	const zone = s.clientTimeZone;
	if (typeof zone !== "string" || !isValidTimeZone(zone)) return void 0;
	return zone;
}
/** 解析锚点时区：浏览器时区优先（本步消息）→ 会话缓存 → 进程时区兜底。
*  @param messages - 本步 claimed 消息（pre-step payload）。
*  @param cached - 会话级缓存（首次解析成功后复用——后续步骤无 user-rpc
*                  消息时不再退回进程时区，保持同一会话坐标一致）。
*  @returns 时区 + 来源。 */
function resolveTimeZone(messages, cached) {
	for (const m of messages ?? []) {
		const zone = browserTimeZoneOf(m?.source);
		if (zone !== void 0) return {
			timeZone: zone,
			origin: "browser"
		};
	}
	if (cached !== void 0 && isValidTimeZone(cached)) return {
		timeZone: cached,
		origin: "browser"
	};
	return {
		timeZone: processTimeZone(),
		origin: "process"
	};
}
/** 时间戳 → 锚点时刻串（ISO 形态 + 数值偏移 + IANA 区名）：
*  `2026-09-20T01:02:34+08:00[Asia/Shanghai]`。
*  与 DSH 官方 time-context 同形态（数值偏移 + 区名双写——偏移定位绝对时刻，
*  区名定位「当地几点」，两者都在才不产生歧义）。 */
function fmtDateTime(ts, timeZone) {
	const zone = timeZone !== void 0 && isValidTimeZone(timeZone) ? timeZone : void 0;
	const fmt = new Intl.DateTimeFormat("en-US", {
		...zone === void 0 ? {} : { timeZone: zone },
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
		timeZoneName: "longOffset"
	});
	const parts = Object.fromEntries(fmt.formatToParts(ts).map((p) => [p.type, p.value]));
	const offset = (parts.timeZoneName ?? "GMT+00:00").replace(/^GMT$/, "GMT+00:00").slice(3);
	const label = zone ?? processTimeZone();
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}[${label}]`;
}
/** 构造日期锚点消息：当前时刻（带时区）+ 本地日期 + 今日记忆文件名。
*  @param now - 时间戳（默认 Date.now()，可注入便于测试）。
*  @param zone - 时区解析结果（缺省 = 进程时区——调用侧通常传 resolveTimeZone）。
*  @returns 锚点 UserMessage（source = ANCHOR_SOURCE，压缩侧可跳过）。 */
function buildDateAnchorMessage(now = Date.now(), zone) {
	const resolved = zone ?? {
		timeZone: processTimeZone(),
		origin: "process"
	};
	const date = fmtDateInZone(now, resolved.timeZone);
	return createUserMessage({
		content: [{
			type: "text",
			text: `${DATE_ANCHOR_PREFIX} 当前时间 = ${fmtDateTime(now, resolved.timeZone)}（引擎注入，来自系统时钟 + ${resolved.origin === "browser" ? "浏览器时区" : "进程时区（未取到浏览器时区）"}。本地日期 = ${date}；写作/登记/版本日期一律以此为准——禁止凭上下文推断或顺推日期；今日记忆文件 = memory/${date}.md）`
		}],
		source: ANCHOR_SOURCE
	});
}
/** 提取并归一化文本中的日期（YYYY-MM-DD / YYYY-M-D / YYYY年M月D日 →
*  YYYY-MM-DD 补零）。归一化后字典序 = 时间序（离散序比较，非连续量阈值）。 */
function extractDates(text) {
	const out = [];
	const re = /(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/g;
	for (let m = re.exec(text); m !== null; m = re.exec(text)) out.push(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
	return out;
}
/**
* 输出日期校验（2026-09-01 日期编造事故固化）：扫描文本中 > today 的日期
* （伪坐标——锚点之外自造的未建立坐标）。判定 = 离散序比较（字典序 = 时间
* 序），只抓疑似不冒充确证：未来日期可能是计划/外部引用，调用侧（index.ts）
* 以警告提示 + 声明可忽略，绝不拦截。
* @param text - 待扫文本（assistant 输出）。
* @param today - 今天（YYYY-MM-DD，锚点同源）。
* @returns 命中的未来日期（YYYY-MM-DD，去重保序）。
*/
function scanFutureDates(text, today) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const d of extractDates(text)) if (d > today && !seen.has(d)) {
		seen.add(d);
		out.push(d);
	}
	return out;
}
/** 时间戳 → 本地 YYYY-MM-DD（坐标行用——折叠统计行的日期同构；导出供
*  日期锚幂等比较用）。用进程时区（既有调用方语义不变）。 */
function fmtDate(ts) {
	const d = new Date(ts);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
/** 时间戳 → 指定时区的 YYYY-MM-DD（2026-09-20 加时区——锚点日期必须与锚点
*  时刻同一时区：否则跨时区边界时锚说 09-20、校验按进程时区算 09-19，
*  同一坐标两个值 = 伪坐标）。时区非法/格式化失败退回 fmtDate。 */
function fmtDateInZone(ts, timeZone) {
	if (timeZone === void 0 || !isValidTimeZone(timeZone)) return fmtDate(ts);
	try {
		const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit"
		}).formatToParts(ts).map((p) => [p.type, p.value]));
		return `${parts.year}-${parts.month}-${parts.day}`;
	} catch {
		return fmtDate(ts);
	}
}
//#endregion
//#region lib/types/compaction.js
/**
* 未必记忆 compaction backend — Harness 插件入口
*
* `MbsfCompactionEngine extends BasicCompactionEngine`，覆写两处：
* `summarize()`（BasicCompactionEngine 官方预留的 customization hook——
* docs/subsystems/compaction.md: "Override this sole hook for a template or
* remote summarizer"）+ `compactIfNeeded()`（'pressure' 分支：γ 冗余分析替代
* token 阈值 + 结构闭合门 structuralTurnGate 把关 + 边界钩子提前压缩——
* 2026-08-29 方案 B / 09-06 改造 A+B：压缩主触发点 = agent/turn-stopping
* 回合收尾边界（idle 降兜底），pre-step running 中同步压缩移除，见
* 05-工程接线 §5.1）。压缩的触发策略 / 区间选择 / 持久化替换其余复用
* compaction-basic，摘要由未必记忆编码 + γ 冗余判定生成，
* 零 LLM 调用。
*
* @module mbsf-compaction
*/
/** 引擎实例计数（2026-09-13）：宿主可能把同一引擎挂载两次（profile patch 与 agent
*  preset 同 id 各注册一次）⟹ 每次 pre-step 的 guard 与 turn-stopping 压缩尝试会跑两遍
*  （idle-probe.log 每事件双写实证）。构造时打印编号可直接确认实例数。 */
let _engineInstances = 0;
/** 重复构造留栈计数（2026-09-13）：宿主在同一进程内**反复** resolve 本插件
*  （实测 19 次/秒——页面一开就涨、关标签即停 = 客户端驱动），每次 resolve 都
*  new 一个引擎。前 6 次重复构造打印调用栈到探针日志，用来定位「谁在 19 次/秒
*  resolve」——写日志而非只打印，事后可直接读，不依赖人在场。 */
let _dupTraces = 0;
var MbsfCompactionEngine = class extends BasicCompactionEngine {
	/** 注入预算的上下文容量参照（token； 粗上界——per-target 容量
	*  在 compaction-basic 路由时才解析，pre-step 热路径不做精确用量扫描。
	*  默认 1M 对齐引擎注释（OpenClaw 256K→1M 演进）；config.contextWindow
	*  可覆盖。弱预算再乘 remainSafeRatio=0.1 = 40 万字符安全网，实际恒被
	*  特征比例（×0.3）与硬顶（3000）约束，此参数只作理论兜底）。 */
	contextWindowTokens;
	constructor(ctx, config = {}) {
		_engineInstances += 1;
		const loud = _engineInstances <= 3 || _engineInstances % 100 === 0;
		installProjectionDiag(ctx);
		if (loud) {
			probeIdle(`引擎实例 #${_engineInstances} 构造（pid=${process.pid}）`);
			writeEngineStatus();
			console.log(`[MBSF] 引擎实例 #${_engineInstances} 构造（pid=${process.pid}）` + (_engineInstances > 1 ? " ⚠️ 同进程已存在实例——宿主把引擎挂了两遍（配置两处同 id 注册）；已由 attempt-throttle 按进程级认领去重，同一状态位置的动作不会重复做" : ""));
		}
		if (_engineInstances > 1 && _dupTraces < 6) {
			_dupTraces += 1;
			probeIdle(`[MBSF] 引擎重复构造 #${_engineInstances}（第 ${_dupTraces}/6 次留栈）\n${(/* @__PURE__ */ new Error("duplicate-engine-construct")).stack ?? "(no stack)"}`);
		}
		checkOfficialBaseline();
		super(ctx, {
			...config,
			auto: true
		});
		this.contextWindowTokens = config.contextWindow ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
		this._registerUserMessageClosure();
		this._registerStepInjection();
		this._registerTurnBoundaryClosure();
		scheduleStartupHealth(ctx);
	}
	/**
	* 用户发消息后压缩·主触发点（2026-09-10 一帆「压缩时机从会话结束改到
	* 用户发消息后」固化——取代 2026-08-30「会话结束后压缩」作为主路径）：
	* 用户发出消息、本轮推理开始之前，把已闭合的历史压掉（γ 零 LLM）。
	*
	* 时序依据（为什么"发消息后压"能立刻生效——已核 DSH 源码）：agent-loop
	* 的 `preStep()` 在 `append('user/message')` **之前**派发本 hook
	* （packages/core/agent-loop/src/agent.ts:235），而 `step()` 的模型请求
	* 上下文由 `session.deriveMessages()` **实时推导**（同文件:341）——因此
	* 此处同步 await 压完，紧随其后的本轮推理拿到的正是「压缩后的历史 +
	* 新用户消息」。
	*
	* 判定：回合首步（`step === 1`）且本步 claim 到真实用户消息（`source.kind
	* === 'user'`——goal round 续跑消息 kind='goal' 是状态机骨架、系统注入
	* 消息 kind='plugin'/'skill-catalog' 非用户发言，均不触发）；每回合至多
	* 触发一次（WeakMap 节流——2026-09-06 复盘固化：压缩不占推理热路径，同
	* 回合多步不重复跑守卫链）。
	*
	* 结构门：调用带空 opts（非 undefined）= 放行 compactIfNeeded 的「pre-step
	* 非 force 挂起」拦截（2026-09-06 改造 B）；此时 turn/start 已写、turn/end
	* 未写 → structuralTurnGate 走收缩分支，压缩区自动收到当前回合第一条消息
	* 之前——只压历史，不动本轮（用户正在阅读的链不断）。
	*
	* 兜底：turn-stopping（回合收尾，2026-09-10 一帆确认）——重复压缩由守卫链
	* 拦截（surface 无新冗余 → null）。
	*
	* 行为：
	*  - 失败静默：try/catch + return next()（压缩是增强，不阻断推理）；
	*  - 并发安全：compactRegion 自带 busy 锁，与兜底触发互斥；
	*  - 开关：compactIfNeeded 内部读 runtime-config 的 autoCompact（实时）。
	*/
	_registerUserMessageClosure() {
		const { ctx } = this;
		ctx.on("agent/pre-step", async ({ agent, signal, messages, turn, step }, next) => {
			try {
				if (step === 1 && !signal.aborted && userTurnFoldedOf(agent) !== turn) {
					if ((messages ?? []).some((message) => message.source.kind === "user")) {
						claimUserTurnFold(agent, turn);
						probeIdle(`user-message: agent=${agent.id} turn=${turn} — 调用 compactIfNeeded`);
						const doneFold = markPhase("压缩（压缩面 pre-step）");
						const result = await this.compactIfNeeded(agent, "pressure", signal, false, {});
						doneFold();
						probeIdle(`user-message: compactIfNeeded 返回 ${result === null ? "null" : `shadowed ${result.shadowedSeqs.length} (${result.shadowedRange.start}-${result.shadowedRange.end})`}`);
						if (result !== null) ctx.logger.info(`[MBSF] compaction (user-message closure): shadowed ${result.shadowedSeqs.length} surface nodes (seqs ${result.shadowedRange.start}-${result.shadowedRange.end})`);
					}
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				probeIdle(`user-message: 异常 ${message}`);
				ctx.logger.warn(`[MBSF] user-message compaction failed: ${message}; continuing the turn`);
			}
			return next();
		});
	}
	/**
	* 记忆自动按需浮现（E.24 定稿 / 7.6.1 + P0 #5）：agent/pre-step 每步
	* 判定一次——特征（最近输出 + 最新输入）→ recallContent（需判门控）→
	* 接续度自适应选择 → 📎 注入消息并进 step 输入。LLM 无感 + 用户可见。
	*
	* ⚠️ 状态注记（2026-09-01 审计③）：注入正文 = 定义当回忆过渡形态
	* （representativeText = 首次产生 label——7.9.3 重做根因，见 注入层
	* 注释）；**默认关维持**（不注入 = 基线，2026-08-24 语义反转；UI 配置
	* 面板可实时开）——期②路径骨架（pathText）落地 + 观测验证前不评估
	* 默认开（重做根因未除，开了 = 把「定义」当「回忆」喂给 LLM）。
	*
	* 行为：
	*  - 特征太短（< MIN_FOOTPRINT_CHARS）= 无新增量 = 不注入（不吵）；
	*  - == 真止（need=true）必注入，数量由分岔结构产生（命中几条注几条）；
	*  - 判定 过渡止（need=false）不注入——`=` 是离散事件，没识别 = 不注入（Round 9 弱接续预算路径已删，无预算参数）；
	*  - 同 turn 幂等（topicId 去重）+ 特征排除注入消息自身（防自我强化环）；
	*  - 任何失败静默降级 return next()（注入是增强，不阻断推理）。
	*/
	_registerStepInjection() {
		const { ctx } = this;
		ctx.on("agent/pre-step", async ({ agent, signal, messages, turn }, next) => {
			if (signal.aborted) return next();
			try {
				const _tGuard = Date.now();
				await runContextGuard(ctx, agent, this, messages ?? [], signal);
				const _guardMs = Date.now() - _tGuard;
				if (_guardMs > 200) ctx.logger.info(`[MBSF] pre-step 上下文守卫 用时 ${_guardMs}ms`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.logger.warn(`[MBSF] context guard failed: ${message}; continuing the turn`);
			}
			const cfg = getRuntimeConfigForAgent(agent);
			const zone = resolveTimeZone(messages, _anchorZoneByAgent.get(agent.id));
			if (zone.origin === "browser") _anchorZoneByAgent.set(agent.id, zone.timeZone);
			if (cfg.dateAnchorEnabled) try {
				checkAssistantFutureDates(agent, ctx, zone.timeZone);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.logger.warn(`[MBSF] date check failed: ${message}; continuing the turn`);
			}
			const enter = [];
			try {
				if (cfg.dateAnchorEnabled) {
					const anchor = buildTurnAnchor(agent, turn, zone);
					if (anchor) enter.push(anchor);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.logger.warn(`[MBSF] date anchor failed: ${message}; continuing the turn`);
			}
			if (enter.length === 0) return next();
			return {
				kind: "enter",
				messages: [...messages ?? [], ...enter]
			};
		});
	}
	/**
	* 【已删除·2026-09-14】idle closure 兜底（原方案 B 2026-08-29 引入）。
	*
	* 删除依据 = 运行时实证（不留"看起来有兜底"的假象）：
	*  - **结构性不可用**：idle 时无进行中回合，compactRegion 直接抛
	*    「no open turn — automatic compaction events must be enclosed in a
	*    turn」（DSH 不变式：自动压缩事件必须被 turn 包裹）。探针实证
	*    2026-09-14T09:37:55Z：`idle: compactIfNeeded 异常 compactRegion:
	*    no open turn`——turn-stopping 能成是因为它传了
	*    `{ allowOpenTurn: true }`（见下）。
	*  - **零次成功**：idle-probe.log 全量（2026-09-09 → 09-14）统计，
	*    idle 触发成功压缩 **0 次**（turn-stopping 675 / user-message 32）；
	*    其覆盖范围被 turn-stopping 完全包含，且每次 idle 都写异常日志。
	*
	* 压缩落位链现为三层：turn-stopping（主，回合收尾）→ user-message
	* （保险，回合首步补漏）→ context-overflow（DSH 溢出强制）。若将来 DSH
	* 放宽「压缩事件必须被 turn 包裹」的不变式，再考虑恢复。
	*/
	/**
	* 压缩落位链收尾边界·主触发点（2026-09-06 改造 A——一帆「发触发真发去」
	* 复盘固化：压缩必须发生在结构真的闭合的瞬间，不靠事后机会）：agent-loop
	* 每回合最后一步走完、turnEnds 且 inbox 无排队下一步时派发
	* agent/turn-stopping（packages/core/agent-loop/src/agent.ts:295）——这是
	* 回合收尾的确定性边界，比 idle 更早更可靠（覆盖「回合结束但立即排队开
	* 新回合、中间无 idle 窗口」：排队场景下旧回合的压缩不等下回合结束）。
	*
	* 时序：dispatch.serial 派发时本回合的 turn/end 尚未写入（turn() 的
	* finally 才 append），结构门看到「有进行中回合」——因此调用必须带
	* opts.allowOpenTurn = true（收尾回合不会再增长 = 已闭合，豁免进行中
	* 拦截；首回合收尾同样放行——见 structuralTurnGate 2026-09-06 注释）。
	* handler 内 fire-and-forget（void）——不 await 压缩，serial 立即返回，
	* turn/end 由 finally 正常写入；压缩守卫链的同步段在 handler 返回前已
	* 跑完（此刻 turn/end 未写 = allowOpenTurn 是必需路径而非兜底），
	* compactRegion 的事务在事件循环后续执行（turn/end 已写，无冲突）。
	*
	* 行为：
	*  - 无节流：turn-stopping 每回合至多派发一次（agent-loop 触发后 break），
	*    重复压缩由 compactIfNeeded 内部守卫拦截（surface 无新冗余 → null）；
	*  - 并发安全：compactRegion 自带 busy 锁，与下一回合 pre-step 的守卫
	*    force 压缩互斥（busy 锁挡）；
	*  - 失败静默：fire-and-forget + try/catch（压缩是增强，不阻断生命周期）。
	*/
	_registerTurnBoundaryClosure() {
		const { ctx } = this;
		ctx.on("agent/turn-stopping", ({ agent, signal }) => {
			probeIdle(`turn-stopping: agent=${agent.id} lastNode=${agent.session?.surface?.nodes?.at(-1)}`);
			try {
				probeIdle("turn-stopping: 调用 compactIfNeeded (allowOpenTurn)");
				const tsNodes = agent.session?.surface?.nodes;
				const tsLast = tsNodes && tsNodes.length > 0 ? tsNodes[tsNodes.length - 1] : void 0;
				if (tsLast !== void 0 && !claimTurnStopAttempt(agent, tsLast)) probeIdle("turn-stopping: 跳过重复压缩尝试（进程级去重）");
				else {
					const doneTurnFold = markPhase("回合收尾压缩尝试");
					this.compactIfNeeded(agent, "pressure", signal, false, { allowOpenTurn: true }).then((result) => {
						doneTurnFold();
						probeIdle(`turn-stopping: compactIfNeeded 返回 ${result === null ? "null" : `shadowed ${result.shadowedSeqs.length} (${result.shadowedRange.start}-${result.shadowedRange.end})`}`);
						if (result !== null) ctx.logger.info(`[MBSF] compaction (turn-stopping closure): shadowed ${result.shadowedSeqs.length} surface nodes (seqs ${result.shadowedRange.start}-${result.shadowedRange.end})`);
					}).catch((error) => {
						doneTurnFold();
						const message = error instanceof Error ? error.message : String(error);
						probeIdle(`turn-stopping: compactIfNeeded 异常 ${message}`);
						ctx.logger.warn(`[MBSF] turn-stopping compaction failed: ${message}; continuing`);
					});
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				probeIdle(`turn-stopping: 触发异常 ${message}`);
				ctx.logger.warn(`[MBSF] turn-stopping compaction trigger failed: ${message}`);
			}
		});
	}
	/**
	* 每轮 γ 压缩（对齐 OpenClaw before_prompt_build 语义）：
	* γ 冗余分析替代 token 阈值——只要有可压缩冗余就落地压缩，不等 token
	* 涨到阈值。
	*
	* 触发策略（2026-09-06 改造 A+B 固化——一帆「发触发真发去」复盘）：
	* **γ 压缩只在结构闭合边界触发，running 中（pre-step）不压缩**——基类
	* 在 agent/pre-step 每步调用本方法（无 opts 非 force），B 拦截直接
	* return null（此前 running 中每步都跑 O(surface) 守卫 + 结构门同步段，
	* 曾实测把 LLM 推理请求拖慢 3 次 pre-step 同步）。真正触发者：
	*  - agent/turn-stopping 收尾边界（主触发点，_registerTurnBoundaryClosure
	*    ——带 opts { allowOpenTurn: true }：回合逻辑走完、turn/end 未写，
	*    结构门豁免进行中拦截）；
	*  - 上下文守卫 force（runContextGuard——token 溢出救火，force 豁免
	*    拦截与结构门，保留阻塞性：宁可阻塞不可溢出死锁）；
	*  - context-overflow 恢复分支（走 super，保持基类逻辑）。
	*
	* 行为：
	*  - 跳过已有 checkpoint（含标记的消息），避免链式重复压缩同一摘要；
	*  - tail 自适应保留（1-5 轮，γ EMA / radical 衰减驱动），tail 前若有
	*    真实消息即可压（至少压 1 条、tail 至少留 2 条）；
	*  - 压缩区结束处必须是 tool 配对平衡边界，绝不切开未完成的 tool call/result；
	*  - 压缩区间从 surface 最老节点开始（含 checkpoint），新摘要压缩旧摘要
	*    （extractPreviousCheckpoint → previousSummary 头部），历史持续精简。
	*
	* context-overflow 分支保持基类逻辑（provider 确认溢出时强制恢复）。
	*
	* @param opts - boundary 来源标记：idle / turn-stopping 钩子传入（空对象
	*  或 { allowOpenTurn }）。undefined = 基类 pre-step hook 的 running 中
	*  调用 → 非 force 一律 return null（2026-09-06 B）。force（守卫救火）
	*  不依赖 opts。
	*/
	async compactIfNeeded(agent, trigger, signal, force = false, opts) {
		if (trigger !== "pressure") return super.compactIfNeeded(agent, trigger, signal);
		if (opts === void 0 && !force) {
			probePreStepSkip();
			return null;
		}
		if (!getRuntimeConfigForAgent(agent).autoCompact) {
			probeIdle("guard: autoCompact=false");
			return null;
		}
		const session = agent.session;
		const surfaceNodes = session.surface.nodes;
		if (surfaceNodes.length < MIN_GAMMA_MESSAGES && !force) {
			probeIdle(`guard: surfaceNodes=${surfaceNodes.length} < ${MIN_GAMMA_MESSAGES}`);
			return null;
		}
		if (!force) {
			const tailGuard = getRuntimeConfigForAgent(agent).compactTailMessages + MIN_TAIL_MESSAGES;
			if (surfaceNodes.length <= tailGuard) {
				probeIdle(`guard: surfaceNodes=${surfaceNodes.length} <= tailGuard=${tailGuard} (无可压区间)`);
				return null;
			}
		}
		const mapped = [];
		for (const seq of surfaceNodes) {
			const event = session.eventAt(seq);
			if (event === void 0) continue;
			const message = session.deriveEventMessage(event);
			if (message === null) continue;
			if (extractCompactableText(message).length === 0 || isCheckpointText(extractText(message))) continue;
			if (isInjectSource(message.source)) continue;
			mapped.push({
				seq,
				message
			});
		}
		if (mapped.length < MIN_GAMMA_MESSAGES && !force) {
			probeIdle(`guard: mapped=${mapped.length} < ${MIN_GAMMA_MESSAGES}`);
			return null;
		}
		const messages = mapped.map((entry) => entry.message);
		const sessionKey = normalizeSessionKey(session.id, messages);
		updateSessionOmega(messages, sessionKey);
		const tailStart = force ? Math.max(1, mapped.length - MIN_TAIL_MESSAGES) : structuralTailStart(messages, void 0, {
			tailMessages: getRuntimeConfigForAgent(agent).compactTailMessages,
			sessionKey
		});
		if (tailStart < 1) {
			probeIdle(`guard: tailStart=${tailStart} < 1`);
			return null;
		}
		let endIdx = Math.min(tailStart - 1, mapped.length - MIN_TAIL_MESSAGES - 1);
		if (endIdx < 1) {
			probeIdle(`guard: endIdx=${endIdx} < 1 (tailStart=${tailStart}, mapped=${mapped.length})`);
			return null;
		}
		const shadowChars = mapped.slice(0, endIdx + 1).reduce((total, entry) => total + extractCompactableText(entry.message).length, 0);
		const gateSeqs = tailTurnBoundarySeqs(session);
		const gated = gateSeqs === null ? structuralTurnGate(session.snapshotEvents(), mapped, endIdx, force, opts) : structuralTurnGateFromSeqs(gateSeqs.end, gateSeqs.start, mapped, endIdx, force, opts);
		if (gated === null) {
			probeIdle("guard: structuralTurnGate 拦截（进行中回合/无闭合）");
			return null;
		}
		endIdx = gated;
		const headSeq = surfaceNodes[0];
		let startPos = session.eventAt(headSeq)?.type === "system/message" ? 1 : 0;
		let startSeq = surfaceNodes[startPos] ?? headSeq;
		let endSeq = mapped[endIdx].seq;
		let endPos = surfaceNodes.indexOf(endSeq);
		if (endPos === -1) {
			probeIdle(`guard: endSeq=${endSeq} 不在 surface 上`);
			return null;
		}
		if (endPos <= startPos) {
			probeIdle(`guard: endPos=${endPos} <= startPos=${startPos}（头保护后无可压区间）`);
			return null;
		}
		while (endIdx >= 1 && !toolPairingBalancedAfter(session, mapped[endIdx].seq)) endIdx--;
		if (endIdx < 1) {
			probeIdle("guard: toolPairing 收缩后 endIdx < 1");
			return null;
		}
		{
			const endSeqBefore = mapped[endIdx].seq;
			const surfIdx = surfaceNodes.indexOf(endSeqBefore);
			if (surfIdx === -1) {
				probeIdle(`guard: endSeq=${endSeqBefore} 不在 surface 上`);
				return null;
			}
			let tuned = surfIdx;
			while (tuned >= 1 && !toolPairingBalancedAfter(session, surfaceNodes[tuned])) tuned--;
			if (tuned < 1) {
				probeIdle("guard: surface 精调后无可用边界");
				return null;
			}
			if (tuned !== surfIdx) {
				let back = endIdx;
				while (back >= 1 && surfaceNodes.indexOf(mapped[back].seq) > tuned) back--;
				if (back < 1) {
					probeIdle("guard: surface 精调映射回 mapped 后 endIdx < 1");
					return null;
				}
				probeIdle(`toolPairing 精调: ${endSeqBefore} → ${mapped[back].seq}（surfIdx ${surfIdx} → ${tuned}）`);
				endIdx = back;
			}
		}
		endSeq = mapped[endIdx].seq;
		endPos = surfaceNodes.indexOf(endSeq);
		if (endPos <= startPos) {
			probeIdle(`guard: 平衡收缩后 endPos=${endPos} <= startPos=${startPos}`);
			return null;
		}
		let preflight;
		try {
			const measurement = this.ctx.tokenMeter.measure(session);
			const startSeqNum = mapped[0].seq;
			const endSeqNum = endSeq;
			const spanTokens = measurement.nodes.filter((node) => node.seq >= startSeqNum && node.seq <= endSeqNum).reduce((total, node) => total + node.tokens, 0);
			const regionMessages = mapped.slice(0, endIdx + 1).map((entry) => entry.message);
			preflight = shrinkPreflight(regionMessages, normalizeSessionKey(session.id, regionMessages), extractPreviousCheckpoint(regionMessages), spanTokens, agent.session?.header?.agentPreset, this.ctx.tokenMeter, getRuntimeConfigForAgent(agent).compactTailMessages);
			if (preflight.framedTokens >= preflight.spanTokens) {
				probeIdle(`guard: shrink 预演拦下（帧+摘要 ${preflight.framedTokens} tokens >= 被压区间 ${preflight.spanTokens} tokens，shadowChars=${shadowChars}, 帧字符成本≈${FRAME_CHARS}）——等积累`);
				return null;
			}
			probeIdle(`shrink 预演通过: 帧+摘要 ${preflight.framedTokens} < 被压区间 ${preflight.spanTokens} tokens（节省 ${preflight.spanTokens - preflight.framedTokens}）`);
		} catch (error) {
			probeIdle(`shrink 预演不可用（${error instanceof Error ? error.message : String(error)}）——退回官方 shrink 校验兜底`);
			preflight = void 0;
		}
		if (preflight !== void 0) _preflightByAgent.set(agent.id, {
			summary: preflight.summary,
			framedTokens: preflight.framedTokens,
			spanTokens: preflight.spanTokens
		});
		probeIdle(`通过全部守卫: startSeq=${startSeq} endSeq=${endSeq} endIdx=${endIdx}`);
		try {
			const compacted = await this.compactRegion(startSeq, endSeq, agent, signal);
			if (preflight !== void 0) notePreflightAgreement();
			return compacted;
		} catch (error) {
			if (preflight !== void 0) notePreflightDisagreement(error);
			throw error;
		}
	}
	/**
	* 未必记忆 γ 压缩：零 LLM。摘要 = 冗余压缩 + 高 γ（新方向）消息保留。
	* 前序 checkpoint（若有）被压缩进摘要头部。
	* @param input - 被压缩区间的会话前缀（system + tools + messages）。
	* @param agent - 会话所有者，提供 session id 作为 γ 参照。
	* @param signal - 取消信号；中止时立即抛出。
	* @returns 纯文本摘要块 + mbsf/local 调用信封（无 LLM 调用标记）。
	*/
	async summarize(input, agent, signal) {
		signal?.throwIfAborted();
		const t0 = Date.now();
		const sessionKey = normalizeSessionKey(agent.session.id, input.messages);
		const previousSummary = extractPreviousCheckpoint(input.messages);
		const shadowChars = input.messages.reduce((total, message) => total + extractCompactableText(message).length, 0);
		const maxChars = bodyBudget(shadowChars);
		const cached = _preflightByAgent.get(agent.id);
		_preflightByAgent.delete(agent.id);
		const text = cached !== void 0 ? cached.summary : buildCheckpointBody(mbsfSummarize([...input.messages], {
			sessionKey,
			maxChars,
			wholeRegion: true,
			tailMessages: getRuntimeConfigForAgent(agent).compactTailMessages,
			...previousSummary === void 0 ? {} : { previousSummary },
			...agent.session?.header?.agentPreset ? { agent: agent.session.header.agentPreset } : {}
		}), shadowChars);
		try {
			const compactableMsgs = input.messages.filter((m) => extractCompactableText(m).length > 0).length;
			recordCompactionYield({
				sessionKey,
				shadowChars,
				summaryChars: text.length,
				netChars: shadowChars - text.length,
				inputMessages: input.messages.length,
				compactableMsgs,
				bodyRatio: shadowChars > 0 ? text.length / shadowChars : 0,
				elapsedMs: Date.now() - t0
			});
		} catch {}
		return {
			summary: [{
				type: "text",
				text
			}],
			provider: "mbsf",
			model: "local"
		};
	}
};
/**
* 上下文守卫（防死锁兜底，2026-08-26 死锁复盘固化）：每步 pre-step 在基类
* 压缩 hook 之后运行——基类压力分支只做 γ 冗余压缩，measure 抛错或 γ 判定
* 无冗余时超限请求照发，provider 拒绝 → context-overflow 恢复循环 → 死锁。
*
* 本守卫在请求发出前估算「当前用量 + 本步增量」：
*  - 无 usage 锚（measure 抛错 / baseline 非 usage）→ 'ok'（不判——启发式
*    不单独定罪；2026-09-21 修复①）；
*  - 未超限（容量 × GUARD_LIMIT_RATIO）→ 'ok'（零动作）；
*  - 超限 → 本地强制压缩（compactIfNeeded force——零 LLM 的 γ 摘要），
*    释放空间 → 'compacted'；
*  - 压缩也救不了（内容太小 / 锁占用 / 无可压区间）→ 'ok' + warn——
*    **不再 reject**（2026-09-21 修复②）：reject 会经 `agent/pre-step` 直达
*    `turn/end {kind:'blocked'}` 把用户消息吞掉；真溢出交给 DSH 自带
*    `context-overflow` 恢复链（prune + compact + 有界重试，错误可见）。
*
* 容量参照（2026-08-30 一帆「超限前拦截 + 自适应而非设数值/比例」固化）：
* per-target 真实窗口——最近一次 durable 路由的 provider/model（与基类压力
* 路由同源）→ resolveModelInfo 的 context.contextWindow × 0.85。原实现用
* engine.contextWindowTokens 常量（默认 1M），对窗口 < 850K 的模型是死代码
* （用量到不了 850K 前 provider 早超限），守卫实际从不触发——只有 per-target
* 窗口才让「超限就压、报错前拦截」对任意模型成立。解析失败（无路由记录 /
* resolveModelInfo 抛错）降级引擎 contextWindowTokens 粗上界。
*
* 输出占位扣减（2026-08-30 会话 1049552 超限复盘固化）：per-request
* 输出上限（defaultMaxTokens，deepseek 默认 256K）也占用模型总窗口——只按
* contextWindow×0.85 会让消息侧压到 850K 就放行，但实际请求
* 850K messages + 256K max_tokens 仍超 API 上限被拒（：793552+256000
* = 1049552 > 1048576）。守卫窗口 = (contextWindow − defaultMaxTokens) × 0.85
* ——消息侧预留输出占位后才乘余量系数，任何 maxTokens 配置都自适应安全。
* defaultMaxTokens 缺省（非 deepseek provider / 解析失败）→ 保持原 context
* 窗口×0.85（请求侧不注入 maxTokens 时无输出占位）。
*/
/** 上下文守卫超限比（2026-08-26 死锁复盘固化）：用量 + 本步增量超限时
*  本地强制压缩（压不动则放行——真溢出交 DSH 恢复链，见上）。
*  （工程护栏——非内容常数，无独立 判定依据 依据，可再校准。） */
const GUARD_LIMIT_RATIO = .85;
/** 守卫容量参照解析（per-target）：与基类压力路由同源
*  （compaction-basic routedTarget + resolveModelInfo），解析失败降级
*  engine.contextWindowTokens（粗上界安全网）。 */
async function resolveGuardLimitTokens(ctx, agent, engine, signal) {
	let windowTokens = engine.contextWindowTokens;
	try {
		const config = agent.session.requestHeader()?.config;
		if (config !== void 0 && config.provider.length > 0 && config.model.length > 0) {
			const info = await ctx.llm.resolveModelInfo(config.provider, config.model, signal);
			const contextWindow = info.context?.contextWindow;
			const defaultMaxTokens = info.defaultMaxTokens;
			if (typeof contextWindow === "number" && contextWindow > 0) {
				windowTokens = contextWindow;
				if (typeof defaultMaxTokens === "number" && defaultMaxTokens > 0) windowTokens = contextWindow - defaultMaxTokens;
			}
		}
	} catch {}
	return Math.floor(windowTokens * GUARD_LIMIT_RATIO);
}
async function runContextGuard(ctx, agent, engine, stepMessages, signal) {
	let currentTokens;
	let usageAnchored;
	try {
		const measurement = ctx.tokenMeter.measure(agent.session);
		currentTokens = measurement.totalTokens;
		usageAnchored = measurement.baseline.kind === "usage";
	} catch {
		return "ok";
	}
	if (!usageAnchored) return "ok";
	const deltaTokens = stepMessages.reduce((total, message) => total + ctx.tokenMeter.estimateMessage(message), 0);
	const limit = await resolveGuardLimitTokens(ctx, agent, engine, signal);
	if (currentTokens + deltaTokens <= limit) return "ok";
	ctx.logger.warn(`[MBSF] context guard: ~${currentTokens}+${deltaTokens} tokens over ${limit} (${JSON.stringify({
		provider: agent.session.requestHeader()?.config.provider,
		model: agent.session.requestHeader()?.config.model
	})}); forcing local compaction`);
	signal.throwIfAborted();
	if (await engine.compactIfNeeded(agent, "pressure", signal, true) !== null) return "compacted";
	ctx.logger.warn(`[MBSF] context guard: compaction cannot relieve ~${currentTokens}+${deltaTokens} tokens; passing the step through (DSH context-overflow recovery owns a real overflow)`);
	return "ok";
}
/** DSH home 解析（与 enable.ts 的 dshHome 同序：$DSH_HOME 优先，缺省 ~/.dsh）。 */
function engineDshHome() {
	return process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : join(homedir(), ".dsh");
}
/** 尾部倒扫出结构门的两个判据下标（2026-09-14 阻塞治本）。
*
*  背景（看门狗日志 + 只读调查）：全量阻塞事件里 **46%（252/547）** 的首位
*  自耗时是宿主 `get events` / `snapshotEvents`（1.3~2.1s/次），触发点就是
*  本文件为喂结构门而调 `session.snapshotEvents()`。宿主实现为
*  `eventsSnapshot ??= Object.freeze([...this.log])`——**每次 append 后失效**
*  重建一个 n 元冻结数组（n = 会话事件数，10⁴~10⁵）。而门**只用两个下标**
*  （最后一个 `turn/end`、最后一个 `turn/start`），每回合却要付两次全量重建
*  （pre-step + turn-stopping）。
*
*  为什么等价且便宜：宿主 `eventAt(seq)` = `this.log[seq]`（O(1)，不是整数组
*  重建），`session.seq` = 日志长度（可靠上界）。全扫取「最后一个匹配下标」，
*  尾部倒扫取「第一个匹配」＝ 同一个下标。
*
*  安全阀：① 倒扫只在尾部窗口 TAIL_SCAN_CAP 内找，两个判据没同时落在窗口内
*  → 返回 null，调用方回退原全量路径（语义不变）；② 窗口已覆盖全日志时，
*  缺判据 = 真的不存在（-1 权威）；③ 任何异常 → null 回退。
*
*   纯性能护栏（窗口大小只决定「走快路径还是回退全量」，两条路径**语义
*  等价**）——5000 覆盖实测会话 p99（`session.seq` 长度），超出即回退，不改变
*  任何判定结果 ⟹ 不进判定层（§9.3.8）。 */
const TAIL_SCAN_CAP = 5e3;
function tailTurnBoundarySeqs(session) {
	try {
		const total = Number(session.seq);
		if (!Number.isFinite(total) || total <= 0) return null;
		const coversWholeLog = total <= TAIL_SCAN_CAP;
		const floor = coversWholeLog ? 0 : total - TAIL_SCAN_CAP;
		let end = -1;
		let start = -1;
		for (let s = total - 1; s >= floor; s--) {
			const type = session.eventAt(s)?.type;
			if (type === "turn/end") {
				if (end < 0) end = s;
			} else if (type === "turn/start") {
				if (start < 0) start = s;
			}
			if (end >= 0 && start >= 0) break;
		}
		if ((end < 0 || start < 0) && !coversWholeLog) return null;
		return {
			end,
			start
		};
	} catch {
		return null;
	}
}
/** 启动健康扫描只处理 mtime 早于此年龄的日志（排除活跃会话）。
* （工程标定——1 小时足够覆盖重启间隙，活跃会话每步都在写。）
*  注：原 `STARTUP_PRUNE_MIN_AGE_MS` 随启动剪裁退役改名——现在只有健康
*  自愈在用（剪裁不再有启动路径）。 */
const STARTUP_HEALTH_MIN_AGE_MS = 3600 * 1e3;
/** 启动健康检查（进程级 once）：扫描全部会话日志的 step 配对缺口并修复。
*  独立于任何剪裁开关（安全网永远开），受 mtime 防线保护（不碰活跃会话）。
*  任何失败静默降级——健康检查是增强，不阻断启动。 */
let _startupHealthScheduled = false;
function scheduleStartupHealth(ctx) {
	if (_startupHealthScheduled) return;
	_startupHealthScheduled = true;
	setTimeout(async () => {
		try {
			const result = await scanAndRepairSessions(engineDshHome(), { minAgeMs: STARTUP_HEALTH_MIN_AGE_MS });
			if (result.repaired.length > 0) {
				const details = result.repaired.map((r) => `\n  - ${r.path}: ${r.violations} 违规 → 补插 ${r.inserted} 个 step/start`).join("");
				ctx.logger.info(`[MBSF] 会话健康自愈：修复 ${result.repaired.length} 个文件（跳过 ${result.skipped} 个）${details}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.logger.warn(`会话健康检查失败：${message}（继续启动）`);
		}
	}, 0);
}
/** 日期锚点幂等状态：agentId → 已注入锚的 turn（同 turn 不重复注入）。 */
const _anchorTurnByAgent = /* @__PURE__ */ new Map();
/** 日期锚点会话时区缓存：agentId → 浏览器时区（首次解析成功后复用——
*  后续步骤无 user-rpc 消息时保持同一会话位置，不退回进程时区）。 */
const _anchorZoneByAgent = /* @__PURE__ */ new Map();
/** shrink 预演产物缓存：agentId → 预演生成的摘要（2026-11-03）。
*
*  **为什么缓存**：预演（`shrinkPreflight`）为了拿到精确 token 数，必须
*  真实跑一遍 `mbsfSummarize`。若真实路径 `summarize()` 再跑一遍，等于
*  做两次同样的纯计算——且**两次结果必须相同**（`elapsedMs` 字段会让
*  统计行不同，但正文相同，token 数差异可忽略）。缓存让真实路径直接复用
*  预演产物：既省一次计算，也保证「预演算的就是真实用的」。
*
*  **失效**：`compactRegion` 成功/失败后立即删除（见 `summarize` 末尾
*  `finally`）。预演到 summarize 之间没有 await 间隔（同步链路），
*  不存在陈旧风险；但失败路径不删会泄漏，故统一在 summarize 里清。
*  （🟡 若未来 compactRegion 支持并发多区间，本缓存需改成按区间键。） */
const _preflightByAgent = /* @__PURE__ */ new Map();
/** 清派生缓存（2026-11-09 公开版「立即省内存」）：清掉可重算的 Map。
*  清后下次预检/锚定重新计算（多花几 ms），内存立刻下降；不删任何持久数据。 */
function clearDerivedCaches() {
	const cleared = {
		preflight: _preflightByAgent.size,
		anchorTurn: _anchorTurnByAgent.size,
		anchorZone: _anchorZoneByAgent.size
	};
	_preflightByAgent.clear();
	_anchorTurnByAgent.clear();
	_anchorZoneByAgent.clear();
	return cleared;
}
/** 会话生效的运行时配置（全局 + 会话覆盖——子代理/分叉会话默认继承父会话
*  设置：自身覆盖 → 父链 → 全局；2026-09-02 一帆固化）。 */
function getRuntimeConfigForAgent(agent) {
	const identity = {
		sessionId: agent.session.id,
		...agent.session.header?.parentSession !== void 0 ? { parentSessionId: agent.session.header.parentSession } : {}
	};
	return getRuntimeConfigForSession(getRuntimeConfig(), identity);
}
/** 日期锚点状态上限保护：超限清最旧（工程边界，防无界增长——
*  与注入 turn 状态 MAX_TURN_STATES 同构）。 */
const MAX_ANCHOR_STATES = 200;
/** 输出日期校验去重：agent → 已校验的最新 assistant seq（WeakMap——
*  agent 销毁自动回收，无泄漏）。 */
const _dateCheckedSeqByAgent = /* @__PURE__ */ new WeakMap();
/** 每 agent 每回合首步注入时间锚（幂等 Map：同 turn 重复 = 识别 = 不注入）。
*  @param agent - 当前 agent。
*  @param turn - 当前 turn（幂等键）。
*  @param zone - 时区解析结果（锚文声明位置来源）。
*  @returns 锚点消息；本 turn 已注入过返回 null。 */
function buildTurnAnchor(agent, turn, zone) {
	if (_anchorTurnByAgent.get(agent.id) === turn) return null;
	_anchorTurnByAgent.set(agent.id, turn);
	if (_anchorTurnByAgent.size > MAX_ANCHOR_STATES) {
		const oldest = _anchorTurnByAgent.keys().next().value;
		if (oldest !== void 0) _anchorTurnByAgent.delete(oldest);
	}
	return buildDateAnchorMessage(Date.now(), zone);
}
/** 校验本 agent 自上次检查以来的 assistant 输出（抓 > 今天的日期 = 伪位置，
*  只警告不拦截——校验是增强不是闸门；未来日期可能是计划/外部引用，警告
*  文案声明可忽略）。按 agent 记录已检查的最新 seq（幂等：无新消息不重扫）。
*  @param timeZone - 与锚点同一时区（跨时区边界时锚与校验必须同源，
*                    否则同一位置两个值）。 */
function checkAssistantFutureDates(agent, ctx, timeZone) {
	const today = fmtDateInZone(Date.now(), timeZone);
	const session = agent.session;
	const nodes = session.surface.nodes;
	const lastChecked = _dateCheckedSeqByAgent.get(agent) ?? -1;
	let maxSeq = lastChecked;
	const hits = [];
	for (let i = nodes.length - 1; i >= 0; i--) {
		const seq = nodes[i];
		if (seq === void 0) continue;
		if (seq <= lastChecked) break;
		const event = session.eventAt(seq);
		if (event?.type !== "assistant/message") continue;
		const message = session.deriveEventMessage(event);
		if (message === null) continue;
		const text = extractText(message);
		if (text.length === 0) continue;
		const futures = scanFutureDates(text, today);
		if (futures.length > 0) hits.push({
			seq,
			futures,
			snippet: text.slice(0, 120)
		});
		if (seq > maxSeq) maxSeq = seq;
	}
	if (maxSeq > lastChecked) _dateCheckedSeqByAgent.set(agent, maxSeq);
	for (const { seq, futures, snippet } of hits) ctx.logger.warn(`[MBSF] 日期校验: assistant 输出含未来日期 ${futures.join(", ")} (seq=${seq}, 当前日期=${today})。若为计划/外部引用可忽略；否则疑似编造——写作日期一律以引擎注入的 [MBSF 日期锚] 为准。片段: ${snippet}`);
}
/** 从消息集提取「引擎注入文本」（纯函数——跨轮幂等域的最小判据）。
*
*  为什么需要它（2026-11-06）：`turnInjectedSet` 的幂等域是 **turn**（工程
*  域），不是上下文。上一轮注入的消息**仍在当前上下文里**（除非已被压缩
*  压缩）⟹ 下一轮命中同一话题会被**再供给一遍同一个位置 + 同一个 label**
*  = 同路径重复供给 = 零信息增益。判据对象 = 供给本身（`` ②：名到
*  场即供给；已到场的名不必再喊一次）。
*
*  **两个池，两件事**（与 need 判 `claimed` 而非 `footprint` 相同设计）：
*   · **特征**（`recentSurfaceMessages`）= 推理的最新增量——排除注入，
*     防「引擎读产物回流成出现」的自我强化环（need/召回输入的介质）。
*   · **上下文注入池**（本函数产物）= 仍在上下文里的引擎供给——**只用于
*     跨轮幂等**（`contextInjectedTopicIds`），不进 need/召回判定。
*
*  **压缩边界自洽**：被压缩掉的注入不在 surface 上了 ⟹ 自然不在池里 ⟹
*  该话题可再供给——「再供给」只在它真的离开上下文之后发生。
*
*  只认记忆注入（`📎 记忆`）：日期锚（`[MBSF 日期锚]`）每轮同款文本、且不
*  承载被供给的记忆位置，进池无意义。 */
/** 注入预算的默认上下文容量参照（token）——对齐引擎压缩默认（1M 窗口，
*  OpenClaw 256K→1M 演进；config.contextWindow 可覆盖）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const DEFAULT_CONTEXT_WINDOW_TOKENS = 1e6;
/** 从区间消息里提取上一次压缩 checkpoint（若已存在）。
*  闭标签缺失（slim 修复截断）时取 open 之后全部文本。 */
function extractPreviousCheckpoint(messages) {
	const pairs = [[CHECKPOINT_OPEN_TAG, CHECKPOINT_CLOSE_TAG], [LEGACY_CHECKPOINT_OPEN_TAG, LEGACY_CHECKPOINT_CLOSE_TAG]];
	for (let i = messages.length - 1; i >= 0; i--) {
		const text = extractText(messages[i]);
		for (const [openTag, closeTag] of pairs) {
			const start = text.indexOf(openTag);
			if (start < 0) continue;
			const end = text.indexOf(closeTag, start);
			const body = (end > start ? text.slice(start + openTag.length, end) : text.slice(start + openTag.length)).trim();
			return body.length > 0 ? body : void 0;
		}
	}
}
/** 未必记忆 checkpoint 起始标记（summarize 输出与跳过判定共用）。
*  （常量下沉 mbsf-core——单一来源，防判定漂移） */
/** 每轮 γ 压缩：surface 真实消息（跳过 checkpoint）达到此条数才考虑压缩。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const MIN_GAMMA_MESSAGES = 4;
/** 压缩后 tail 至少保留的真实消息条数（对齐 OpenClaw 兜底 2 条）。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const MIN_TAIL_MESSAGES = 2;
/** checkpoint 帧固定开销（标签+统计行）字符数——「=」的命名成本（：
*  识别一型），是唯一合理的固定量，不是内容比例。帧精简后：标签 27×2 +
*  统计行 ~46 + 换行 ≈ 110，取 150 保守（含正文尾部波动）。
*
*  2026-11-03 用途变更：本常量原只服务于 `MIN_SHADOW_CHARS` 的字符域反推
*  （已删——见下）。现在服务于 shrink 预演（`shrinkPreflight`）的诊断
*  日志：预演拿到帧 + 摘要的**精确** token 数，本常量只用于「帧成本占比」
*  的读数（字符域），**不参与判定**。判定是 token 域的直接比较。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const FRAME_CHARS = 150;
/** 摘要正文工程边界（**外部约束**——provider 溢出护栏，不是压缩机制）。
*
*  2026-11-03 改标注：原注「正常由 BODY_RATIO 比例控制，不撞此墙」已失效
*  （BODY_RATIO 已删）。现在是**唯一的字符边界**——见 `bodyBudget`。
*
*  性质 = **外部约束**：provider 的上下文窗口是外部给定的容量上限，不是
*  判定依据 内部产生的结构量。它进不了推导链，只作工程护栏。
* （外部约束——provider 容量护栏，非内部结构量。） */
const MAX_BODY_CHARS = 2e4;
/** 摘要正文预算（字符）——**结构机制与字符边界的交汇点**（2026-11-03）。
*
*  ⚠️ 本函数是**纯函数**，被两处共用（**必须同源，否则预演失效**）：
*    ① `summarize()` —— 真实生成摘要时的 maxChars；
*    ② `shrinkPreflight()` —— 压缩前预演 shrink 校验时的 maxChars。
*  两处若各算一套，预演通过 ≠ shrink 通过，预演就成了装饰。
*
*  为什么删掉 BODY_RATIO（原 `shadowChars × 0.4`）：
*  BODY_RATIO 是**纯工程标定 ，无明确依据**（2026-11-03 审计已撤回
*  其「背书」——6.3.2 是交替递推，与本比例无推导步）。
*  更根本的问题是**方向颠倒**：它让「字符预算」反过来决定「保留多少结构」
*  ——而结构（`GRAY_KEPT_SEGMENTS` / `FULL_KEPT_SEGMENTS` / `FOLD_BUDGET_RATIO`）
*  才是压缩机制的本体。字符只是翻译落笔的安全边界。
*
*  现状（诚实标注 🟡）：BODY_RATIO 删除后，maxChars 退化为**上界**
*  `MAX_BODY_CHARS`，实际长度由结构机制自己决定。这是**有意的方向修正**：
*  结构先定，字符只是结果。若实测发现摘要过长致 shrink 频繁失败，那是
*  **结构机制需要校准**的信号，不该靠一个无依据的比例掩盖。
*  （🟡 待实测：结构机制单独决定长度后，shrink 失败率分布。）
*
* @param shadowChars - 被压区间字符数（仅用于日志与未来可能的密度判据）。
* @returns 摘要正文字符预算。
*/
function bodyBudget(shadowChars) {
	return MAX_BODY_CHARS;
}
/** checkpoint 帧体构造——**唯一事实源**（2026-11-03 抽取）。
*
*  ⚠️ 为什么必须抽出来共用：`shrinkPreflight` 预演 shrink 校验时要用
*  **与真实路径逐字相同**的帧体。两处各写一遍 = 预演算的 token 数与真实
*  shrink 比的 token 数不同 ⟹ 预演失效（且是静默失效——预演通过但 shrink
*  仍失败，看起来像「预演没用」）。同源是预演成立的前提，不是代码整洁问题。
*
*  内容两块（2026-11-03 起）：
*    ① 摘要正文（`result.text`——deltaCompact 产物）；
*    ② 新增位置块（自适应护栏见下）。
*  原第 ③ 块「统计行（γ 压缩计数 / EMA / 耗时 / 归档数）」已撤回——那是
*  运行记录，首现处 = `compaction-log.jsonl`（测地线原则：不在帧体重复定义；
*  详见函数尾注释）。
*
*  @param result - `mbsfSummarize` 的返回值。
*  @param shadowChars - 被压区间字符数（位置块的预算依据）。
*  @returns 去掉 checkpoint 标签后的帧体（标签由调用方/官方 frameSummary 包）。
*/
function buildCheckpointBody(result, shadowChars) {
	const coordLines = [];
	if (shadowChars >= 2e3) {
		let budget = Math.max(0, Math.min(400, Math.floor(shadowChars * .05)));
		for (const c of result.newCoords) {
			const one = `  · ${c.topicId} 「${c.label}」`;
			if (one.length > budget) break;
			coordLines.push(one);
			budget -= one.length;
		}
	}
	const coordHead = result.newCoords.length > coordLines.length ? `[新增位置 ${result.newCoords.length} 个（列示前 ${coordLines.length}）]` : `[新增位置 ${result.newCoords.length} 个（本区间新建话题）]`;
	return [
		CHECKPOINT_OPEN_TAG,
		`[压缩 ${result.compressedCount} 条 | 保留 ${result.preservedCount} 条]`,
		result.text,
		...coordLines.length > 0 ? [coordHead, ...coordLines] : [],
		CHECKPOINT_CLOSE_TAG
	].join("\n");
}
/** 压缩触发诊断探针（2026-08-30 一帆「会话中间还有而且新一轮」——turn/end 后
*  压缩 0 次，静态分析全部排除后加的运行时探针；2026-09-14 删除 idle 钩子后
*  只剩 turn-stopping / user-message / 守卫链三种来源）。每次触发、守卫链每步
*  null 原因 append 一行到 ~/.mbsf/idle-probe.log——按时间过滤即可定位哪层
*  触发在干活、在哪一步被拦（2026-09-14 即用此日志统计出 turn-stopping 675 /
*  user-message 32 / idle 0）。失败静默（探针是诊断增强，不阻断主逻辑）。 */
const probeFile = join(homedir(), ".mbsf", "idle-probe.log");
/** 引擎加载标记（2026-11-09）：status 网关在宿主域、引擎在 preset 域，ctx 服务
*  互相不可见——网关靠这个文件判断「本进程到底有没有引擎」。同 pid 才算
*  本次加载；旧进程留下的标记（重启前）不算。 */
const engineStatusFile = join(homedir(), ".mbsf", "engine-status.json");
function writeEngineStatus() {
	try {
		mkdirSync(join(homedir(), ".mbsf"), { recursive: true });
		writeFileSync(engineStatusFile, JSON.stringify({
			pid: process.pid,
			startedAt: (/* @__PURE__ */ new Date()).toISOString(),
			node: process.version
		}, null, 2));
	} catch {}
}
/** 探针日志轮转上限（E.202 §2——原实现无上限，实测已 7.6 MB 且只增不减）。
*  超过则重命名为 `.1`（覆盖上一份）并重新开始； 工程护栏，可再校准。 */
const PROBE_LOG_MAX_BYTES = 5 * 1024 * 1024;
/** 轮转检查间隔（2026-09-29 修复）：原 `_probeRotated` 是**进程级一次性标志**——
*  只在进程首次调用时查一次大小，长跑进程此后永不复查（实测：今晨启动时
*  4.4 MB < 5 MB 阈值 → 不轮转 → 之后涨过 6 MB 也不轮转）。改为**时间驱动**：
*  首次必查（保住原语义），此后每 5 分钟复查一次——长跑进程也能轮转，
*  且 statSync 频率可忽略。 工程护栏，可再校准。 */
const PROBE_ROTATE_CHECK_MS = 300 * 1e3;
let _probeLastRotateCheck = 0;
/**
* 包裹会话投影注册表的 `hydrate`，把**失败时的完整堆栈**写进探针日志。
*
* 背景（2026-11-13）：宿主的 `preparedProjections` 用
* `new SessionQueryError(..., { cause })` 包住投影错误，GUI 只显示
* `failed to project session "...": Cannot read properties of undefined
* (reading 'kind')`——`cause.stack` 丢失，无法判定 30 个投影里哪一个崩。
* 本函数只在抛错路径写日志，正常路径零副作用；同进程幂等。
*
* @param ctx - 插件上下文（用于取 `sessionProjections` 服务）。
*/
function installProjectionDiag(ctx) {
	try {
		const registry = ctx.get("sessionProjections");
		if (registry === void 0 || typeof registry.hydrate !== "function") return;
		if (registry.__mbsfDiagWrapped === true) return;
		const original = registry.hydrate.bind(registry);
		registry.hydrate = (...args) => {
			try {
				return original(...args);
			} catch (error) {
				const cause = error?.cause;
				probeIdle(`projection hydrate 失败\n${error?.stack ?? String(error)}\n--- cause ---\n${cause?.stack ?? String(cause ?? "")}`);
				throw error;
			}
		};
		registry.__mbsfDiagWrapped = true;
	} catch {}
}
function probeIdle(line) {
	try {
		const now = Date.now();
		if (now - _probeLastRotateCheck >= PROBE_ROTATE_CHECK_MS) {
			_probeLastRotateCheck = now;
			try {
				if (statSync(probeFile).size > PROBE_LOG_MAX_BYTES) {
					renameSync(probeFile, `${probeFile}.1`);
					writeFileSync(probeFile, "");
				}
			} catch {}
		}
		appendFileSync(probeFile, `${(/* @__PURE__ */ new Date()).toISOString()} ${line}\n`);
	} catch {}
}
/** `guard: pre-step 非 force 调用` 的日志节流（2026-09-29 修复）。
*  该分支是**基类 hook 每步都调**的常规跳过路径——不是异常，却占实测日志
*  92%（今日 653 条里 600 条；全量 44296 行里 26234 行 = 59%），把真正有
*  诊断价值的行（turn-stopping / 通过全部守卫 / 守卫拦截原因）淹掉。
*  节流口径与「引擎实例」相同：前 3 次 + 每 200 次留痕（末行编号 = 总量，
*  事后仍可核步数）。 工程护栏，可再校准。 */
let _preStepSkipCount = 0;
function probePreStepSkip() {
	_preStepSkipCount += 1;
	if (_preStepSkipCount <= 3 || _preStepSkipCount % 200 === 0) probeIdle(`guard: pre-step 非 force 调用 — γ 压缩挂结构闭合边界（第 ${_preStepSkipCount} 次）`);
}
/** shrink 校验预演——把「做了再后悔」改成「认清了再做」（2026-11-03）。
*
*  ## 为什么删 MIN_SHADOW_CHARS 换成这个
*
*  `MIN_SHADOW_CHARS` 原注释自己承认「口径错位」：官方 shrink 校验
*  （`compaction-basic/src/region.ts:401-406`）比的是 **token**
*  （`estimateMessage(帧+摘要) >= Σ node.tokens` 即抛错），而它算的是
*  **字符**不等式。**字符域反推得不到 token 域阈值**——它是个歪打正着的
*  保守下限，不是判据。
*
*  更根本的问题：原架构是「先压，压完被 shrink 校验打回」。此时
*  `summarize()` 已经跑完，**副作用已经落地**（归档 append、omega 更新、
*  索引 flush），然后整次压缩被丢弃。**做了再后悔。**
*
*  本函数把判定挪到它本该在的位置：**认清了再做**。
*
*  ## 为什么能做到「精确」而非估算
*
*  shrink 校验的两边与这里的预演**完全同源**：
*    · 被压区间 = `Σ measure().nodes[i].tokens`（`region.js:560` 的
*      `shadowedRouteTokenCount`）—— 这是 **route 价**，**不是**
*      `heuristicTokens`。⚠️ 二者在多模态下**不相等**：
*      `route-pricing.ts:47-70` 对含图片/文件的节点先扣结构价、再加路由
*      视觉价/文件投影价；**仅在「无图片且无文件」时**才回落
*      `tokens = heuristicTokens`（`route-pricing.ts:44-52`）。
*      ⟹ 本处**必须**取 `node.tokens`（route 价）才与 shrink 同侧；
*      取 `heuristicTokens` 在多模态会话下会低估被压区间。
*      （另注：`region.js:559` 的 `shadowedTokenCount` 用的是
*      `heuristicTokens`——它只进日志/返回值，**不参与 shrink 判定**，
*      自校准不可拿它当参照。）
*    · 摘要帧   = `estimateMessage(frameSummary([...]))`（`region.js:571`）。
*      **帧侧不需要 route 价，因为它恒为 text-only**：
*      `summarizer.ts:117` 做 text-only summary projection，
*      `region.ts:397-400` 官方注释明说「The checkpoint is text-only, so
*      its fixed-heuristic price IS its route price」⟹ 帧侧
*      heuristic 价 = route 价，本处用 `estimateMessage` 即正确。
*      ⚠️ 注意这个前提的**真实边界**：不是「会话里没有图片/文件」，
*      而是「**checkpoint 帧本身永远 text-only**」——即使会话全是图片，
*      帧仍是纯文本。若某天官方让摘要带非文本块，此处即失准。
*  两边同一个 `ctx.tokenMeter` ⟹ 预演通过则 shrink 必通过。
*  **唯一前提**：预演用的摘要正文与真实 `summarize()` 产出相同——
*  故本函数把 `summary` 一并返回，真实路径复用，不重算。
*
*  ## 副作用说明（为什么可以直接跑 mbsfSummarize）
*
*  `mbsfSummarize` 的副作用全部**幂等且无破坏性**：
*    · `archiveShadowedFrame` —— 只 `append`（去重靠 `_archiveSeen`），不删原文；
*    · `updateSessionOmega`   —— 覆盖式更新会话态；
*    · `flushMemoryIndex`     —— 幂等落盘。
*  预演被拦下时摘要丢弃，这些副作用留下的是**等价于「多归档一次」**的结果
*  （append-only，无信息损失）。代价 = 一次纯计算，已有 `elapsedMs` 可测。
*
* @param messages - 被压区间消息（已含前序 checkpoint）。
* @param sessionKey - 会话键（`normalizeSessionKey` 结果）。
* @param previousSummary - 前序摘要（压缩进帧头）。
* @param spanTokens - 被压区间 route token 数（调用方从 `measure().nodes` 取）。
* @param agent - 会话所有者（归档归属用）。
* @param meter - token 计量（与官方 shrink 同一个 `ctx.tokenMeter`）。
* @returns 预演结果；调用方按 `framedTokens < spanTokens` 判定。
*/
function shrinkPreflight(messages, sessionKey, previousSummary, spanTokens, agent, meter, tailMessages) {
	const shadowChars = messages.reduce((total, message) => total + extractCompactableText(message).length, 0);
	const summarized = mbsfSummarize([...messages], {
		sessionKey,
		maxChars: bodyBudget(shadowChars),
		wholeRegion: true,
		tailMessages,
		...previousSummary === void 0 ? {} : { previousSummary },
		...agent === void 0 ? {} : { agent }
	});
	const text = buildCheckpointBody(summarized, shadowChars);
	const framed = createUserMessage({
		content: [
			{
				type: "text",
				text: `${OFFICIAL_CHECKPOINT_PREAMBLE}\n\n${OFFICIAL_SUMMARY_OPEN_TAG}`
			},
			{
				type: "text",
				text
			},
			{
				type: "text",
				text: OFFICIAL_SUMMARY_CLOSE_TAG
			}
		],
		source: { kind: "compact-checkpoint" }
	});
	return {
		framedTokens: meter.estimateMessage(framed),
		spanTokens,
		summary: text,
		summarized
	};
}
/** 官方 checkpoint 帧常量——**逐字复刻**（2026-11-03）。
*
*  来源：`@deepseek-ai/dsh-compaction-basic/src/summarizer.ts:21-22, 69-72`。
*  用途：`shrinkPreflight` 构造与官方 `frameSummary` 完全同形的帧，
*  使预演的 `estimateMessage` 结果 = 官方 shrink 校验比较的那个数。
*
*  ## 判据独立性（2026-11-03 一帆「判据必须独立」固化）
*
*  **这三个常量是「平台事实的快照」，不是「我们的判据」。** 判据 = 官方
*  自己的行为（见 `notePreflightDisagreement`）——预演通过而官方拦下 ⟹
*  当场告警。故此处复刻**漂了也不会静默**，它只是让预演在正常情况下
*  精确，漂移时由行为判据兜底。
*
*  基线快照见 `src/official-checkpoint-baseline.json`（带 dsh 版本戳）——
*  启动时比对，不匹配打告警（`checkOfficialBaseline`）。两层保护：
*    · 基线比对 = **事前**提示「平台变了，去核对」（可能早于实际影响）；
*    · 行为判据 = **事中**确认「预演真的失准了」（零假阳性）。
*
*  ⚠️ 升级 DSH 后核对命令（**不要指向外部 checkout**——用实际加载的包）：
*  `node -e "const p=require.resolve('@deepseek-ai/dsh-compaction-basic/package.json');const d=require('path').dirname(p);console.log(d);console.log(require(p).version)"`
*  然后 `grep -n 'CHECKPOINT_PREAMBLE =\|SUMMARY_OPEN_TAG =\|SUMMARY_CLOSE_TAG =' <d>/lib/index.js`
*/
const OFFICIAL_SUMMARY_OPEN_TAG = "<compacted-summary>";
const OFFICIAL_SUMMARY_CLOSE_TAG = "</compacted-summary>";
const OFFICIAL_CHECKPOINT_PREAMBLE = "This is an automatically generated checkpoint condensing an earlier span of the conversation to free up context. Treat the captured context as established background and build on it without restating it. Continue the task directly from the messages that follow, without acknowledging this checkpoint.";
/** 预演失准的累计计数（进程级——用于「是否只是偶发」的判断）。 */
let _preflightDisagreeCount = 0;
/** 预演相同次数（对照用——相同/不匹配比例能判断「偶发」与「系统性漂移」）。 */
let _preflightAgreeCount = 0;
/** 预演通过 ⟹ 官方 shrink 也通过：相同（正常路径，静默计数）。 */
function notePreflightAgreement() {
	_preflightAgreeCount += 1;
}
/** 预演通过 ⟹ 官方 shrink **却失败**：预演失准（判据被推翻，必须可闻）。
*
*  **为什么这是零假阳性判据**：预演跑的是与官方完全同源的计价（同一个
*  `ctx.tokenMeter`、同一份摘要正文——真实路径复用预演产物）。在这种同源
* 下预演说「能过」而官方说「过不了」，只可能是**复刻的平台事实漂了**
*  （常量变了 / 帧结构变了 / 计价口径变了），或区间在预演与校验之间被
*  改动。两种都必须立刻知道。
*
*  **为什么必须打日志而不只是计数**：这条一旦触发，此后每次压缩都可能
*  白跑（预演放行 → summarize 跑完 → 官方拦下 → 整次丢弃，副作用已落地）。
*  静默 = 用户只看到「压缩不生效」而不知道为什么。
*
*  @param error - 官方抛出的错误（用于提取两侧数值做对比）。
*/
function notePreflightDisagreement(error) {
	_preflightDisagreeCount += 1;
	const message = error instanceof Error ? error.message : String(error);
	const shrinkMatch = /summary is not smaller than the shadowed content \((\d+) estimated framed tokens >= (\d+)\)/.exec(message);
	if (shrinkMatch === null) {
		probeIdle(`预演对照: 官方失败但非 shrink 校验（${message.slice(0, 120)}）——不计失准`);
		return;
	}
	const officialFramed = Number(shrinkMatch[1]);
	const officialSpan = Number(shrinkMatch[2]);
	probeIdle(`⚠️ 预演失准（第 ${_preflightDisagreeCount} 次，相同 ${_preflightAgreeCount} 次）: 预演判「能过」但官方 shrink 拦下——官方帧 ${officialFramed} >= 区间 ${officialSpan}。⟹ 复刻的平台事实已漂（常量/帧结构/计价口径），或区间被改动。核对 official-checkpoint-baseline.json 与官方 lib/index.js。`);
}
/** 官方基线比对（方案 A——**事前**提示，可能误报）。
*
*  **诚实边界（重要）**：基线自己会过期——我们没跟版 ⟹ 基线还是旧的 ⟹
*  比对说「相同」但实际已漂。故它是**辅助哨**不是判据——真正的判据是
*  `notePreflightDisagreement`（官方行为）。这里绝不阻塞压缩，只写探针。
*
*  **为什么基线内联在代码里而不是读 json**：`tsc` 只编译 `src/*.ts`、
*  `tsdown` 只打包 js 入口 ⟹ `src/*.json` **不会进产物**，运行时用
*  `import.meta.url` 相对路径读不到。json 文件（`official-checkpoint-
*  baseline.json`）保留作**人类可读的快照记录**；比对用代码内联常量——
*  两边不匹配本身就是「有人改了常量却没同步另一处」的真信号。
*
*  只跑一次（进程级），失败静默（诊断增强不阻断主路径）。
*/
let _baselineChecked = false;
function checkOfficialBaseline() {
	if (_baselineChecked) return;
	_baselineChecked = true;
	try {
		const baseline = {
			dshPackageVersion: "0.2.2-rc.1",
			summaryOpenTag: "<compacted-summary>",
			summaryCloseTag: "</compacted-summary>",
			checkpointPreamble: OFFICIAL_CHECKPOINT_PREAMBLE
		};
		const diffs = [];
		if (baseline.summaryOpenTag !== OFFICIAL_SUMMARY_OPEN_TAG) diffs.push("summaryOpenTag");
		if (baseline.summaryCloseTag !== OFFICIAL_SUMMARY_CLOSE_TAG) diffs.push("summaryCloseTag");
		if (baseline.checkpointPreamble !== OFFICIAL_CHECKPOINT_PREAMBLE) diffs.push("checkpointPreamble");
		if (diffs.length > 0) probeIdle(`⚠️ 官方基线记录与代码复刻不相同（${diffs.join(", ")}）——二者必有一个旧，须核对`);
		else probeIdle(`官方基线记录相同（核对时版本 ${baseline.dshPackageVersion}）`);
	} catch (error) {
		probeIdle(`官方基线比对不可用（${error instanceof Error ? error.message : String(error)}）——不影响预演`);
	}
}
startLoopWatchdog();
//#endregion
export { AUTO_RECLAIM_PCT_DEFAULT, AUTO_RECLAIM_PCT_MAX, AUTO_RECLAIM_PCT_MIN, COMPACT_TAIL_MESSAGES_MAX, COMPACT_TAIL_MESSAGES_MIN, DSH_HEAP_DEFAULT_MB, DSH_HEAP_MIN_MB, DSH_HEAP_RESERVE_MB, INJECT_PREFIX, MbsfCompactionEngine, MbsfCompactionEngine as default, SESSION_RESET_MIN_TURNS, catalogProbeReport, clampTailMessages, clearDerivedCaches, clearResetRequest, ensureHeapSnapshotDir, foldHistory, getRuntimeConfig, heapSnapshotDir, idleSnapshot, isIdle, isInjectSource, lastSummarizeStats, latencyStats, loadRuntimeConfig, maybeScheduleRestart, mbsfStats, normalizeDshHeapMb, readResetRequest, resetRequestPath, resetRunnerPath, resolveDshHeapMaxMb, setRuntimeConfig, verifierProbeReport, withDshHeapFlags };
