# 结构即语义——未必科幻压缩引擎

[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-plugin-6e40c9?style=flat)](https://github.com/topics/dsh-plugin) [![DeepSeek Harness](https://img.shields.io/badge/DeepSeek-Harness-4B6EF5?style=flat)](https://github.com/topics/deepseek-harness) [![npm](https://img.shields.io/npm/v/mbsf-compaction)](https://www.npmjs.com/package/mbsf-compaction)


**中文** · [English](#english)

本地上下文压缩，清冗余，免模型，毫秒级。

- 零第三方运行时依赖（引擎内联；唯一依赖是宿主 DSH）
- 不限语言——从结构判定，语言类型无关
- 不挑模型——零 LLM 调用，零 token 消耗
- 过程无感——眨眼间完成，语义连续对话流畅

## 适用环境

- **Node.js ≥ 22**（ESM，构建目标 es2024）
- **平台**：macOS / Linux / Windows 均可（路径统一用 `~/.dsh`、`~/.mbsf`，无平台特定依赖）
- **宿主**：**DeepSeek Harness（DSH）0.2.x**（当前验证 0.2.2）——本包是 DSH 插件，装进 DSH 后接管会话压缩

## 安装

### 从 npm 安装（推荐）

1. 左侧边栏点「**插件**」
2. 右上角「**+ 添加插件**」
3. 输入包名 **`mbsf-compaction`**
4. 点「**安装**」，然后重启 DSH

装完重启 DSH，压缩方式会从「LLM 摘要」换成「认出重复」（其他 preset 不受影响）。

### 离线安装（tgz）

装在没有外网的环境、或要用某个指定版本时：把 `mbsf-compaction-x.y.z.tgz` 的本地绝对路径填进同一个输入框，效果相同。tgz 与 npm 上的同名同版本包内容一致（由 `files` 字段限定）。

### 从源码 / GitHub

仓库地址也可直接填进输入框。装完后重启 DSH 生效。

## 关于 DSH 升级

本引擎通过装配层接管 DSH 内置的压缩组。**DSH 升级后，内置 preset 可能变化**——旧版引擎未必能自动适配新版 DSH。如果装完插件压缩行为异常（不触发 / 报错），多半是版本不适配。

**DSH 升级一般不影响未必科幻引擎。** 如果升级 DSH 后压缩行为出现异常，请更新到未必科幻引擎的最新版，或暂停使用等待可以适配的新版。版本号可在插件页「已安装插件」查看。

## 会话历史剪裁

**这不仅是清理工具，更是「长对话」的配套设施。**

一个会话能跑多久，受其历史文件容量限制。对话轮次累积到几千轮时，会话文件可能膨胀到 GB 级——DSH 的 4 GB 内存预算难撑这个量，轻则卡顿，重则进程被系统杀停。

「剪裁」就是为这种场景准备的：把旧会话历史按需剪掉（30 天内可恢复），腾出内存让当前会话继续。

**注意**：能连续对话几千轮，只是语义连贯的结构性效果，不代表记忆持久。大多数对话会在百轮后开始漂移，逐渐忘记最前面说过什么。持久记忆问题不在此版本解决。剪裁只是让已经过长的会话能够继续，而语义压缩会让对话长而不散，这才是这个引擎真正在做的事。

## 文件结构

```
├── lib/
│   ├── compaction.js       # 压缩引擎（结构判定 + 摘要 + 折叠）
│   ├── client.js           # 设置页 UI（开关 / 收益 / 内存）
│   ├── status.js           # 状态网关（只读状态查询）
│   ├── index.js            # 入口（exports 的五个子路径之一）
│   └── bin/
│       └── session-reset.js  # 重启 / 会话重置 runner
├── cordis.patch.yml        # 装配层——覆盖内置 preset 的压缩组
├── README.md
├── README.en.md
├── LICENSE
├── TRADEMARK.md
└── CONTRIBUTING.md
```

## 授权与贡献

**Apache-2.0**，完整条款见 [`LICENSE`](LICENSE)。商标不随代码许可授权，见 [`TRADEMARK.md`](TRADEMARK.md)。

**不接 PR**——只收 issue。详情见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

---

## English

**Structure Is Semantics — MBSF Compression Engine**

Local context compaction. Strips redundancy, no model, sub-100ms.

- Zero third-party runtime dependencies (engine inlined; the only dependency is the host DSH)
- Language-agnostic — decided by structure, not by language
- Model-agnostic — zero LLM calls, zero token cost
- Unnoticeable — done in a blink; conversation flows on without a seam

### Requirements

- **Node.js ≥ 22** (ESM, build target es2024)
- **Platform**: macOS / Linux / Windows all work (paths use `~/.dsh` and `~/.mbsf`; no platform-specific deps)
- **Host**: **DeepSeek Harness (DSH) 0.2.x** (verified on 0.2.2) — a DSH plugin that takes over session compaction

### Install

**From npm (recommended)**

1. Click **Plugins** in the left sidebar
2. Click **+ Add plugin** at the top right
3. Enter the package name **`mbsf-compaction`**
4. Click **Install**, then restart DSH

After restart, compaction switches from "LLM summary" to "recognize repetition" (other presets unaffected).

**Offline (tgz)** — for air-gapped machines or pinning a version, paste the absolute path of `mbsf-compaction-x.y.z.tgz` into the same field. The tarball matches the npm release of the same version (contents bounded by the `files` field).

**From source / GitHub** — a repository URL works in the same field. Restart DSH afterwards.

### About DSH upgrades

The engine takes over DSH's built-in compaction group through the wiring layer. **DSH upgrades may change the built-in preset** — an older engine may not automatically adapt to a newer DSH. If compaction misbehaves after installing (never triggers / errors), that is likely the cause.

**DSH upgrades generally do not affect the engine.** If compaction misbehaves after a DSH upgrade, update to the latest engine version, or pause until a compatible release lands. The version is visible under **Installed plugins** in the Plugins page.

### Session history trimming

**Not merely a cleanup tool — the supporting infrastructure for long conversations.**

How long a session runs depends on how big its history file gets. After thousands of turns, the session file can grow to gigabytes — beyond what DSH's 4 GB memory budget can hold. Light impact: stutter. Heavy impact: the process gets killed.

Trimming is built for that case: cut old session history on demand (recoverable within 30 days), freeing memory so the current session keeps going.

**Note**: talking for thousands of turns is a structural effect of semantic continuity, not of persistent memory. Most conversations start drifting after a hundred-odd turns, gradually forgetting what was said at the very beginning. Persistent memory is not solved in this version. Trimming only lets an already-long session continue — semantic compaction keeps the conversation long *without* falling apart, and that is what this engine really does.

### File structure

```
├── lib/
│   ├── compaction.js       # compaction engine (structural decision + summary + fold)
│   ├── client.js           # settings page UI (toggle / gain / memory)
│   ├── status.js           # status gateway (read-only state queries)
│   ├── index.js            # entry (one of the five export subpaths)
│   └── bin/
│       └── session-reset.js  # restart / session-reset runner
├── cordis.patch.yml        # wiring layer — overrides the built-in preset's compaction group
├── README.md
├── README.en.md
├── LICENSE
├── TRADEMARK.md
└── CONTRIBUTING.md
```

### License & contributing

**Apache-2.0** — full terms in [`LICENSE`](LICENSE). Trademarks ("未必科幻 / MBSF / MAYBE SCI-FI") are not licensed with the code; see [`TRADEMARK.md`](TRADEMARK.md).

**No PRs** — issues only. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
