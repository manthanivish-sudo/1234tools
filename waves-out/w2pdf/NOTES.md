# Wave 2 (PDF) — notes

Branch `wave/w2pdf-2026-10-06`, from `main` a90208e9d. Work in progress: this
file is rewritten as each item lands. Run on the owner's Windows machine in a
local worktree (not the cloud); Chrome at the default path; ports 8850–8869.

## Status (in progress)

- A. PDF-to-images Save buttons: fixed, tested (pdf-fixes 11a).
- B. Shell v2: worker, progress + Cancel, page grids, file drag, per-file
  pages, placement drag/resize, live preview, guards, names, settings
  memory: written and browser-tested (pdf-fixes group 11). Password prompt:
  wired; browser test pending.
- Security handler: own implementation (see Decisions).
- C, D, drop 2: in progress.

## Baseline at a90208e9d (before any change)

test_pdfcore 305/305, test_pdftools 869/869 (not 7 failures as the brief
says: 0 on this machine), pdf-fixes 120/120, claims --only pdf 196/196
(17 manual), content/_check --only pdf 0 errors.
