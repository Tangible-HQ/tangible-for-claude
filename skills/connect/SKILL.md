---
name: connect
description: Check the Tangible connection and get the user set up. Use when the user wants to connect, sign in, log in, reconnect, or asks "is Tangible working", "am I connected", "am I set up", "who am I signed in as"; or when another skill hit a connection error. Confirms identity via `tangible_whoami`, reports the workspace(s) the user can use, and offers to create a first workspace if they have none. Sign-in and payment setup happen in the browser / Tangible app — this skill checks state and guides those hand-offs; it does not log the user in itself.
---

# Connect to Tangible (check + fix the connection)

This is the "am I set up?" and "reconnect me" skill. Use it to confirm the Tangible connection is live, tell the user who they're signed in as and which workspace they'll be working in, and get them unstuck when a study skill hits an auth error.

## When this skill applies

- The user asks to **connect / sign in / log in / reconnect** to Tangible.
- The user asks whether it's **working** — "is Tangible connected", "am I set up", "who am I signed in as".
- Another skill (`create-rapid-study`, `update-rapid-study`, `analyze-rapid-study`) hit an auth error and pointed here.

For actually running a study use `create-rapid-study`; for reading results use `analyze-rapid-study`. This skill only handles connection + setup state.

## How auth actually works (so you set the right expectation)

**"Log in", "sign in", and "connect" are the same thing in Tangible** — one automatic browser step. There is no separate login command; connecting *is* signing in, and it happens on its own.

- Sign-in is **Tangible's browser authentication**. Claude cannot sign the user in from a skill — calling a Tangible tool when not connected makes the Claude client open the sign-in page automatically. This skill's job is to *trigger* that and explain it, not to perform the login.
- Once signed in, the identity is carried for the session. There's nothing to store or paste.
- **Account creation, payment-method setup, and launching a study all happen in the Tangible app (browser)** — they are not available over the connection. This skill can detect that setup is needed and hand off; it can't complete those steps.

## Tone rules

Same as the study skills:

- **Plain English, no backend jargon.** Never say internal identifiers, authentication details, or backend implementation terms in user-facing text. Say "your Tangible sign-in" / "the connection".
- **Never show or call anything an "ID".** Refer to a workspace by its name.
- **Don't over-report.** On success, one or two lines: who they are + which workspace. Don't dump role tables or internal fields.

## Steps

### Step 1 — Check the connection

Call `tangible_whoami`.

- **Returns a user** → connected. Continue to Step 2.
- **Fails (no identity / connection dropped)** → not connected yet. Tell the user:
  > "Opening the Tangible sign-in in your browser — finish signing in there and I'll pick right back up."
  Then retry `tangible_whoami` once the user says they're done (or on your next action). The Claude client handles the actual browser sign-in; you just prompt and resume. If it still fails after a completed sign-in, say the connection couldn't be established and to try again in a moment — don't loop more than twice.

### Step 2 — Confirm identity and workspace

On success, greet by name and confirm the workspace:

1. From `tangible_whoami`, take `firstname` / `email`.
2. Call `tangible_list_workspaces`.
   - **Exactly one workspace** → name it: *"You're connected as Jane (jane@acme.com), working in **Acme Research**."*
   - **Multiple** → connected as the user, and list the workspace names so they know what they can pick from. Don't force a choice here — the study skills pick the workspace when a study is actually created.
   - **None** → go to Step 3.

### Step 3 — No workspace yet

If `tangible_list_workspaces` returns nothing, the user is signed in but has no workspace to put a study in. Offer to create one:

> "You're signed in, but you don't have a workspace yet — that's where your studies live. Want me to create one? Just give it a name (e.g. your company or team)."

On confirmation, call `tangible_create_workspace(name)` and confirm. If they'd rather do it in the app, point them there and stop.

### Step 4 — Point forward

Once connected with a workspace, tell them what they can do next in one line: *"You're all set — want to create a study, edit one, or look at results?"* (→ `create-rapid-study` / `update-rapid-study` / `analyze-rapid-study`).

## A note on billing / launch

Whether a workspace has a payment method on file **can't be checked over the connection today** — launch readiness (including payment) is confirmed when you actually launch, which happens in the Tangible app. So don't claim a workspace is "ready to launch" or "has billing set up". If the user asks, say payment and launch are handled on the study's review page in the app.

## Failure modes (translate before showing the user)

| Situation | What to say | What to do |
|---|---|---|
| Sign-in failed or connection dropped | "Opening the Tangible sign-in in your browser — finish there and I'll pick back up." | Prompt the user to complete the browser sign-in, then retry the connection check. Don't loop more than twice. |
| Signed in, no workspace | "You're signed in, but there's no workspace yet — want me to create one?" | Offer `tangible_create_workspace(name)`; or hand off to the app. |
| Repeated failure after sign-in | "I couldn't establish the Tangible connection — let's try again in a moment." | Stop; don't loop. |

## What this skill does NOT do

- **Log the user in directly** — sign-in is a browser step; this skill triggers and explains it.
- **Create an account, add a payment method, or launch a study** — all happen in the Tangible app.
- **Pick a workspace for a study** — the study skills do that at create time.
- **Create or read studies** — use `create-rapid-study` / `update-rapid-study` / `analyze-rapid-study`.
