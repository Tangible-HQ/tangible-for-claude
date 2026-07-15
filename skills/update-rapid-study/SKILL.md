---
name: update-rapid-study
description: Edit a Tangible Rapid study. When the user wants to remove, add, change, swap, rename, tighten, rephrase, replace, edit, fix, or modify anything on a study they already created — questions, concepts, messages, brand name, product / category, audience, sample size, outcome, competitors, decision context, churn parameters, market, positioning, goal, or any free-text instruction — load this skill. Routes all edits through `tangible_rapid_update_study` with a `changePrompt` so the brief, questionnaire, and launch config regenerate together. Also handles the final "launch from the UI" hand-off via `tangible_rapid_launch_study`.
---

# Edit an existing Rapid study in Tangible

Use this when the user wants to change something on a study they already created via `create-rapid-study`. Edits cascade through the same session that built the study, so the brief, audience, questionnaire, and launch config update together instead of drifting apart.

## When to use this skill

Trigger when the user asks to change something on a study that already exists, for example:

- "Rename the brand from Acme to Acme Cloud."
- "Swap concept B for a new pricing page."
- "Tighten the audience to enterprise only."
- "Replace the third message with a stronger value-prop variant."
- "Up the sample size to 200."

If the user is starting from scratch, use `create-rapid-study` instead. If they want to launch a study already in `draft` or `published`, go straight to step 7.

## Tone rules

Same as `create-rapid-study`:

- Never expose `Q_*` codes, "rapidType", "session", "long-poll", internal identifiers, or raw error codes in user-facing text.
- When the agent re-run finishes, summarize what changed in the user's words, not field names.
- Surface `warnings` from the tool to the user only after translating them — for example, "Concepts only apply to concept tests — I left them as-is" instead of quoting the raw warning text.
- If the user wants to change the audience, ask once in plain English ("Who should this be tightened to? Describe in your own words.") and pass it verbatim — never enumerate role options.

## Steps

### Step 1 — Find the study

If the user gave you a study ID, use it. Otherwise call `tangible_list_projects(workspaceId)` (workspace from `tangible_list_workspaces` — pick silently if there's only one), let the user pick by title, then call `tangible_get_projects([id])` to read the slim shape: `title`, `description`, `status`, `version`, `createdAt`, `updatedAt`, `workflow`, and a nested `questionnaire.sections[].questions[]` already sorted in display order. For concept-test sections, each fanned-out question carries a `concept: { id, name, alias }` object with an internal identifier in `alias` — read the concept name directly. When the study has any concept-test section, the response also includes `conceptGroups` (full stimuli with stable `id`s). Show a one-line summary so they can confirm what they're editing.

**Concept Test edits:** Before calling `tangible_rapid_update_study` with `concepts` (full replacement list), call `tangible_get_projects([studyId])` and copy each concept's `id` from `conceptGroups[].concepts[]`. The update tool **requires** `id` on every concept when `concepts` is passed — it will not invent keys for you. The per-question `concept.id` inside `questionnaire` is the same id but `conceptGroups[].concepts[]` is the canonical place to read the full stimuli list.

### Step 2 — Check status

- `creating` → a draft is already in flight. Tell the user to wait; offer to poll via `tangible_rapid_wait_for_study(studyId)` until terminal.
- `closed` → editing is refused. Suggest creating a fresh study via `create-rapid-study`.
- `published` → see step 5 (warn before editing).
- `draft` → free to edit.

### Step 3 — Decide what to change

Map the user's request onto the `tangible_rapid_update_study` params using their words, not field names.

**What you can change** (all studies):

| What the user says | Field |
|---|---|
| "Rename it to X" | `title` (skips the agent run — instant) |
| "Change the brand name" | `brandName` |
| "Different product / category" | `productCategory` |
| "Different decision context / buying frame" | `decisionContext` |
| "New goal / what we're trying to learn" | `goal` |
| "Bump / drop sample size to N" | `sampleSize` (20–500) |
| "Add this extra context" | `extraContext` |
| "Different audience" / "narrow to enterprise" | `audienceDescription` (always triggers a re-run) |

**Study-type-specific changes:**

- **Concept Test:** `concepts` — full replacement list of 2–5 stimuli (mix media + text types). Each item **must** include `id` from `tangible_get_projects` → `conceptGroups`. Omit `id` only when **not** passing `concepts` (prompt-only edits).
- **Message Test:** `messages` — full replacement list of 2–5 short text variants.
- **Win / Loss:** `outcome` (`won` / `lost` / `both`), `competitors` (up to 10).
- **Brand Perception:** `competitors`, `marketGeo`, `positioningStatement`.
- **Churn Diagnosis:** `businessModel`, `churnDefinition`, `churnTimeWindow`, `churnSignal`, `churnWindow`.
- **Ask a Customer:** no structured fields — it's a light, open-ended study. Edit it through the generic fields (`goal`, `audienceDescription`, `sampleSize`, `extraContext`) and describe any question changes in plain English via `changePrompt` ("add a question about pricing sensitivity", "drop the onboarding question", "make it more about the switching decision"). There are no variants, concepts, competitors, or outcome fields to pass.

**Both delivery versions stay in sync.** Every study carries a survey and an AI-interview version off the same questions. An edit re-runs the agents and regenerates both, so the interview link and the survey link stay valid and match after any change — you don't need to do anything special.

Passing a study-type-specific field against the wrong study type is harmless — the tool drops it with a warning. Surface the warning in plain English. If you're not sure what study type it is, call `tangible_get_projects([studyId])` first (use `conceptGroups` when present for concept tests), or just describe the change in `changePrompt` and let the agents handle it.

### Step 4 — Author `changePrompt` carefully

`changePrompt` is what the agents see as the next conversational turn — they use it to decide what to regenerate.

- **Required for every edit other than a pure `title` change.** Refuse to call the tool without one.
- Write a clear, complete instruction — describe what should change and the *why* if the user mentioned it.
- Examples:
  - "Rename the brand from 'Acme' to 'Acme Cloud'. Update every question that mentions Acme."
  - "Replace concept C (Pricing page v2) with a new website-type stimulus, Pricing v3 at https://example.com/pricing-v3. Regenerate the concept-test section so the new concept is evaluated alongside A and B."
  - "Tighten the audience to enterprise (1000+ employees) only. Update the screeners accordingly."
  - "Add a 5-point Likert at the end of section 2 asking whether respondents would recommend the product. Keep all other questions unchanged."

### Step 5 — Confirm before editing a published study

When `status === 'published'`:

> "This study is already collecting responses. Editing the brief or questionnaire may make in-flight responses incomparable to new ones. Are you sure you want to proceed?"

Wait for explicit confirmation. Don't silently update. After the update, in-flight responses keep their original questionnaire; new responses use the regenerated one.

### Step 6 — Call the tool

`tangible_rapid_update_study(studyId=..., ...fields, changePrompt=...)` returns:

```jsonc
{
  "projectId": "...",
  "studyUrl": "...",
  "status": "draft" | "creating",
  "agentRunTriggered": true | false,
  "changedFields": ["brandName", "concepts"],
  "warnings": [ ... ]
}
```

- `agentRunTriggered: false` (title-only) → confirm to the user and skip to step 7.
- `agentRunTriggered: true` → status will be `creating`. Call `tangible_rapid_wait_for_study(projectId)` immediately — same cadence as creation: no sleeps, server-side blocks each call. Cap at 6 calls (~5 min).
  - `terminal: true, status: "draft" | "published"` → updated; proceed to step 7.
  - `terminal: true, status: "failed"` → translate `errorReason` and stop. Offer to retry once.
  - After the cap, share `studyUrl` and tell the user the re-draft is taking unusually long.

If the tool returns `warnings`, translate them into plain-English sentences before showing — e.g. "I left concepts as-is since this is a message test, not a concept test."

### Step 7 — Hand off to launch

Once the update is terminal (or for a title-only edit), call `tangible_rapid_launch_study(studyId)`. Surface `reviewUrl` and `message` verbatim — that text is already tuned. **The launch happens in the Tangible UI.**

Optionally call `tangible_get_projects([studyId])` first if you want to confirm a quick before/after summary.

## Failure modes (translate before showing the user)

| Situation | What to say | What to do |
|---|---|---|
| No changes specified | "What did you want to change?" | Re-ask the user. |
| Concept list needs current identifiers | "I need the current concept identifiers from your study — one moment while I load them." | Call `tangible_get_projects([studyId])`, copy the concept identifiers from the response, rebuild the `concepts` list, and retry. |
| Edit needs a description | "Let me write that up properly." | Compose a clear `changePrompt` per step 4 and retry. |
| Study is mid-draft | "Your study is mid-draft. Give it a minute and I'll retry." | Poll `wait_for_study` until the draft is ready, then retry the edit. |
| Study is closed | "This study is closed and can't be edited. Want to start a fresh one?" | Offer `create-rapid-study`. |
| First draft never finished | "The first draft never finished — let me start a fresh study with the changes." | Offer `create-rapid-study` instead. |
| Audience issue | "Something's off with the audience — let me retry." | Should not appear on update; quote the reason from the tool and stop. |
| Concepts ignored for non-concept test | "I left concepts as-is — this isn't a concept test. What did you actually want changed?" | Re-ask the user. |
| Update is taking longer than expected | "Tangible's still working on the update — let me check the latest status." | Call `tangible_study_status` first; if the status is ready, deliver as success. |
| Connection dropped | "The Tangible connection looks like it dropped — let me reconnect you." | Run the `connect` skill, then resume the edit. |

## What this skill does NOT do

- **Launch responses** — launches happen in the Tangible UI. `launch_study` only returns the review URL.
- **Edit closed studies** — start a fresh one instead.
- **Per-question fine-grained surgery** — all edits route through the agents via `changePrompt`. To edit a single question, describe the change in plain English ("Rephrase Q5 to ask about pricing tolerance instead of willingness to pay; keep it a 5-point Likert.").
- **Researcher-grade edits** (custom screener logic, complex branching) — defer to the future advanced skill.
