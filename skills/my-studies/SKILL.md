---
name: my-studies
description: Browse and check on Tangible studies (read-only). Use when the user wants to see what studies they have, what's running, where a study is at, how many responses are in, or what they've spent — "show me my studies", "what's running", "how's the pricing test doing", "did results come in yet", "what have we spent on Tangible". Lists studies by title with plain-English status, reports a single study's progress, and (for owners) shows billing. Not for creating, editing, launching, or reading response content — it points you to the right skill for those.
---

# Browse Tangible studies (what's running / status / spend)

This is the read-only "let me look" skill. Use it to list a workspace's studies, check where one is at, and — for workspace owners — see spend. It never changes anything; for actions it points at `create-rapid-study` / `update-rapid-study` / `analyze-rapid-study`.

## When this skill applies

- "What studies do I have?" / "show me my studies" / "list my Tangible studies".
- "What's running / still collecting?" / "which ones are done?"
- "Where's the pricing test at?" / "did responses come in yet?" / "how many responses so far?"
- "What have we spent on Tangible?" (workspace owner only.)

For **creating** use `create-rapid-study`; for **editing** use `update-rapid-study`; for **reading what a study found** (verdict, themes, quotes) use `analyze-rapid-study`. This skill reports status + spend, not findings.

## Tone rules

Same as the other skills:

- **Plain English, no backend jargon.** Never say internal identifiers, "projectId", "status: published", raw status codes, or expose a 24-character id. Refer to every study by its **title**.
- **Translate status** into what it means for the user (see the map below) — don't show the raw value.
- **Summarize, don't dump.** For a list, a tidy set of lines (title + status + a number where it helps). Don't paste raw tool JSON or every response.

## Status → plain English

`tangible_list_projects` and `tangible_study_status` return a raw `status`. Translate:

| Raw `status` | Say |
|---|---|
| `creating` | "drafting" (Tangible's agents are still writing it) |
| `draft` | "ready to review / launch" |
| `published` | "collecting responses" |
| `closed` | "finished" |

## Steps

### Step 1 — Resolve the workspace (silently if you can)

Call `tangible_list_workspaces`.

- **Exactly one** → use it without asking.
- **Two or more** → ask once via `AskUserQuestion` (one option per workspace, label = name), then carry that choice for the rest of the chat. Never call it an "ID".
- **None** → the user has no workspace yet; point them at the `connect` skill to set one up. Stop.

### Step 2 — List the studies

Call `tangible_list_projects(workspaceId)` → `[{ id, title, status, updatedAt }]`.

- Show each study by **title** with its translated status, most-recently-updated first.
- If nothing comes back: "You don't have any studies in **{workspace}** yet — want to create one?" (→ `create-rapid-study`).
- If the list is long, show the ~20 most recent and say there are more.

### Step 3 — "What's running" / filter

When the user asks what's active, highlight the **collecting responses** ones and note recruiting usually takes 24–72 hours. When they ask what's done, list the **finished** ones. Use the status map — don't invent categories.

### Step 4 — Drill into one study

When the user asks about a specific study ("where's the pricing test at?"), find it by title from Step 2 and call `tangible_study_status(studyId)` → `{ status, responseCount, lastResponseAt }`.

- Report it in plain English: what stage it's at, how many responses are in, and when the last one landed if useful — e.g. *"**Pricing test** is collecting responses — 34 in so far, most recent about an hour ago."*
- If it's still `creating`/`draft`, say it hasn't launched yet (nothing to count).

### Step 5 — Spend (owner only)

When the user asks about cost/spend, call `tangible_rapid_list_transactions(workspaceId)` and summarize the transactions in plain English (what each was for + amount + roughly when).

- On a billing-permission error: "Only the workspace owner can see billing — you'd need to ask them, or check in a workspace you own." Don't surface an error.

### Step 6 — Point forward

Offer the natural next step: create another study (`create-rapid-study`), edit one (`update-rapid-study`), or — if a study has results — read what it found (`analyze-rapid-study`).

## Failure modes (translate before showing the user)

| Situation | What to say | What to do |
|---|---|---|
| No workspace | "You're set up, but there's no workspace yet — let me help you create one." | Point at the `connect` skill; stop. |
| Empty study list | "No studies in **{workspace}** yet — want to create one?" | Offer `create-rapid-study`. |
| User doesn't have billing access | "Only the workspace owner can see billing." | Drop the spend request; keep going with the rest. |
| No access to this study | "That study isn't in this workspace, or you don't have access." | Skip it; suggest the right workspace. |
| Connection dropped | "The Tangible connection looks like it dropped — let me reconnect you." | Run the `connect` skill, then resume. |

## What this skill does NOT do

- **Create, edit, or launch studies** — use `create-rapid-study` / `update-rapid-study`; launches happen in the Tangible UI.
- **Read response content / findings** — verdict, themes, and quotes are `analyze-rapid-study`. This skill reports status and spend only.
- **Cross-workspace views** — it lists within one workspace at a time; there's no "all my studies everywhere".
- **Expose IDs or backend fields** — everything is by title and plain-English status.
