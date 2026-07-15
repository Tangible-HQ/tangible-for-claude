---
name: create-rapid-study
description: Create a Tangible Rapid study. When the user wants to create a study, infer the study type from what they said — default to Ask a Customer for generic open-ended research. Use Concept Test for 2+ stimuli to compare; use Brand Test presets (brand perception, positioning/messaging, campaign concept) when the user is testing how they're seen or which story lands. Then set a free-text audience, walk the catalog intakeHints, and call the matching `tangible_rapid_create_*` tool. Returns the draft `studyUrl`. Not for full custom questionnaires or researcher-grade scope.
---

# Create a Rapid study in Tangible

Tangible **Rapid** is a one-shot study product. The user describes their problem, picks a study type, gives an audience and a small intake, and the agents draft the brief + questionnaire + launch configuration in ~3 minutes. Respondents are recruited in 24–72 hours. This skill drives that flow.

## Who Rapid is NOT for

- **Full custom questionnaires** — Rapid drafts from structured templates. For free-form 60-question instruments point to Tangible Studio (coming).
- **Researcher-grade scope** — segmentation, longitudinal brand tracking, innovation discovery, custom screener logic. A separate advanced skill is coming; defer politely for now.
- **Launching from chat** — launches happen in the Tangible UI. This skill hands off via `launch_study`.

## Tone rules

- **Never enumerate audience options.** The audience is whoever the user's product is actually for. Ask once, in plain English, and pass the user's reply verbatim to `set_target_audience`. Do NOT offer a numbered menu of roles — the user picks the words.
- **Use catalog copy.** The study `description`s and the per-type `intakeHints` come from `tangible_rapid_list_study_types`. Use those when asking the user — don't invent option lists or substitute your own framing.
- **Use `AskUserQuestion` for choice questions.** When you have 2+ predefined options to offer (study type, workspace pick, win/loss outcome, churn time window, productCategory shortlist, market region, anything where the answer is one of a fixed set), call the `AskUserQuestion` tool — it's faster for the user than typing. For **open-ended** questions where the user types their own words (audience description, brand name, message variants, concept URLs, competitors list, churn signal, decision context, goal), ask in chat — `AskUserQuestion` requires at least 2 options and doesn't fit free-text. **Never use `AskUserQuestion` for the audience question** — that's free text only.
- **No backend jargon.** Never say internal identifiers, "session", "pipeline", "long-poll", `Q_*` codes, "rapidType", or raw error codes in user-facing text. The failure table below translates everything.
- **Don't quote dollar amounts in chat.** If the user asks what a study costs, tell them the Tangible app shows the line item on the review page once the draft is ready, and continue.
- **Audience summary only.** When `set_target_audience` returns, surface `oneLiner` + 3–4 audience bullets. Hide `matchMeta`, `source`, `matchedFromPreset`, raw `confidence` numbers.
- **Don't over-ask.** Use defaults (sample size 100, `productCategory` inferred from brand, churn defaults). Only ask when you genuinely can't infer.
- **Review drafts with `get_study_overview`, never `get_projects`.** For showing the user what a study asks, use `tangible_rapid_get_study_overview` — it returns a clean, plain-English summary. Never surface the raw questionnaire, question codes, question types, ids, or anything about how the study was generated. The user sees *what it asks*, not how it's built.

## Steps

### Step 1 — Choose the study type

Call `tangible_rapid_list_study_types` for catalog copy and `intakeHints`, but **don't show a 6-way picker by default**. Infer the type from what the user already said. **When in doubt, default to `ask_customer`.**

#### What we promote (matches README + tangiblehq.ai/claude)

| User-facing bucket | Catalog slug(s) | When |
|---|---|---|
| **Ask a Customer** | `ask_customer` | Learn, don't compare — discovery, onboarding, product feedback, voice of customer |
| **Concept Test** | `concept_test` | 2+ concrete stimuli to compare — pages, ads, packaging, mockups |
| **Brand Test** | `brand_perception`, `message_test`, sometimes `concept_test` | Perception vs competitors, positioning/taglines (text variants), or campaign direction |

**Brand Test routing (apply inside the bucket):**

| User says… | Route to |
|---|---|
| Brand perception, how we're seen vs **named competitors**, brand health | `brand_perception` |
| Positioning, tagline, value prop, narrative — **2–5 text variants** | `message_test` |
| Campaign concept / creative territory — **visual stimuli** (ads, mood boards, URLs) | `concept_test` |
| Campaign concept — **text-only** territories or lines | `message_test` |

When confirming with the user, use the **marketing label** (Ask a Customer, Concept Test, Brand Test) — not the catalog slug.

#### Routing rules (apply in order)

| Route to | Only when the user… |
|---|---|
| **`ask_customer`** *(default)* | Wants open-ended customer input, discovery, voice-of-customer, "talk to customers", "what do users think", "run a study", or anything generic that doesn't clearly fit a structured type below. **Use this unless a stronger signal exists.** |
| **`concept_test`** | **Explicitly** asks to compare concepts, designs, landing pages, ads, packaging, or mockups **and** has (or will supply) **2+ stimuli** to compare — URLs, images, Figma links, PDFs, etc. **Do NOT pick concept test for vague "understand our product" requests with no stimuli.** |
| **`message_test`** | Has **2–5 short text variants** to compare — taglines, value props, positioning lines, email subject lines, ad copy. Words, not visual concepts. **Brand Test → positioning & messaging.** |
| **`win_loss`** | Is asking about deals won or lost — pipeline, CRM closed-lost, competitive losses, why we won/lost. *(Not promoted on README/landing — use when the user clearly asks.)* |
| **`brand_perception`** | Wants to know how their brand stacks up against **named competitors**, or open-ended brand perception in the category. **Brand Test → brand perception.** |
| **`churn_diagnosis`** | Is asking why customers cancelled, downgraded, didn't renew, or churned. *(Not promoted on README/landing — use when the user clearly asks.)* |

#### How to confirm

- **Clear match** → name the type in one sentence and move on. No picker. Example: *"Sounds like a brand perception study — I'll set it up to see how you land vs. those competitors."*
- **Generic / ambiguous** → default to Ask a Customer and confirm briefly. Example: *"I'll set this up as open-ended customer research — we'll ask customers in their own words. Sound right?"* Only offer other types if they push back or ask what's available.
- **Full picker** → use `AskUserQuestion` with the **three promoted types** (Ask a Customer, Concept Test, Brand Test) plus brief descriptions **only** when the user explicitly asks "what types can I run?" or rejects your suggested type. Mention win/loss and churn only if they ask about those specifically.

#### Slug → tool map

| Slug | Create tool |
|---|---|
| `message_test` | `tangible_rapid_create_message_test` |
| `concept_test` | `tangible_rapid_create_concept_test` |
| `win_loss` | `tangible_rapid_create_win_loss_study` |
| `brand_perception` | `tangible_rapid_create_brand_perception_study` |
| `churn_diagnosis` | `tangible_rapid_create_churn_diagnosis_study` |
| `ask_customer` | `tangible_rapid_create_ask_customer_study` |

### Step 2 — Pick a workspace (silently if you can)

Call `tangible_list_workspaces`. If exactly one workspace, use it without asking. If multiple, use `AskUserQuestion` with one option per workspace (label = workspace name). Never call it an "ID".

### Step 3 — Set a free-text audience

Ask the user a single open-ended question **in chat** (not `AskUserQuestion`):

> "Who should see this study? Describe them in your own words — role, company shape, geography, anything that defines the buyer for this product."

**Never offer a numbered list of roles or use `AskUserQuestion` here.** Whatever the user types is the audience. Pass it verbatim to `tangible_rapid_set_target_audience(workspaceId, audienceDescription)`.

The tool returns `{ studyId, audience, oneLiner, confidence, source, matchedFromPreset, alternatives }`.

**Show the user.** `oneLiner` plus 3–4 bullets from `audience` (roles, company shape, screeners, quota). That's it. Confirm it looks right.

**Don't show.** `matchMeta`, `source`, `matchedFromPreset`, raw `confidence`, full `alternatives` payload.

**Low confidence (< 0.3).** Tell the user the match was a guess; ask them to be more specific in their own words; optionally surface the top 1–2 `alternatives[].label`s as starting points. Re-call `set_target_audience(..., studyId=<existing>)` with the better description. Don't proceed to `create_*` until the audience looks right.

**Refining later (same studyId).** When the user wants to *tweak* the audience you already set ("make it enterprise only", "add US buyers", "drop the seniority requirement"), call `tangible_rapid_refine_target_audience(studyId, refinement)` with just the change in plain English. It layers the tweak onto the current audience instead of re-matching from scratch, so the rest stays put. Surface the returned `oneLiner` and confirm. Use `set_target_audience(studyId=<existing>)` instead only for a **full rewrite** (a completely different audience). If either returns a locked-study error, the questionnaire is already built — start a fresh study (`set_target_audience` with no `studyId`).

### Step 4 — Walk the catalog intakeHints

Pull `intakeHints` for the chosen `slug` from `tangible_rapid_list_study_types`. Walk through them in order, in one or two turns max. Use the hint wording — don't substitute your own option lists.

**When to use `AskUserQuestion` vs chat:**

- **Choice fields → `AskUserQuestion`:**
  - `outcome` for `win_loss` — options: Lost / Won / Both.
  - `churnTimeWindow` — options: Last 30 days / Last 60 days / Last 90 days / Last 180 days. (Falls back to Last 90 days if skipped.)
  - `productCategory` *when you genuinely need to ask* — options: B2B SaaS / Fintech / Marketplace / Other. Most of the time you should infer from brand or context and not ask at all.
  - `marketGeo` for `brand_perception` *when you need to ask* — options: United States / North America / Europe / Global.
- **Open-ended fields → chat:**
  - `brandName`, message variants, concept URLs / text, competitors list, `decisionContext`, `churnSignal`, `goal`, anything where the user types their own words.
- **Don't ask at all** when the catalog hint says "default", "ask only if the user wants to override", or you can infer the answer from what the user already said.

Other rules:

- For `decisionContext` (required by message / concept / brand_perception), infer first from brand + the messages/concepts/competitors + the audience. Only ask in chat if you genuinely can't infer — short single question, no `AskUserQuestion` since the answer is free text.
- For concept tests, infer `ConceptStimulus.type` from URL shape (Figma → `website`, .png/.jpg → `image`, .mp4 → `video`, .pdf → `pdf`, plain page → `website`). Only ask if genuinely ambiguous. Accept any fetchable URL; don't tell users "public S3 only".
- Sample size defaults to 100 — only ask if the user wants to override.
- **`ask_customer` is light — don't walk a long intake.** This is open-ended voice-of-customer, not a structured study. Only the **goal** (what they want to hear, in their own words) and the **audience** really matter. Take the goal verbatim or infer it; brand / category are optional (infer or skip); there are no variants, competitors, or outcome fields. Sample size defaults to **20** here, not 100. Call `tangible_rapid_create_ask_customer_study(studyId, goal?, brandName?, extraContext?)` and move on.
- **Bring-your-own questionnaire (`ask_customer` only).** If the user already has a questionnaire (pasted text or a txt/md file they've shared), don't rewrite it — pass its full plain text as `providedQuestionnaire` with `questionnaireIntent="verbatim"` (and the filename as `questionnaireSourceName` if there is one). Their questions are then asked **word-for-word**; the platform only wraps consent, screening, and demographics around them. Confirm with the user first that they want it used as-is — that's what `"verbatim"` asserts. Limits: plain text only (no pdf/docx), max 20,000 characters; `"inspiration"` intent isn't supported yet, so if they only want it as a starting point, fold its themes into `goal` / `extraContext` instead.

### Step 5 — Create the study

Call the matching `create_*` tool with the `studyId` from step 3 and the inputs you've gathered. The tool returns `{ projectId, studyUrl, status: "creating" }` immediately. Tell the user "drafting your study now — back in a couple of minutes" and surface the `studyUrl`.

### Step 6 — Wait for the draft

Immediately call `tangible_rapid_wait_for_study(projectId)`. Each call blocks server-side until status changes — no sleep between calls.

- `terminal: false` → call again immediately.
- `terminal: true, status: "draft"` → study is ready. Go to **Step 6a** to review it with the user.
- `terminal: true, status: "failed"` → see the failure table below.
- **Cap at 6 calls (~5 min).** After that, surface `studyUrl` and tell the user the draft is taking unusually long.

### Step 6a — Review the draft with the user

Before anyone launches, show the user what was drafted. Call `tangible_rapid_get_study_overview(projectId)` — a clean, plain-English summary: `title`, `overview` (one line on what the study does), `topics` (the themes), `questions` (the actual wording), `questionCount`, and `concepts` (names, for concept tests). Give a tight readout:

- The title + the one-line `overview`.
- The themes (`topics`) and roughly how many questions.
- A few example questions verbatim from `questions` — enough to show the shape, not a wall of text.

Then ask if it looks right. If they want changes, hand to the `update-rapid-study` skill. **Use `get_study_overview` for this — never `get_projects`** (see tone rules): describe *what the study asks*, never its internal structure or how it was generated.

### Step 6b — Ask a Customer: offer both delivery links (and a preview)

An **Ask a Customer** study can run two ways off the same draft: a quick **survey** or a short **AI voice interview**. Once the draft is ready, call `tangible_get_project_urls(projectId)` — it returns `interviewUrl` (the AI interview) and `participantUrl` (the survey) — and offer both:

> "Your study's ready. You can send customers a short **AI voice interview** or a quick **survey** — same questions either way. The interview is the natural fit for hearing them in their own words. Which do you want to use?"

Use `AskUserQuestion` with two options — **AI interview** and **Survey**. Share the link they pick (`interviewUrl` or `participantUrl`) as the one to send; mention the other is available too if they want both. Refer to them as "the interview link" and "the survey link" — never as `/i/` or `/s/` or "URLs".

**Offer a test-drive.** The same `get_project_urls` call returns `interviewPreviewUrl` — an owner-only link to walk the AI interview themselves *before* launching (a draft's live link isn't open to respondents yet). Offer it: "Want to try the interview yourself first? Here's a private preview." (A draft **survey** has no preview link — to test one, point them to the design page, `studyUrl`.)

This two-link choice is **only for `ask_customer`.** For the other five types, the survey (`participantUrl`) is the delivery — don't offer an interview link.

### Step 7 — Hand off to launch (when asked)

When the user is ready to launch, call `tangible_rapid_launch_study(studyId)`. Surface `reviewUrl` and `message` verbatim. **This tool does not launch — launches happen in the Tangible UI.**

If the user wants to edit before launching, use the `update-rapid-study` skill.

## Failure modes (translate before showing the user)

| Situation | What to say | What to do |
|---|---|---|
| Drafting is taking longer than expected | "Tangible's still drafting — let me check the latest status." | **Always call `tangible_study_status(studyId)` before assuming failure.** The study often completes in the background. If the status is ready, deliver it as success. If it failed, quote the reason and offer to restart. |
| Study is still generating | "Your study is still generating. Give it a minute." | Offer to poll via `wait_for_study`. |
| Study already finished collecting responses | "This study already finished collecting responses. Want me to start a fresh one?" | Offer to start over with a new audience. |
| Audience wasn't set | "Looks like the audience wasn't set — let me restart this for you." | Set the audience first, then continue the create flow. |
| First draft didn't finish | "The first draft didn't finish — let me start a fresh study for you." | Re-set the audience with the same description, then re-run the create flow. Don't make the user repeat themselves. |
| User doesn't have billing access | "Only the workspace owner can see billing. Try asking them, or use a different workspace." | Drop the operation. |
| Drafting failed | "Tangible ran into an issue drafting your study. Want me to retry from scratch?" | Quote the reason from the tool, offer to restart. |
| Connection dropped | "The Tangible connection looks like it dropped — let me reconnect you." | Run the `connect` skill, then resume where you left off. |

## What this skill does NOT do

- **Launch responses** — launches happen in the Tangible UI. `launch_study` only returns the review URL.
- **Edit an existing study** — use the `update-rapid-study` skill.
- **Full custom questionnaires** — Rapid uses structured templates. Point to Tangible Studio (coming) if the user wants free-form authoring.
- **Researcher-grade scope** — segmentation, longitudinal brand tracking, innovation discovery, custom screener logic. A separate advanced skill is coming; defer politely.
- **Read or modify existing projects** — for status / browsing, call `tangible_study_status`, `tangible_list_projects`, or `tangible_get_projects` directly.
