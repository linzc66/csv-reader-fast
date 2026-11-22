# csv-reader-fast

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/linzc66/csv-reader-fast/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/linzc66/csv-reader-fast/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in replacement for csv-reader 1.0.0: it returns csv-reader's exact `{columns, rows, errors}` for every input, verified byte-identical on the practice set and 25,000+ edge cases, and runs about 8x faster than the reference parser on the same machine (about 2x faster end-to-end including JSON I/O). The reference reads one character at a time and appends a character at a time; this reads by slices instead — an unquoted field is one slice up to the next delimiter, a quoted field one slice up to its closing quote, with doubled quotes and line breaks inside quotes collapsed by joining the few segments between them.

## Run it

```sh
node main.ts
```

The harness runs it as `node main.ts` with `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` set: it reads `/input/cases.json`, answers each case with `run()` from `solve.js`, and writes `/output/answers.json`.

## Verification (local, Node 24 on this machine)

- Kit `grade-local` on the practice set: **6/6 cases pass**, deterministic (regrade reproduced byte for byte).
- Edge-case + fuzz battery vs the real csv-reader 1.0.0: **25,123 checks pass, 0 fail** (123 hand-written edge cases covering BOM, CRLF, lone CRs, unterminated quotes, quote junk, short/long rows, header/no-header, non-ASCII, 100k-char fields; 20,000 random fuzz inputs; 5,000 structured random records).
- Speed on the practice set (6 cases, ~10.2M chars), CPU time of `run()` only, median: **~84,000 µs vs ~712,000 µs for the reference** — about 8.5x. Full `main.ts` run including JSON parse/stringify: **~820,000 µs vs ~1,730,000 µs** — about 2.1x. Local numbers are comparable only against a baseline measured on the same machine, never against a `cpu_us` on the board.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
