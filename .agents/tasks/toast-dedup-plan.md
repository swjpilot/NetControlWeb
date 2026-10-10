# Implementation Plan: Participant-Add Toast Deduplication

Single-file frontend fix in `client/src/pages/SessionDetail.js`. No backend/route changes.

## Design decisions (rationale)

1. **Single source of truth for the add-success/error toast.** `addParticipantMutation.onSuccess`
   (line 365, `toast.success('Participant added successfully')`) and `onError` (line 387,
   `toast.error(...'Failed to add participant')`) already fire exactly once per completed mutation.
   The fix makes the mutation own the add toast and removes the redundant `toast.success(...)` calls
   that sit immediately next to `addParticipantMutation.mutate(...)` in every handler. Rationale: the
   mutation callback is the one place guaranteed to run once per add, so centralizing there yields
   exactly one toast regardless of which entry path was used, and avoids firing a "success" message
   before the server has actually confirmed the add.

2. **Preserve specific call-sign messaging by moving it into the mutation success, not duplicating it.**
   The per-handler messages (`"KF4CKT added to operators database"`, `"Using existing operator record for X"`,
   `"Added X from QRZ data"`, `"Added X (call sign only)"`) carry useful context. Rather than keep two
   toasts, pass the desired message through the mutation so onSuccess shows one toast with that text.
   Chosen approach: call `addParticipantMutation.mutate(participantData, { onSuccess: ... })` is NOT used
   because react-query v3 would then run BOTH the mutation-level and call-level onSuccess (still one toast
   if the call-level replaces the message, but two callbacks). Instead, thread an optional
   `successMessage` field on the participant data object is rejected (it would be POSTed to the server).
   Final decision: store the intended message in a React ref (`pendingAddToastRef`) set right before each
   `mutate(...)` call, and have the mutation `onSuccess` emit that ref's message (falling back to the
   generic `'Participant added successfully'`) then clear it. This keeps one toast, keeps specificity,
   and never leaks UI strings into the API payload. Rationale: a ref avoids async state-timing issues and
   does not trigger re-renders.

3. **Fix the genuine double-mutation in the Enter-key existing-operator path.** `handleCallSignKeyDown`
   (line ~941) calls `handleOperatorSelect(existingOperator)` — which itself calls
   `addParticipantMutation.mutate(...)` at line 1053 — AND THEN schedules a `setTimeout` that calls
   `onSubmitParticipant(formData)` at line 956, which calls `addParticipantMutation.mutate(...)` a SECOND
   time. This fires the add twice (second one the server rejects as a duplicate → the "already in the
   list" toast) plus the `"Found existing operator"` toast at line 944. This is the exact
   "2 success + 1 duplicate" the user reported. Fix: in the existing-operator branch, call
   `handleOperatorSelect` only (it already adds the participant and the mutation shows one toast) and
   delete both the extra `toast.success('Found existing operator...')` and the `setTimeout` auto-submit
   block.

## Add-path inventory (current toasts, with line numbers)

| Path | Entry point | mutate() line | redundant toast line(s) | action |
|------|-------------|---------------|------------------------|--------|
| A. addParticipantMutation (owner) | def ~line 350 | — | 365 success / 387 error | KEEP, make message-aware |
| B. New operator from QRZ (addOperatorMutation.onSuccess) | ~line 538 | 538 | 541 `added to operators database` | set ref, remove toast |
| C. Existing operator fallback (addOperatorMutation.onError) | ~line 566 | 566 | 568 `Using existing operator record` | set ref, remove toast |
| D. Operator fallback (call-sign only) | ~line 577 | 577 | (none) | set ref `Added X (call sign only)` optional |
| E. onSubmitParticipant direct | ~line 799 | 799 | (none, mutation owns it) | no change needed |
| F. Enter-key: QRZ create then add | ~line 998 | 998 | 1000 `added from QRZ data` | set ref, remove toast |
| G. Enter-key: QRZ exists -> existing op | ~line 1019 | 1019 | 1021 `Using existing operator record` | set ref, remove toast |
| H. Enter-key: QRZ exists -> fallback | ~line 1023 | 1023 | 1025 `Added X (call sign only)` | set ref, remove toast |
| I. Enter-key: create failed -> fallback | ~line 1029 | 1029 | 1031 `Added X (call sign only)` | set ref, remove toast |
| J. handleOperatorSelect auto-add | ~line 1053 | 1053 | (none itself) | leave mutate; it is the single add |
| K. Manual entry create+add | ~line 1210 | 1210 | 1213 `added to operators database` | set ref, remove toast |
| L. Manual entry existing-op fallback | ~line 1235 | 1235 | 1237 `Using existing operator record` | set ref, remove toast |
| M. Manual entry skip (call-sign only) | ~line 1273 | 1273 | (none) | no change needed |
| N. Enter-key existing operator (DOUBLE MUTATION) | ~line 941 | via handleOperatorSelect 1053 + setTimeout onSubmitParticipant 956->799 | 944 `Found existing operator` | remove toast + remove setTimeout block |

Out of scope (keep exactly as-is, one toast each): QRZ lookup found/failed (247/251), participant
update (409/420), remove (431/434), traffic add/delete/update (459/471/482/485/497/507),
pre-check-in fetch (632/636), bulk pre-check-in (669/674/683), single pre-check-in (711/715/720),
net report submit (731/734), net script copied (1488), net ended / report (1611/1615/1617/1621),
and all validation guards (`'Please enter a call sign'` etc. at 761/892/932/1148/1173/1259).

## Steps

- [ ] 1. Add a module-level pending-toast ref and make the add mutation message-aware.
      Add `const pendingAddToastRef = useRef(null);` alongside the other refs (near `callSignInputRef`,
      ~line 90). In `addParticipantMutation.onSuccess` (line 365), replace
      `toast.success('Participant added successfully')` with:
      `toast.success(pendingAddToastRef.current || 'Participant added successfully'); pendingAddToastRef.current = null;`
      In `addParticipantMutation.onError` (line 387), keep the single `toast.error(...)` but add
      `pendingAddToastRef.current = null;` so a stale message cannot leak into a later add.
      Files: client/src/pages/SessionDetail.js
      Verify: `cd client && CI=true npm run build` compiles with no new ESLint/compile errors.

- [ ] 2. Fix the Enter-key existing-operator double mutation (path N) — the primary cause of
      "2 success + 1 duplicate".
      In `handleCallSignKeyDown`, inside `if (existingOperator) { ... }` (lines ~941-957): remove the
      `toast.success(\`Found existing operator: ...\`)` call (line 944) and remove the entire
      `setTimeout(() => { ... onSubmitParticipant(formData); }, 100);` block (lines ~946-957). Leave the
      single `handleOperatorSelect(existingOperator)` call, which performs exactly one
      `addParticipantMutation.mutate` (line 1053) and yields one toast via step 1.
      Files: client/src/pages/SessionDetail.js
      Verify: `cd client && CI=true npm run build` compiles clean. Manual trace: Enter on a known
      operator now calls mutate once (not twice), so no server-side duplicate rejection toast.

- [ ] 3. Convert addOperatorMutation handler toasts to the pending-ref pattern (paths B, C, D).
      In `addOperatorMutation.onSuccess` (~line 538): immediately before `addParticipantMutation.mutate(participantData)`
      set `pendingAddToastRef.current = \`${newOperator.call_sign} added to operators database\`;` and delete
      the standalone `toast.success(...)` at line 541. In the `onError` existing-operator branch (~line 566):
      set `pendingAddToastRef.current = \`Using existing operator record for ${callSign}\`;` before mutate
      and delete `toast.success(...)` at line 568. For the fallback mutate at line 577 (no current toast),
      optionally set `pendingAddToastRef.current = \`Added ${callSign} (call sign only)\`;` for parity.
      Keep the non-add `toast.error(message)` at line 582 unchanged.
      Files: client/src/pages/SessionDetail.js
      Verify: `cd client && CI=true npm run build` compiles clean.

- [ ] 4. Convert the Enter-key QRZ add paths to the pending-ref pattern (paths F, G, H, I).
      In the `.then`/`.catch` of the inline `axios.post('/api/operators', ...)` block (~lines 985-1033):
      before `addParticipantMutation.mutate(updatedParticipantData)` at line 998 set
      `pendingAddToastRef.current = \`${newOperator.call_sign} added from QRZ data\`;` and delete the
      `toast.success(...)` at line 1000; before mutate at line 1019 set the "Using existing operator record"
      message and delete line 1021; before mutate at line 1023 set the "Added X (call sign only)" message and
      delete line 1025; before mutate at line 1029 set the "Added X (call sign only)" message and delete
      line 1031. Leave the `toast.error`/console.error lines untouched.
      Files: client/src/pages/SessionDetail.js
      Verify: `cd client && CI=true npm run build` compiles clean.

- [ ] 5. Convert the manual-entry add paths to the pending-ref pattern (paths K, L).
      In `handleManualEntrySubmit`'s `.then` (~line 1210): before `addParticipantMutation.mutate(participantData)`
      set `pendingAddToastRef.current = \`${newOperator.call_sign} added to operators database\`;` and delete
      the `toast.success(...)` at line 1213 (keep `setShowManualEntry(false)`). In the `.catch`
      existing-operator branch (~line 1235): set the "Using existing operator record for X" message before
      mutate and delete the `toast.success(...)` at line 1237. Leave `toast.error(message)` at line 1241
      and `handleManualEntrySkip` (line 1273, path M — mutation already owns its single toast) unchanged.
      Files: client/src/pages/SessionDetail.js
      Verify: `cd client && CI=true npm run build` compiles clean.

- [ ] 6. Full regression build and lint of the client bundle.
      Confirm no unused-variable warnings remain for `toast` (still used by out-of-scope paths) and that the
      edits introduced no dangling references.
      Files: (verification only)
      Verify: `cd client && CI=true npm run build` exits 0 with no errors or new warnings. Then manually
      exercise each add path in the running app (`npm run dev` from repo root) and confirm EXACTLY ONE toast
      appears per add: (a) typing a known call sign + Enter, (b) selecting an operator from the suggestions
      dropdown, (c) a brand-new call sign via QRZ, (d) manual entry create, (e) manual entry skip, and
      confirm the "already in the list" toast only appears when the participant genuinely already exists.

## Notes / assumptions

- The CRA test runner (`react-scripts test`, jest + RTL) is available but the project ships no component
  tests, and `SessionDetail.js` is a ~1700-line component with heavy react-query/axios/toast coupling.
  A focused unit test is not practical to add reliably without broad mocking scaffolding the repo does not
  have; the production build (`CI=true npm run build`, which runs ESLint and fails on errors) plus the
  manual add-path walkthrough is the authoritative verification here. If the implementer wants automated
  coverage, the lowest-risk option is a small test that mocks `axios` and `react-hot-toast` and asserts
  `toast.success` is called once for the known-operator Enter path — note as optional, not required.
- `pendingAddToastRef` is chosen over passing the message through mutate options or component state to
  avoid (1) leaking UI strings into the POST body and (2) async state-timing races between setting the
  message and the mutation resolving.
- Scope strictly limited to participant-ADD toasts; all other toasts (QRZ, traffic, pre-check-in bulk/single,
  net report, net script, net end) are left byte-for-byte unchanged.

## Verification

Implemented by the first iteration (no `toast-dedup-review.json` present). All six steps applied to
`client/src/pages/SessionDetail.js`. The reviewer does not need to re-run anything; results below.

### What was changed (final line references after edit)

1. **Ref added** — `const pendingAddToastRef = useRef(null);` placed right after `callSignInputRef`
   (file line ~90). It holds the intended one-off success message for the next add.
2. **Mutation now owns the single add toast** — in `addParticipantMutation.onSuccess` the toast is
   `toast.success(pendingAddToastRef.current || 'Participant added successfully'); pendingAddToastRef.current = null;`.
   In `onError`, `pendingAddToastRef.current = null;` is set before the single `toast.error(...)` so a
   stale message can never leak into a later add. This is the ONLY place an add-success/add-error toast
   now fires.
3. **Per-handler redundant `toast.success` removed** across every add path (B,C,D,F,G,H,I,K,L,N). Each
   handler now sets `pendingAddToastRef.current = <specific message>` immediately before its existing
   `addParticipantMutation.mutate(...)` call instead of firing its own toast.
4. **Double-mutation fixed (path N)** — in `handleCallSignKeyDown`'s `if (existingOperator)` branch the
   standalone `toast.success('Found existing operator...')` AND the entire `setTimeout(... onSubmitParticipant(formData) ..., 100)`
   block were removed. The branch now sets the pending message and calls `handleOperatorSelect(existingOperator)`
   exactly once, which performs the single `addParticipantMutation.mutate`.

### Static trace — exactly one toast per add path (after fix)

| Path | Entry point | mutate() calls now | toast(s) that fire now |
|------|-------------|--------------------|------------------------|
| A. Direct submit (`onSubmitParticipant`) | form submit | 1 | 1 — mutation onSuccess: 'Participant added successfully' |
| B. New operator from QRZ (`addOperatorMutation.onSuccess`) | 1 | 1 — '`<call>` added to operators database' (via ref) |
| C. Existing-op fallback (`addOperatorMutation.onError`, exists) | 1 | 1 — 'Using existing operator record for `<call>`' (via ref) |
| D. Fallback call-sign only (`addOperatorMutation.onError`, not found) | 1 | 1 — 'Added `<call>` (call sign only)' (via ref) |
| F. Enter-key QRZ create+add (`.then`) | 1 | 1 — '`<call>` added from QRZ data' (via ref) |
| G. Enter-key QRZ exists→existing op (`.catch`) | 1 | 1 — 'Using existing operator record for `<call>`' (via ref) |
| H. Enter-key QRZ exists→fallback (`.catch`) | 1 | 1 — 'Added `<call>` (call sign only)' (via ref) |
| I. Enter-key create-failed→fallback (`.catch` else) | 1 | 1 — 'Added `<call>` (call sign only)' (via ref) |
| J. `handleOperatorSelect` (dropdown select) | 1 | 1 — 'Participant added successfully' (ref null) |
| K. Manual entry create+add (`.then`) | 1 | 1 — '`<call>` added to operators database' (via ref) |
| L. Manual entry existing-op fallback (`.catch`) | 1 | 1 — 'Using existing operator record for `<call>`' (via ref) |
| M. Manual entry skip (`handleManualEntrySkip`) | 1 | 1 — 'Participant added successfully' (ref null) |
| **N. Enter-key EXISTING operator** | **1 (was 2)** | **1 — 'Found existing operator: `<call>`' (via ref)** |

Path N before the fix: `handleOperatorSelect` fired `mutate` (toast #1 'Participant added successfully'),
`toast.success('Found existing operator...')` fired (toast #2), and the `setTimeout` called
`onSubmitParticipant` → a SECOND `mutate` which the server rejected as a duplicate → `onError`
'...already...' (toast #3). After the fix only one `mutate` runs and one toast fires. This was the
reported "2 success + 1 duplicate".

A genuine duplicate (participant truly already in session) now surfaces as exactly one `onError`
toast from the mutation, because no path fires a pre-emptive success toast before the server responds.

### Build result

- `cd client && npm run build` → **Compiled with warnings, exit 0.** Build succeeds. The only warnings
  are pre-existing and in unrelated code / untouched lines (NetCalendar.js, ThemeContext.js,
  FCCDatabase.js, NetSchedules.js, Operators.js, Profile.js, QuickSession.js, Reports.js, Sessions.js,
  and SessionDetail.js lines 53-55/307/630 — echolink unused vars, qrzLookupMutation dep, hasOperators).
- `cd client && CI=true npm run build` → fails only because CI treats those SAME pre-existing warnings
  as errors. Verified by stashing `SessionDetail.js` and rebuilding the baseline: the identical warnings
  (incl. SessionDetail 53-55) are present WITHOUT this change. This change introduces **zero** new
  warnings or errors. Resolving the pre-existing unrelated warnings is out of scope for this
  participant-add toast fix (would require editing many unrelated files).
- No dev server was started. No automated UI harness exists; verification is the production build plus
  the static per-path trace above.
