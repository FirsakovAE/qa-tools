/**
 * Task-specific instructions of the assistant. Full routing puts all of them into the system
 * prompt; Lite routing lists them in the core and the model loads one with `load_skill`.
 */

import type { ToolDefinition } from './types'

export type AiSkillId = 'diagnostics' | 'logs_data' | 'reproduction' | 'ui_conditions' | 'docs'

interface AiSkill {
  id: AiSkillId
  /** Catalog line: when the skill applies */
  when: string
  rules: string
}

export const SKILLS: AiSkill[] = [
  {
    id: 'diagnostics',
    when: 'The user reports an error, a failed request or unexpected app behavior, or asks why something happened.',
    rules: `Goal: find the cause, not a plausible explanation.

## Rules
- An error message says what failed, not why. Do not answer from the error message or the digest alone while a tool can check more.
- Do not name a store, component or operation as the cause without evidence for it.
- If the question is why an element is shown, hidden, enabled or disabled, or why a message appears, use the ui_conditions skill too.

## Steps
1. Find the reported symptom. Start with the digest \`Problems\`. If the symptom is not there, find it before drawing conclusions: \`search_logs\` for the error text, button label or value; \`search_source\` for the text in the code.
2. Read the error. A \`Problems\` item already has the error, its stack (or \`Stack: none\`), the last \`Page\` navigation before it and when store data arrived (\`Data later\`). \`get_events\` on an error also returns its neighbor events; do not call it only to read the stack again.
3. If the logs do not explain the behavior, read the code. For a stack frame: \`read_source\` with the script URL, \`line\` and \`column\` (source maps are applied). To find files: \`search_source\`, \`list_sources\`. Reuse code you already read.
4. Trace the chain through requests, responses, state changes and UI, and find:
   a. the last step that demonstrably succeeded;
   b. the first point where the behavior deviated;
   c. the code or data that caused the deviation;
   d. the most likely cause.

## Reading the logs
- \`Data later\` means data arrived later. It does not prove the needed values were in it or reached the state. Check the content and the arrival time before claiming a race condition or missing data.
- The current page is the last navigation before the error; do not confuse it with an earlier one. Different URLs may be different sites. Call it a redirect only with evidence.
- Events and stores of the same session do not automatically belong to the current page. Confirm the link by page code or component bindings, or say it is unconfirmed.

## Answer
What went wrong, the most likely cause, the evidence (\`#N\`, \`file:line\`), the fix or how to reproduce. If the cause is not proven: what is known, what is not, and which check would decide.`,
  },
  {
    id: 'logs_data',
    when: 'Find, list, count or filter values in logged requests, responses, WebSocket messages, stores or props; build requests, collections or tests from real logged data.',
    rules: `## Pick the tool
| Need | Tool |
|---|---|
| Which events or paths have a value or a key | \`search_logs\` with \`key\` and / or \`value\` (and \`kind\`). Returns \`path = value\` matches, not whole objects. |
| List, count or filter array items by property ("filters with isVisibleByDefault true", "items without price", "how many rows have status ERROR") | \`find_items\` with \`where\`, \`path\` and \`ids\` when known, \`fields\` to show. |
| Whole event: body, headers, state, neighbor events | \`get_events\` with all needed ids (up to 6 per call; for more, several calls in the same round). |
| Read one long body page by page | \`get_events\` with one id, \`part\` and the \`offset\` from the cut marker. |

## Rules
- Search with \`search_logs\` before saying a value is not in the logs.
- For array questions call \`find_items\` first, not \`get_events\`: it reads the whole stored body, also a body cut at capture. Never go through an array item by item with \`get_events\` pages or repeated searches.
- \`find_items\` without a known array path: omit \`path\`. No matches: look at the arrays the result lists, fix \`path\` or the property name and retry once.
- Each body page is one tool round. Page a body only when \`find_items\` and \`search_logs\` cannot answer.
- For a request made in the session (to build a test or a collection), find the real request and use its URL, headers and body.

## Cut at capture
\`[cut at capture]\`: the body was cut when it was logged. Only the part up to \`[End of ...]\` exists; no tool can read the rest. If the data may still be on the page (a list in a store or a component), check it with \`read_stores\` or \`inspect_ui\`. Otherwise tell the user that the event was cut when captured, and that raising **Limit event size** in **Options → Logs** (or turning it off) and repeating the action records it in full.`,
  },
  {
    id: 'reproduction',
    when: 'Steps to reproduce, a test case from the session, what the user did, or how a page or state was reached.',
    rules: `Goal: the real sequence of user actions, not a list of visited URLs. Completeness and one action per step are more important than a short answer, at any length setting.

## Sources
- **Click** events are the user actions: button clicks, field input, option selection. Steps come only from them.
- **Navigation** events are route changes. They are never steps; never infer a click from a navigation.
- Requests and other events show results of actions and automatic behavior. Use them only as notes.

## Collect (all steps, in this order)
1. Set the interval: from the requested start to the requested end; by default, the whole session up to the latest event. Use every digest of the chat, not only the newest.
2. Take every Click of the interval from the digests' Timeline. A click line is \`#N +time CLICK <label> | <selector or xpath>\`: it already has the label and the locator, enough for the steps.
3. Find clicks the digests do not show (folded \`(xN)\` lines, long gaps between navigations): \`search_logs\` with \`kind: "click"\` and \`query\`, \`key\` or \`value\` set to a control label, a selected text or an xpath fragment.
   - Valid: \`{"query": "Apply", "kind": "click"}\`; next page: \`{"query": "Apply", "kind": "click", "offset": 20}\`.
   - Invalid: \`{"kind": "click"}\` alone (rejected). Invalid: \`query\` set to "click" or another kind name (it matches every event of that kind).
4. Order clicks and navigations by event id. Use navigations and requests only to confirm transitions and results; mark automatic transitions as such.
5. Check coverage: the clicks must cover the whole interval. For a part without clicks, search once more; if nothing is found, report it as a gap.

Write the steps only after steps 1–5. Do not invent missing actions. Do not say a click caused a request or a navigation without evidence.

## Click details (\`get_events\`)
Load Click events with \`get_events\` only when one of these is true:
- the task needs locators beyond the click line: an autotest (Playwright, Cypress, Selenium...) or a list of locators;
- a click line has no usable label (empty, or only a tag name);
- the user asks for the details of the clicks.
Otherwise build the steps from the click lines without \`get_events\`. When you load them: only the clicks that need it, up to 6 ids per call, all calls in one round.

## Naming the control
- Use the real label and selected value of the click, exactly as logged (do not translate them).
- Prefer \`testId\`, \`id\` or \`selector\` over the absolute \`xpath\` (\`testId\`, \`id\`, \`ariaLabel\` are in the event details).
- In a manual scenario add a locator only when the label does not identify the control (for example two "Add" buttons). In an autotest every action gets a locator.
- Opening a dropdown and choosing an option are two actions.

## Output: a QA scenario
- Write the scenario in the language of the answer: the action words in that language, the UI labels exactly as logged.
- One Click event = one numbered step. Never merge two clicks into one step.
- Keep the chronological order.
- Write the action itself, not its purpose: "Click the "Brand" dropdown", not "Set up the filters".
- Navigations, requests and automatic changes are not steps. Add them as short notes under the step that caused them, only when relevant.
- Event ids: grouped per phase (for example "Clicks #12–#30"), not after every step.
- A part that cannot be reconstructed: write "Gap: actions between #N and #M are not in the logs" (in the language of the answer).

Example of the step pattern. It shows the structure only: translate the action words, keep the labels.
English answer:
1. Click the "Filters" button.
2. Click the "Brand" dropdown.
3. Select "Toyota".
4. Click "Apply".
The same steps in a Russian answer:
1. Нажать кнопку "Filters".
2. Нажать на выпадающий список "Brand".
3. Выбрать "Toyota".
4. Нажать "Apply".`,
  },
  {
    id: 'ui_conditions',
    when: 'Why an element is shown, hidden, enabled or disabled, why a message appears, or why a click does nothing.',
    rules: `Logs show what happened; code conditions and current values explain why.

## 1. Find the element and its code
1. \`inspect_ui\` with the element label or the message text. Note the component, file, handler and current values.
2. No match: the element is probably not rendered (\`v-if\`). Look at elements with similar words in the result: a nearby notice often gives the reason.
3. \`search_source\` for the label or a distinctive part of the text. For a localized text, find the translation key first, then its usages.
4. \`read_source\` with \`path\` and \`query\` = a distinctive snippet of the match. Increase \`chars\` if the code is cut.
5. In the code look for \`v-if\`, \`v-show\`, \`:disabled\`, \`:class\` and checks in event handlers. Find the definition of every prop, computed and store getter they use (\`search_source\`, several names at once with \`regex: true\`).

Minified code: the template is a render function; a condition can be a ternary or an \`&&\` before the element. A short name such as \`fe.value\` or \`r[3]\` means nothing by itself: find where it is defined.

## 2. Get the current values
- \`inspect_ui\` with \`component\` = the template component: props, computeds with getter code and values, child components. Check also where each variable comes from.
- \`Where the props come from\` shows the parent binding, for example \`showButton: n.value && !o.viewOnly\`. Inspect that parent with \`inspect_ui\` for its values.
- Store fields: \`read_stores\`. Compare with the logs (prop changes, store state, response fields): \`search_logs\` with \`key\`.

## 3. Evaluate
Evaluate every condition with the current values, keeping its AND / OR logic. For each condition give:
- its meaning in plain words;
- its location (\`file:line\`);
- the data source and the current value;
- whether it is true now.

Then say which conditions hide or disable the element. Quote a notice if there is one. Name a restriction (role, status, permission, validation) only when a found condition shows it. If no condition is found, say so and name the next check.

## Click without a request
A click that sends no request and shows only a message: the handler stopped before the API call (validation, guard, permission or feature flag). Find the message with \`search_source\`, read that branch and list the conditions under which it runs.`,
  },
  {
    id: 'docs',
    when: 'Questions about Vue Inspector itself: its features, settings, where something is in its UI, how to use it.',
    rules: `Vue Inspector runs as a Chrome / Edge extension or as a standalone bookmarklet (overlay only).

1. Call \`read_docs\` without arguments for the page list, then with up to 3 page ids (optionally a \`section\`).
2. Answer from the documentation. Keep the exact UI labels.
3. If the documentation does not cover the question, say so.

Do not invent features or settings. Do not attribute features of Chrome DevTools, Charles or other tools to Vue Inspector.`,
  },
]

const BY_ID = new Map(SKILLS.map(s => [s.id, s]))

function skillText(skill: AiSkill): string {
  return `# Skill: ${skill.id}\nUse when: ${skill.when}\n\n${skill.rules}`
}

/** Catalog for the core prompt; Lite adds the command that loads a skill */
export function skillCatalog(): string {
  return SKILLS.map(s => `- \`${s.id}\`: ${s.when}`).join('\n')
}

/** Every skill, for Full routing */
export function allSkills(): string {
  return SKILLS.map(skillText).join('\n\n')
}

/** Result of `load_skill`: the rules of the named skills */
export function loadSkills(names: unknown): string {
  const list = (Array.isArray(names) ? names : [names]).map(n => String(n ?? '').trim()).filter(Boolean)
  if (!list.length) return `Pass names: one or more of ${SKILLS.map(s => s.id).join(', ')}.`
  const found = [...new Set(list)].map(n => BY_ID.get(n as AiSkillId))
  const unknown = list.filter(n => !BY_ID.has(n as AiSkillId))
  const parts = found.filter((s): s is AiSkill => !!s).map(skillText)
  if (unknown.length) parts.push(`Unknown skill: ${unknown.join(', ')}. Skills: ${SKILLS.map(s => s.id).join(', ')}.`)
  return parts.join('\n\n')
}

export const LOAD_SKILL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'load_skill',
    description: 'Rules and steps for a type of task (see the skill list in the instructions). Load the matching skills before other tools for that task; one call can load several.',
    parameters: {
      type: 'object',
      properties: {
        names: { type: 'array', items: { type: 'string', enum: SKILLS.map(s => s.id) }, description: 'Skill names from the list' },
      },
      required: ['names'],
    },
  },
}
