/**
 * Site Sourced — the contact form's fields, in one place.
 *
 * The form's fields are three things at once, and until now they were written out three
 * times: the `<input>`/`<textarea>` elements in `render.ts`, the `fields` list in the
 * bundle manifest, and — silently — the privacy notice's "what is collected" sentence.
 * The published page proved why that is not good enough: it told a visitor the form
 * collects "your name, your email address and your message" while the form also asked
 * for an optional phone number. The notice understated what was captured.
 *
 * So the fields are declared here once. `render.ts` builds the form from this list, the
 * manifest lists it, and the privacy notice's collection sentence is composed from it —
 * and `complianceChecks` compares the sentence with the fields the rendered page really
 * asks for, so the three cannot drift apart again.
 */

export interface FormField {
  /** The `name` the browser posts, and the key the provider stores it under. */
  name: string;
  /** The element id, used by the label's `for`. */
  id: string;
  type: "text" | "email" | "tel" | "textarea";
  /** Which `copy.ui` key holds the label a visitor reads. */
  labelKey: "fieldName" | "fieldEmail" | "fieldPhone" | "fieldMessage";
  /** A field the visitor may leave empty. */
  optional: boolean;
  /** How the notice names it, after "your". */
  collects: string;
  /** For an optional field, the clause that keeps the notice honest about it. */
  whenGiven?: string;
  autocomplete?: string;
  /** How the bundle manifest lists the field. */
  manifest: string;
}

export const FORM_FIELDS: FormField[] = [
  {
    name: "name",
    id: "cf-name",
    type: "text",
    labelKey: "fieldName",
    optional: false,
    collects: "name",
    autocomplete: "name",
    manifest: "name",
  },
  {
    name: "email",
    id: "cf-email",
    type: "email",
    labelKey: "fieldEmail",
    optional: false,
    collects: "email address",
    autocomplete: "email",
    manifest: "email",
  },
  {
    // Optional on purpose: a phone number is how a small business usually answers, but
    // requiring one costs submissions. The notice says "if you give one" for that reason.
    name: "phone",
    id: "cf-phone",
    type: "tel",
    labelKey: "fieldPhone",
    optional: true,
    collects: "phone number",
    whenGiven: "if you give one",
    autocomplete: "tel",
    manifest: "phone (optional)",
  },
  {
    name: "message",
    id: "cf-message",
    type: "textarea",
    labelKey: "fieldMessage",
    optional: false,
    collects: "message",
    manifest: "message",
  },
];

/** The hidden anti-bot field's name, per provider family. Not a field a visitor fills in. */
export const HONEYPOT_NAMES = ["_gotcha", "botcheck"];

/** "a", "a and b", "a, b and c" — the notice's own register, no Oxford comma. */
function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The privacy notice's collection sentence, composed from the fields the form renders.
 *
 * Required fields come first, in the order the visitor meets them; an optional field is
 * named last with its condition, because that is where the condition reads naturally
 * ("…and your phone number if you give one"). Nothing here is hand-written: adding a
 * field to `FORM_FIELDS` changes the form, the manifest and the notice in one edit.
 */
export function collectionSentence(fields: FormField[] = FORM_FIELDS): string {
  const required = fields.filter((f) => !f.optional).map((f) => `your ${f.collects}`);
  const optional = fields
    .filter((f) => f.optional)
    .map((f) => `your ${f.collects}${f.whenGiven ? ` ${f.whenGiven}` : ""}`);
  return `The form records what you type into it: ${joinList([...required, ...optional])}.`;
}

/**
 * The same sentence, but for exactly the field names a rendered page asks for. Used by
 * the build check, which reads the page rather than trusting the composer.
 */
export function collectionSentenceFrom(names: Iterable<string>): string {
  const set = new Set(names);
  return collectionSentence(FORM_FIELDS.filter((f) => set.has(f.name)));
}
