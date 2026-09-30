/**
 * Site Sourced — who a demo's contact form actually reaches.
 *
 * A generated page carries a notice above the form saying where a visitor's
 * message goes. That notice is a claim we publish, so it must not be a matter of
 * someone remembering which phase we are in: it is **derived from the record**,
 * and the derivation is written into the bundle manifest.
 *
 * Two phases exist, and only two:
 *
 *   `business`  the form delivers to the business's own published contact
 *               address — the real-prospect case. The notice may say the message
 *               goes to the business, through an account the business owns.
 *   `demo`      the form delivers anywhere else (our own test inbox, a local
 *               test relay, a colleague's address). The page is a demonstration
 *               and must say so: the message comes to Site Sourced, the business
 *               has not seen the page and does not receive the message.
 *
 * The comparison is `form_recipient` against the record's published `email` —
 * the address that is printed on the page as the business's. Anything else is
 * the `demo` phase, which is the fail-safe direction: an unset or mismatched
 * address can only ever make the page say *less* about the business, never more.
 *
 * `record.form_delivery` exists only as an **assertion the record makes about
 * itself** (see the guard in build.ts). It never chooses the notice: if it
 * disagrees with the derivation, the build fails rather than publishing either
 * version.
 */

import { normaliseAddress } from "./addresses.ts";
import type { ResolvedForm } from "./forms.ts";
import type { BusinessRecord, FormDeliveryClaim } from "./types.ts";

/**
 * Re-exported from `addresses.ts`, where the one undeliverable-address predicate now
 * lives so that the form's recipient and every address printed on a page cannot drift
 * apart. Kept exported here because callers and tests have always reached for it here.
 */
export { isUndeliverable, normaliseAddress } from "./addresses.ts";

export type FormDeliveryMode = "business" | "demo";

export interface FormDelivery {
  mode: FormDeliveryMode;
  /** The party the visitor's message actually reaches: the business, or us. */
  party: string;
  /** The address the resolved endpoint delivers to, as the record wrote it. */
  recipient: string;
  /** The business's own published address, when the record has one. */
  business_address: string;
  /** What the record asserts about itself, when it says anything. */
  claimed_by_record: FormDeliveryClaim | null;
  /** Plain-English reason for the determination — carried into the manifest. */
  basis: string;
}

/** The demo operator, as the page names it to a visitor. */
export const DEMO_OPERATOR = "Site Sourced";

/** What a record may assert about the form's delivery phase. */
export const DELIVERY_CLAIMS: FormDeliveryClaim[] = ["business", "demo"];

export function isDeliveryClaim(value: unknown): value is FormDeliveryClaim {
  return typeof value === "string" && (DELIVERY_CLAIMS as string[]).includes(value);
}

/**
 * Decide which notice the page carries, from the record alone.
 *
 * Never throws: an odd record produces the `demo` notice and a `basis` sentence
 * that says why, and the guard in `build.ts` decides whether that is publishable.
 */
export function resolveDelivery(record: BusinessRecord, form: ResolvedForm): FormDelivery {
  const recipient = form.recipient ?? "";
  const recipientKey = normaliseAddress(recipient);
  const published = normaliseAddress(record.email);
  const claimed = isDeliveryClaim(record.form_delivery) ? record.form_delivery : null;

  const base = {
    recipient,
    business_address: record.email ?? "",
    claimed_by_record: claimed,
  };

  if (!recipientKey) {
    return {
      ...base,
      mode: "demo",
      party: DEMO_OPERATOR,
      basis: `the record's form_recipient is empty, so the form delivers to nobody`,
    };
  }
  if (!published) {
    return {
      ...base,
      mode: "demo",
      party: DEMO_OPERATOR,
      basis: `the record carries no published contact address for ${record.name}, so no form built from it can be delivering to the business`,
    };
  }
  if (recipientKey === published) {
    return {
      ...base,
      mode: "business",
      party: record.name,
      basis: `form_recipient (${recipient}) is the business's own published contact address (${record.email}), so the form delivers to the business itself`,
    };
  }
  return {
    ...base,
    mode: "demo",
    party: DEMO_OPERATOR,
    basis: `form_recipient (${recipient}) is not the business's published contact address (${record.email}), so the form does not deliver to the business`,
  };
}

/**
 * The form's own guard-rail problems, as sentences a build can print.
 *
 * Called from the single compliance self-check in `build.ts` — this is not a
 * second guard, it is the form half of the one that already exists. Every
 * problem below is a case where a bundle would tell a visitor something untrue
 * about where their message went:
 *
 *   - the endpoint is not configured (the plan's rule: an unconfigured form
 *     endpoint must fail the build before it can reach a public path),
 *   - the record asserts delivery to the business while delivering elsewhere
 *     (or the reverse),
 *   - the notice the page carries does not match the delivery the record and
 *     endpoint actually describe.
 *
 * Whether an address can work at all is **not** decided here. That is one rule
 * covering two addresses — the form's recipient and every address a page prints as a
 * way to reach the business — and it lives in `addresses.ts`, in one function over one
 * predicate, so the two can never drift apart. This function no longer looks at the
 * recipient's shape at all.
 */
export function formDeliveryProblems(vars: {
  record: BusinessRecord;
  form: ResolvedForm;
  /** The mode the page's rendered notice is written for. */
  noticeMode: FormDeliveryMode;
  /** Marker written into an endpoint whose key was never resolved. */
  placeholder: string;
}): string[] {
  const { record, form, noticeMode, placeholder } = vars;
  const problems: string[] = [];

  if (!form.endpoint.trim()) {
    problems.push(`form endpoint is empty: the record sets no endpoint and the provider preset has none, so the form has nowhere to post. A bundle with an unconfigured form endpoint must not reach a public path.`);
  } else if (form.endpoint.includes(placeholder)) {
    problems.push(
      `form endpoint is not configured: it still contains the placeholder ${placeholder}, so the form would post into the void. ` +
        `Set the record's form_access_key (or the SS_FORMSPARK_FORM_ID variable it names in the gitignored .env.local) and rebuild. ` +
        `A bundle with an unconfigured form endpoint must not reach a public path.`,
    );
  } else if (!/^https?:\/\//i.test(form.endpoint)) {
    problems.push(`form endpoint "${form.endpoint}" is not an http(s) URL, so the form cannot post to it.`);
  }

  const actual = resolveDelivery(record, form);

  if (noticeMode !== actual.mode) {
    problems.push(
      noticeMode === "business"
        ? `the form notice tells the visitor the message goes to ${record.name}, but the form is not configured to deliver to the business: ${actual.basis}. ` +
          `A page must not claim business delivery while routing somewhere else.`
        : `the form notice tells the visitor this is a demonstration whose message comes to ${DEMO_OPERATOR}, but the form actually delivers to the business: ${actual.basis}. ` +
          `Fix the record, not the notice.`,
    );
  }

  const claimed = isDeliveryClaim(record.form_delivery) ? record.form_delivery : null;
  if (record.form_delivery !== undefined && claimed === null) {
    problems.push(`form_delivery must be "business" or "demo" (got ${JSON.stringify(record.form_delivery)}). It is an assertion about the form, not a switch: the notice is derived from form_recipient and email either way.`);
  }
  if (claimed && claimed !== actual.mode) {
    problems.push(
      `the record asserts delivery to the ${claimed === "business" ? "business itself" : "demo operator"} ("form_delivery": "${claimed}"), but the resolved endpoint delivers to the other: ${actual.basis}. ` +
        `A record must not be able to claim business delivery while routing to an address that is not the business's — fix form_recipient, or set form_delivery to "${actual.mode}".`,
    );
  }

  return problems;
}
