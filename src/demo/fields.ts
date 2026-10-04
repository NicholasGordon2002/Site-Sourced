/**
 * Site Sourced — the contact form's fields, **per conversion family**.
 *
 * The form's fields are four things at once, and they used to be written out four
 * times: the `<input>`/`<textarea>` elements in `render.ts`, the `fields` list in the
 * bundle manifest, and — silently — the privacy notice's "what is collected" sentence.
 * The published page proved why that is not good enough: it told a visitor the form
 * collects "your name, your email address and your message" while the form also asked
 * for an optional phone number. The notice understated what was captured.
 *
 * So the fields are declared here once, as **field sets, one per family**
 * (`template-system.md` §2.1–§2.4; `design/family-layer-design-spec.md` §2):
 *
 *   appointment (A)  a time is requested. Phone is required — a shop that books by
 *                    phone needs the number — email is optional, and the request
 *                    carries the recorded service, a preferred day or days and a
 *                    preferred time.
 *   inquiry (B)      a need is described. Email is required, phone optional, and the
 *                    inquiry carries the type of job, where it is, what is needed and
 *                    how soon — the questions a quoted job starts with.
 *
 * Three rules hold across both sets, and they are the reason the sets are data:
 *
 *   1. **A field the record cannot support does not appear.** No recorded services ⇒
 *      no service select (a select holding only "Not sure" asks nothing). No hours row
 *      that states a day as open ⇒ no preferred-days group at all — no legend, no
 *      empty fieldset, no "call to ask" filler. A category that does not quote a site
 *      job ⇒ no "Where is the job?" field. Nothing is invented to fill the gap; the
 *      omission and its reason are recorded in `manifest.json`.
 *   2. **The visitor may skip what the build cannot justify demanding.** `optional`
 *      means the visitor may leave it empty: it loses the `required` attribute and
 *      gains the `(optional)` marker, and the privacy notice names it last, with its
 *      condition ("your phone number if you give one"). `required` is the browser
 *      attribute and is deliberately a separate flag: the service select always sends
 *      a value, so it is never empty, but it is not something a visitor can fail to
 *      fill in either.
 *   3. **The notice is composed from the same list.** `render.ts` builds the form from
 *      this data, the manifest lists it, and the privacy notice's collection sentence
 *      is composed from it — and `complianceChecks` compares that sentence with the
 *      fields the rendered page really asks for, so the three cannot drift apart again.
 */

import type { ConversionFamily } from "./family.ts";

/**
 * The words the form prints, as a structural interface rather than a copy of
 * `DemoCopy`: `copy.ts` holds the prose (`ui`), and this file only says which of those
 * keys each control uses, so the two stay one edit apart.
 */
export interface FormLabels {
  fieldName: string;
  fieldEmail: string;
  fieldPhone: string;
  fieldService: string;
  fieldPreferredDays: string;
  fieldPreferredTime: string;
  fieldBeenBefore: string;
  fieldExtra: string;
  fieldJobType: string;
  fieldJobLocation: string;
  fieldJobDescription: string;
  fieldHowSoon: string;
  fieldReachYou: string;
  fieldOptional: string;
  legendYourDetails: string;
  legendTheAppointment: string;
  legendAboutTheJob: string;
  optionNotSure: string;
  optionSomethingElse: string;
  optionNoPreference: string;
  optionMorning: string;
  optionAfternoon: string;
  optionFlexible: string;
  optionNextFewWeeks: string;
  optionAsSoonAsPossible: string;
  optionEmergency: string;
  optionYes: string;
  optionNo: string;
  optionEmail: string;
  optionPhone: string;
}

/** The controls the two families need. Every one works with JavaScript off. */
export type FieldControl = "text" | "email" | "tel" | "textarea" | "select" | "checkbox" | "radio";

export interface FieldSpec {
  /** The `name` the browser posts, and the key the provider stores it under. */
  name: string;
  /** The element id, used by the label's `for` (or the group legend's id). */
  id: string;
  control: FieldControl;
  /** Which `FormLabels` key holds the label a visitor reads. */
  labelKey: keyof FormLabels;
  /** The visitor may leave it empty. */
  optional: boolean;
  /** The browser must not submit it empty. */
  required: boolean;
  /** How the notice names it, after "your". */
  collects: string;
  /** For an optional field, the clause that keeps the notice honest about it. */
  whenGiven?: string;
  autocomplete?: string;
  /** Textareas only. */
  rows?: number;
  /** The choices a select or a choice group offers, verbatim and derived. */
  options?: string[];
  /** The option that carries `selected`/`checked` in the HTML. */
  preselected?: string;
  /** How the bundle manifest lists the field. */
  manifest: string;
}

/** One fieldset: a group of fields under a short legend. */
export interface FieldGroup {
  legend: string;
  fields: FieldSpec[];
}

/** A field the family's set does not carry, and the record-backed reason why. */
export interface OmittedField {
  field: string;
  why: string;
}

/** The days a preferred-days control may offer, and the rows that decided it. */
export interface OpenDays {
  days: string[];
  basis: string;
}

export interface FamilyFields {
  family: ConversionFamily;
  groups: FieldGroup[];
  /** Every field, in the order a visitor meets it. */
  fields: FieldSpec[];
  omitted: OmittedField[];
  preferredDays: OpenDays;
}

/** The hidden anti-bot field's name, per provider family. Not a field a visitor fills in. */
export const HONEYPOT_NAMES = ["_gotcha", "botcheck"];

/* ------------------------------------------------------- the preferred-days control */

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * The days a `hours` row **states as open** — lead ruling 8, and
 * `design/family-layer-design-spec.md` §2.
 *
 * The negative half is the important half: offering a day the record does not show as
 * open would put a day in front of a visitor that the business never said it works,
 * which is exactly the kind of claim the page may not make.
 *
 *   - a row whose hours read `Closed` contributes no days;
 *   - a row we could not read as days-and-times at all (the verbatim fallback row that
 *     `expandOsmHours` prints when it does not understand a rule, which is also where
 *     an OSM `Sa,Su off` lands) contributes no days — if we cannot read it, we do not
 *     offer it;
 *   - a row whose days read `Every day` (the `24/7` case) contributes the whole week,
 *     because that is what the row states;
 *   - anything else contributes only the day tokens we can read, and if **any** token
 *     in that row is unreadable the whole row is dropped rather than half-offered.
 *
 * Zero days is a legitimate answer: the caller then renders no group at all. The basis
 * below is what the manifest prints, so a reviewer sees which rows decided it.
 */
export function openDays(rows: { days: string; hours: string }[]): OpenDays {
  const offered = new Set<string>();
  const notes: string[] = [];

  for (const row of rows) {
    const days = (row.days ?? "").trim();
    const hours = (row.hours ?? "").trim();
    if (!days && !hours) continue;
    if (/^closed$/i.test(hours)) {
      notes.push(`"${days}" (${hours}) contributes no days`);
      continue;
    }
    if (/^every\s+day$/i.test(days)) {
      for (const day of WEEK) offered.add(day);
      notes.push(`"${days}" (${hours}) contributes the whole week`);
      continue;
    }
    const tokens = days.split(",").map((t) => t.trim()).filter(Boolean);
    const read: string[] = [];
    let readable = tokens.length > 0;
    for (const token of tokens) {
      if ((WEEK as readonly string[]).includes(token)) {
        read.push(token);
        continue;
      }
      const range = /^([A-Za-z]{3})\s*[–—-]\s*([A-Za-z]{3})$/.exec(token);
      const from = range ? WEEK.indexOf(cap(range[1]!) as (typeof WEEK)[number]) : -1;
      const to = range ? WEEK.indexOf(cap(range[2]!) as (typeof WEEK)[number]) : -1;
      if (from < 0 || to < 0 || to < from) {
        readable = false;
        break;
      }
      for (let i = from; i <= to; i++) read.push(WEEK[i]!);
    }
    if (!readable) {
      notes.push(`"${days}" (${hours}) is a rule we cannot read as days and times, so it offers no days (a gap is never filled with a guess)`);
      continue;
    }
    for (const day of read) offered.add(day);
    notes.push(`"${days}" (${hours}) is open, so it offers ${read.join(", ")}`);
  }

  const days = WEEK.filter((d) => offered.has(d));
  const basis =
    notes.length === 0
      ? "the record carries no hours row, so no day is stated as open and no preferred-days control is offered (lead ruling 8)."
      : `${days.length > 0 ? "Offered" : "Offered no days"} — preferred days come only from the days a recorded hours row states as open (lead ruling 8): ${notes.join("; ")}.`;
  return { days, basis };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ------------------------------------------------------------------- the field sets */

interface FieldBase {
  name: string;
  id: string;
  control: FieldControl;
  labelKey: keyof FormLabels;
  collects: string;
  whenGiven?: string;
  autocomplete?: string;
  rows?: number;
}

/**
 * A field the visitor must supply: no `(optional)` marker, `required` on the control.
 */
function required(base: FieldBase, manifest: string): FieldSpec {
  return { ...base, optional: false, required: true, manifest };
}

/**
 * A field the visitor may skip. `whenGiven` is the clause the privacy notice adds, and
 * it is part of the field rather than of the notice so the two cannot disagree.
 */
function optional(base: FieldBase, manifest: string): FieldSpec {
  return { ...base, optional: true, required: false, manifest };
}

/**
 * A control that always sends a value but cannot be `required`: a select whose default
 * is one of its own options (the visitor answers by leaving it alone), or a radio group
 * with a checked default. It is named in the notice among what is collected, because it
 * is collected.
 */
function alwaysSent(base: FieldBase, manifest: string, options: string[], preselected?: string): FieldSpec {
  return { ...base, optional: false, required: false, options, preselected, manifest };
}

const NAME: FieldBase = {
  name: "name",
  id: "cf-name",
  control: "text",
  labelKey: "fieldName",
  collects: "name",
  autocomplete: "name",
};

const EMAIL: FieldBase = {
  name: "email",
  id: "cf-email",
  control: "email",
  labelKey: "fieldEmail",
  collects: "email address",
  // Required where it is the way we can answer (the inquiry family), optional on an
  // appointment page — and `whenGiven` matters only in the second case: the notice may
  // not claim to record an address a visitor can leave blank.
  autocomplete: "email",
  whenGiven: "if you give one",
};

const PHONE: FieldBase = {
  name: "phone",
  id: "cf-phone",
  control: "tel",
  labelKey: "fieldPhone",
  collects: "phone number",
  autocomplete: "tel",
  // The same field, required by one family and optional by the other (lead ruling 1 of
  // 30 Sept): Family A needs a number to ring back, Family B may answer by email. The
  // hedge prints only where the field is optional.
  whenGiven: "if you give one",
};

/** The categories whose page asks a quoted job where it is: a site visit's first question. */
const SITE_JOB_PROFILES = ["trades", "landscaping"];

/** The categories whose page asks whether the visitor has been before. */
const CLINICAL_PROFILES = ["dental", "health"];

/**
 * The field set one build carries: the family's fields, minus everything the record
 * cannot support, with the omission and its reason recorded.
 *
 * The derived data comes in rather than being re-derived here (`services`, `days`,
 * `emergencyService`), so this file stays pure data and the one place that reads the
 * record is `familyFields()` in `copy.ts`.
 */
export function formFieldSets(vars: {
  family: ConversionFamily;
  profileKey: string;
  services: string[];
  days: OpenDays;
  emergencyService: boolean;
  labels: FormLabels;
}): FamilyFields {
  const { family, profileKey, services, days, emergencyService, labels } = vars;
  const omitted: OmittedField[] = [];
  const hasServices = services.length > 0;
  const clinical = CLINICAL_PROFILES.includes(profileKey);
  const siteJob = SITE_JOB_PROFILES.includes(profileKey);

  if (family === "appointment") {
    const group2: FieldSpec[] = [];

    if (hasServices) {
      group2.push(
        alwaysSent(
          {
            name: "service",
            id: "cf-service",
            control: "select",
            labelKey: "fieldService",
            collects: "preferred service",
          },
          `service (select; the record's ${services.length} recorded service${services.length === 1 ? "" : "s"} plus "${labels.optionNotSure}")`,
          [...services, labels.optionNotSure],
          // The no-JS default: "Not sure" is the one answer that asks nothing of the
          // visitor and promises nothing about the business. The service cards'
          // "Request this" link preselects a recorded service with JavaScript on.
          labels.optionNotSure,
        ),
      );
    } else {
      omitted.push({
        field: labels.fieldService,
        why: "the record lists no services, so a select of one invented option would ask nothing — the missing list is a gap, and a gap is never filled with generic copy",
      });
    }

    if (days.days.length > 0) {
      group2.push(
        alwaysSent(
          {
            name: "days",
            id: "cf-days",
            control: "checkbox",
            labelKey: "fieldPreferredDays",
            collects: "preferred day or days",
          },
          `preferred days (checkbox group; only the days a hours row states as open: ${days.days.join(", ")})`,
          days.days,
        ),
      );
    } else {
      omitted.push({ field: labels.fieldPreferredDays, why: `${days.basis} The group — legend included — therefore does not exist.` });
    }

    group2.push(
      alwaysSent(
        {
          name: "time",
          id: "cf-time",
          control: "radio",
          labelKey: "fieldPreferredTime",
          collects: "preferred time",
        },
        `preferred time (radio; "${labels.optionNoPreference}" is checked in the HTML, so a no-JS submission is valid and the question can be skipped honestly)`,
        [labels.optionMorning, labels.optionAfternoon, labels.optionNoPreference],
        labels.optionNoPreference,
      ),
    );

    if (clinical) {
      const beenBefore = optional(
        {
          name: "been_before",
          id: "cf-been-before",
          control: "radio",
          labelKey: "fieldBeenBefore",
          collects: "answer about whether you have been before",
        },
        `been here before (radio; offered for the ${profileKey} category only)`,
      );
      beenBefore.options = [labels.optionYes, labels.optionNo];
      group2.push(beenBefore);
    } else {
      omitted.push({
        field: labels.fieldBeenBefore,
        why: `the "${profileKey}" category is not one of the clinical profiles (${CLINICAL_PROFILES.join(", ")}) the question belongs to`,
      });
    }

    group2.push(
      optional(
        {
          name: "message",
          id: "cf-message",
          control: "textarea",
          labelKey: "fieldExtra",
          collects: "message",
          whenGiven: "if you add one",
          rows: 5,
        },
        "message (optional; the record needs no note from the visitor, so the field asks for one rather than requiring it)",
      ),
    );

    return withFields({
      family,
      groups: [
        {
          legend: labels.legendYourDetails,
          fields: [required(NAME, "name (required)"), required(PHONE, "phone (required)"), optional(EMAIL, "email (optional)")],
        },
        { legend: labels.legendTheAppointment, fields: group2 },
      ],
      fields: [],
      omitted,
      preferredDays: days,
    });
  }

  /* family === "inquiry" */
  const group1: FieldSpec[] = [
    required(NAME, "name (required)"),
    required(EMAIL, "email (required)"),
    optional(PHONE, "phone (optional)"),
    {
      ...optional(
        {
          name: "preferred_contact",
          id: "cf-preferred-contact",
          control: "radio",
          labelKey: "fieldReachYou",
          collects: "preference for how you are contacted",
        },
        `preferred contact (radio; the two routes this form carries)`,
      ),
      options: [labels.optionEmail, labels.optionPhone],
    },
  ];

  const group2: FieldSpec[] = [];

  if (hasServices) {
    group2.push({
      ...alwaysSent(
        {
          name: "service",
          id: "cf-service",
          control: "select",
          labelKey: "fieldJobType",
          collects: "type of job",
        },
        `type of job (select; the record's ${services.length} recorded service${services.length === 1 ? "" : "s"} plus "${labels.optionSomethingElse}")`,
        [...services, labels.optionSomethingElse],
      ),
    });
  } else {
    omitted.push({
      field: labels.fieldJobType,
      why: "the record lists no services, so a select of one invented option would ask nothing — the missing list is a gap, and a gap is never filled with generic copy",
    });
  }

  if (siteJob) {
    group2.push(
      optional(
        {
          name: "job_location",
          id: "cf-job-location",
          control: "text",
          labelKey: "fieldJobLocation",
          collects: "job location",
          autocomplete: "postal-code",
          whenGiven: "if you give one",
        },
        `job location (optional; offered for the ${SITE_JOB_PROFILES.join(" and ")} categories, whose work depends on where the site is)`,
      ),
    );
  } else {
    omitted.push({
      field: labels.fieldJobLocation,
      why: `the "${profileKey}" category does not quote a site job, so the question would ask for a place the page has no use for`,
    });
  }

  group2.push(
    required(
      {
        name: "message",
        id: "cf-message",
        control: "textarea",
        labelKey: "fieldJobDescription",
        collects: "description of the job",
        rows: 5,
      },
      "description of the job (required; the whole inquiry is this answer)",
    ),
  );

  const soonOptions = [labels.optionFlexible, labels.optionNextFewWeeks, labels.optionAsSoonAsPossible];
  if (emergencyService) soonOptions.push(labels.optionEmergency);
  else {
    omitted.push({
      field: labels.optionEmergency,
      why: "the record does not carry emergency_service, so the choice is not offered — the page may not imply a service the record does not state",
    });
  }
  group2.push(
    alwaysSent(
      {
        name: "how_soon",
        id: "cf-how-soon",
        control: "select",
        labelKey: "fieldHowSoon",
        collects: "timeframe",
      },
      `how soon (select; ${soonOptions.join(" / ")}${emergencyService ? "" : " — no Emergency option, because the record does not state emergency_service"})`,
      soonOptions,
      labels.optionFlexible,
    ),
  );

  return withFields({
    family,
    groups: [
      { legend: labels.legendYourDetails, fields: group1 },
      { legend: labels.legendAboutTheJob, fields: group2 },
    ],
    fields: [],
    omitted,
    preferredDays: days,
  });
}

/**
 * The same set with `fields` filled in — every field in the order a visitor meets it.
 * Kept as a function so a caller cannot forget it and read an empty list.
 */
export function withFields(set: FamilyFields): FamilyFields {
  return { ...set, fields: set.groups.flatMap((g) => g.fields) };
}

/** The field names a set posts, in order. */
export function fieldNames(fields: FieldSpec[]): string[] {
  return fields.map((f) => f.name);
}

/* -------------------------------------------------------------- the notice's list */

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
 * field to a family's set changes the form, the manifest and the notice in one edit.
 */
export function collectionSentence(fields: FieldSpec[]): string {
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
export function collectionSentenceFrom(names: Iterable<string>, fields: FieldSpec[]): string {
  const set = new Set(names);
  return collectionSentence(fields.filter((f) => set.has(f.name)));
}
