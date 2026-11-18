# Structure Is Semantics — MBSF Compression Engine

Local context compaction. Strips redundancy, no model, sub-100ms.

- Zero third-party runtime dependencies (engine inlined; the only dependency is the host DSH)
- Language-agnostic — decided by structure, not by language
- Model-agnostic — zero LLM calls, zero token cost
- Unnoticeable — done in a blink; conversation flows on without a seam

## Requirements

- **Node.js ≥ 22** (ESM, build target es2024)
- **Platform**: macOS / Linux / Windows all work (paths use `~/.dsh` and `~/.mbsf`; no platform-specific deps)
- **Host**: **DeepSeek Harness (DSH) 0.2.x** (verified on 0.2.2) — a DSH plugin that takes over session compaction

## Install

### From npm (recommended)

1. Click **Plugins** in the left sidebar
2. Click **+ Add plugin** at the top right
3. Enter the package name **`mbsf-compaction`**
4. Click **Install**, then restart DSH

After restart, compaction switches from "LLM summary" to "recognize repetition" (other presets unaffected).

### Offline (tgz)

For air-gapped machines or pinning a specific version, paste the absolute path of `mbsf-compaction-x.y.z.tgz` into the same field. The tarball is byte-identical to the npm release of the same version (contents bounded by the `files` field).

### From source / GitHub

A repository URL works in the same field. Restart DSH afterwards.

## About DSH upgrades

The engine takes over DSH's built-in compaction group through the wiring layer. **DSH upgrades may change the built-in preset** — an older engine may not automatically adapt to a newer DSH. If compaction misbehaves after installing (never triggers / errors), that is likely the cause.

**DSH upgrades generally do not affect the engine.** If compaction misbehaves after a DSH upgrade, update to the latest engine version, or pause until a compatible release lands. The version is visible under **Installed plugins** in the Plugins page.

## Session history trimming

**Not merely a cleanup tool — the supporting infrastructure for long conversations.**

How long a session runs depends on how big its history file gets. After thousands of turns, the session file can grow to gigabytes — beyond what DSH's 4 GB memory budget can hold. Light impact: stutter. Heavy impact: the process gets killed.

Trimming is built for that case: cut old session history on demand (recoverable within 30 days), freeing memory so the current session keeps going.

**Note**: talking for thousands of turns is a structural effect of semantic continuity, not of persistent memory. Most conversations start drifting after a hundred-odd turns, gradually forgetting what was said at the very beginning. Persistent memory is not solved in this version. Trimming only lets an already-long session continue — semantic compaction keeps the conversation long *without* falling apart, and that is what this engine really does.

## File structure

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

## License & contributing

**Apache-2.0** — full terms in [`LICENSE`](LICENSE). Trademarks ("未必科幻 / MBSF / MAYBE SCI-FI") are not licensed with the code; see [`TRADEMARK.md`](TRADEMARK.md).

**No PRs** — issues only. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## 中文

Chinese documentation: [`README.md`](README.md).
