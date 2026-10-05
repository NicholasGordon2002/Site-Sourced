/**
 * Site Sourced — contact-form providers.
 *
 * A static page cannot send email by itself, so the form posts to a relay the
 * client owns. These presets are the ones we evaluated; the record picks one by
 * name and supplies the key. Every fact below was read off the provider's own
 * pages on 28 September 2026 — the Formspark rows come from
 * `docs/formspark.md`, which cites the exact pages; update that file and this
 * one when a provider changes its pricing or its retention.
 *
 * What we will not do, whichever provider is chosen:
 *   - keep a copy of a submission ourselves (no database, no log, no list),
 *   - put the client's email address in the page (the key does the routing),
 *   - leave a visitor with no route when the relay is down (email + phone are
 *     always printed next to the form),
 *   - describe the relay as "forwarding only" when it also stores the message.
 *     `visitor_storage` is the sentence the visitor actually reads, so it has to
 *     match what the provider's own privacy policy says.
 */

export interface FormProvider {
  key: string;
  label: string;
  /** Endpoint template. `{key}` and `{recipient}` are substituted from the record. */
  endpoint: string;
  /** What the endpoint needs in the body, beyond the visitor's own fields. */
  hiddenFields: (vars: { recipient: string; business: string; key: string }) => Record<string, string>;
  /**
   * The hidden-field name this provider reads as the notification email's title. It is
   * provider-specific, so the family- and phase-derived subject is set against this key
   * by the build (see `notificationSubject`), never baked into `hiddenFields` where the
   * phase is not yet known.
   */
  subjectField: string;
  /** How the browser should encode the POST. */
  encode: "json" | "form";
  /** Whether a submission is stored by the provider. */
  stores_submissions: string;
  /**
   * How the notice describes this provider to a visitor. Provider-derived, because a
   * hard-coded "a third-party form service" contradicts itself the moment the provider
   * is our own test relay.
   */
  service_descriptor: string;
  /**
   * What the provider itself records **besides** what the visitor typed — the IP
   * address, the approximate location worked out from it, the request metadata. The
   * privacy notice's collection list is built from the form's own rendered fields plus
   * this, so the list cannot understate what is captured. Empty means our provider
   * record says nothing about extra collection, and then the page claims nothing.
   */
  collection_extra: string[];
  /**
   * The provider's own retention facts, one sentence each, sentence case, quoted from
   * `docs/formspark.md`. The notice prints these as their **own sentences** — never
   * glued mid-sentence onto one of ours, which is how a lower-case brand name and a
   * missing full stop reached a published page.
   */
  retention_facts: (vars: { service: string; party: string }) => string[];
  /**
   * The one deletion promise this provider makes impossible, stated honestly — a
   * spam-held submission it will not release early. "" when the provider holds nothing
   * back, because the notice must not invent a limit that does not exist.
   */
  deletion_exception: (vars: { service: string }) => string;
  needs_account: string;
  who_owns_the_account: string;
  free_tier: string;
  if_it_lapses: string;
  /**
   * One plain sentence for the demo page: where the visitor's message ends up.
   * Shown under the form, so it must be true of this provider specifically.
   *
   * `party` is *whoever receives the message and holds the account it lands in* —
   * the business's own name when the form delivers to the business, and
   * "Site Sourced" while the page is still a demonstration (see delivery.ts).
   * The sentence must stay true in both cases: it describes the provider, not
   * the phase.
   */
  visitor_storage: (vars: { party: string }) => string;
  /** Provider documentation, for the hand-over pack. */
  url: string;
}

export const PROVIDERS: Record<string, FormProvider> = {
  web3forms: {
    key: "web3forms",
    label: "Web3Forms",
    endpoint: "https://api.web3forms.com/submit",
    hiddenFields: ({ business, key }) => ({
      access_key: key,
      from_name: `${business} website`,
    }),
    subjectField: "subject",
    encode: "json",
    // Read from web3forms.com's own documentation. Their stated model: the access
    // key is tied to the recipient address, and submissions are forwarded, not kept.
    stores_submissions: "no — the provider states submissions are forwarded to the recipient and not stored (no dashboard, nothing to delete)",
    needs_account: "no account — one access key, created by entering the recipient's email address once",
    who_owns_the_account: "the client: they create the access key with their own address, so it is theirs to rotate or revoke",
    free_tier: "free plan: 250 submissions per month, no card, no monthly bill",
    if_it_lapses: "the form stops delivering; the page still shows the client's email address and phone number, so an enquiry is never lost",
    service_descriptor: "a third-party form service",
    // Our record says nothing about extra collection for this provider (see
    // research/privacy-wording.md, "What could not be confirmed"), so the notice
    // claims nothing beyond the form's own fields.
    collection_extra: [],
    retention_facts: () => ["The relay states it forwards the message and keeps no copy, so there is nothing of yours left there to delete."],
    deletion_exception: () => "",
    visitor_storage: ({ party }) => `The form passes your message to ${party} by email; the relay does not keep a copy.`,
    url: "https://web3forms.com/",
  },
  formspark: {
    key: "formspark",
    label: "Formspark",
    endpoint: "https://submit-form.com/{key}",
    hiddenFields: () => ({}),
    // The only documented way to set the notification email's title: Formspark reads
    // any field name starting with `_` as an instruction, not content. The title
    // itself is set by the build against this key (see `notificationSubject`).
    subjectField: "_email.template.title",
    encode: "form",
    // Sources, all read on 2026-09-28 (see docs/formspark.md for the quotes):
    //   formspark.io/legal/privacy-policy      — retention of submission content
    //   documentation.formspark.io/troubleshooting/limits-and-plans
    //   documentation.formspark.io/dashboard/email-notification-settings
    stores_submissions: "yes — the message is kept in the Formspark account that owns the form (dashboard) for as long as that account's holder leaves it there; a deleted submission stays recoverable for a further 30 days",
    needs_account: "yes — a free account (email magic-link sign-in) creates the form id",
    who_owns_the_account: "whoever's account holds the form — the form id belongs to it, so they can read, export or delete submissions themselves. In a delivered site that is the client's own account; on a demonstration page it is Site Sourced's",
    free_tier: "free plan: 250 submissions, 10 forms, 5 team members; more submissions are a one-off bundle, never a subscription",
    if_it_lapses: "the form stops accepting new submissions once the allowance is spent (recent ones are held back rather than discarded, and released by buying a bundle); the printed email address and phone number still work",
    service_descriptor: "a third-party form service",
    // Quoted from docs/formspark.md, which quotes Formspark's own privacy policy:
    // the IP address and the approximate location derived from it are kept 12 months
    // independently of the message, and request metadata travels with the submission.
    collection_extra: [
      "The form service also records what comes with any web form, without you typing it: your IP address (the number that identifies the connection you are using), an approximate location worked out from that address, and basic request information such as your browser and the page or site you came from.",
    ],
    retention_facts: ({ service }) => [
      `Your message is kept in ${service}'s account until it is deleted there, and ${service} never removes it by itself.`,
      `A message its spam filter sets aside is kept for 12 months and cannot be deleted earlier, and a deleted message stays recoverable in ${service}'s records for a further 30 days.`,
      `${service} also keeps the IP address and approximate location it recorded for 12 months, whether or not your message is still there.`,
    ],
    deletion_exception: ({ service }) =>
      `If ${service}'s spam filter is holding a message, only ${service} can remove it, and ${service} releases it after 12 months.`,
    visitor_storage: ({ party }) =>
      `Formspark emails it to ${party} and also keeps a copy in ${party}'s own Formspark account until ${party} deletes it.`,
    url: "https://documentation.formspark.io/",
  },
  staticforms: {
    key: "staticforms",
    label: "StaticForms",
    endpoint: "https://api.staticforms.xyz/submit",
    hiddenFields: ({ key, recipient }) => ({
      accessKey: key,
      replyTo: "@",
      to: recipient,
    }),
    subjectField: "subject",
    encode: "json",
    stores_submissions: "no — the provider states submissions are emailed on and not stored",
    needs_account: "no account — one access key, tied to the recipient's email address",
    who_owns_the_account: "the client: they generate the key with their own address",
    free_tier: "free plan (low monthly submission cap); paid plans exist but are not needed at a small business's volume",
    if_it_lapses: "the form stops delivering; the printed email address and phone number still work",
    service_descriptor: "a third-party form service",
    collection_extra: [],
    retention_facts: () => ["The relay states it emails the message on and keeps no copy, so there is nothing of yours left there to delete."],
    deletion_exception: () => "",
    visitor_storage: ({ party }) => `The form passes your message to ${party} by email; the relay does not keep a copy.`,
    url: "https://www.staticforms.xyz/",
  },
  formsubmit: {
    key: "formsubmit",
    label: "FormSubmit",
    endpoint: "https://formsubmit.co/ajax/{recipient}",
    hiddenFields: () => ({}),
    subjectField: "_subject",
    encode: "json",
    stores_submissions: "no dashboard, but the recipient address sits in the page source where scrapers can read it",
    needs_account: "no account — but the first submission needs a one-click activation email from the recipient",
    who_owns_the_account: "nobody — the address itself is the credential, which is also its weakness",
    free_tier: "free, no published monthly cap",
    if_it_lapses: "the form stops delivering; the printed email address and phone number still work",
    service_descriptor: "a third-party form service",
    collection_extra: [],
    retention_facts: () => ["The relay has no dashboard, so no copy of your message is left there after delivery."],
    deletion_exception: () => "",
    visitor_storage: ({ party }) => `The form emails your message to ${party}; there is no dashboard holding a copy.`,
    url: "https://formsubmit.co/",
  },
  relay: {
    key: "relay",
    label: "self-hosted / test relay",
    endpoint: "{endpoint}",
    hiddenFields: () => ({}),
    subjectField: "subject",
    encode: "json",
    stores_submissions: "depends entirely on the endpoint — a relay we run ourselves must not keep the message body",
    needs_account: "no",
    who_owns_the_account: "whoever runs the endpoint",
    free_tier: "n/a",
    if_it_lapses: "the form stops delivering; the printed email address and phone number still work",
    // Our own relay is not a third party, whatever the visitor's reading: the sentence
    // the notice prints about it is derived from this descriptor, not hard-coded. The
    // label already says whose relay it is (`providerLabel`), so the descriptor adds
    // only what the label cannot.
    service_descriptor: "not a commercial form service",
    collection_extra: [],
    retention_facts: () => ["The endpoint this site was built with keeps no copy of the message body."],
    deletion_exception: () => "",
    visitor_storage: ({ party }) =>
      `The form posts your message to the endpoint this site was built with, a self-hosted relay run by ${party} — no commercial form service is involved.`,
    url: "",
  },
};

/**
 * The notification email's title, derived from the conversion family and the delivery
 * phase — never hand-written per provider. Family A asks for a time, Family B for a
 * described need; the demo phase names Site Sourced so a received notification cannot
 * be mistaken for a message the business has seen, and the business phase drops that
 * suffix because the message really does reach the business.
 *
 * The per-provider *key* the title is stored under stays provider-specific (see
 * `FormProvider.subjectField`); the build sets it against that key after the delivery
 * is resolved, because `resolveForm` runs before the phase is known.
 */
export function notificationSubject(business: string, family: "appointment" | "inquiry", phase: "demo" | "business"): string {
  const kind = family === "appointment" ? "Appointment request" : "Quote request";
  return phase === "demo" ? `${kind} from ${business} (Site Sourced demo)` : `${kind} from ${business}`;
}

export interface ResolvedForm {
  provider: FormProvider;
  endpoint: string;
  recipient: string;
  key: string;
  hiddenFields: Record<string, string>;
  /** Set when the record's key is still a placeholder or an unset env var. */
  warning: string;
}

export const KEY_PLACEHOLDER = "REPLACE_WITH_PROVIDER_ACCESS_KEY";

/**
 * Turn the record's form fields into a concrete endpoint. `env:NAME` in
 * `form_access_key` reads the value from the environment (the CLI also loads a
 * gitignored `.env.local` — see README), so a real key never has to be committed
 * to the repository.
 */
export function resolveForm(record: {
  name: string;
  form_recipient: string;
  form_provider?: string;
  form_access_key?: string;
  form_endpoint?: string;
}): ResolvedForm {
  const provider = PROVIDERS[record.form_provider ?? "web3forms"] ?? PROVIDERS.web3forms;
  let key = (record.form_access_key ?? "").trim();
  let warning = "";

  if (key.startsWith("env:")) {
    const name = key.slice(4);
    const value = (process.env[name] ?? "").trim();
    if (value) key = value;
    else {
      key = KEY_PLACEHOLDER;
      warning = `form key: environment variable ${name} is not set. The endpoint would carry the placeholder ${KEY_PLACEHOLDER}, which cannot deliver, so the compliance self-check fails the build until it is set.`;
    }
  }
  if (!key && provider.key !== "relay") {
    key = KEY_PLACEHOLDER;
    warning = `form key: no form_access_key in the record. The endpoint would carry the placeholder ${KEY_PLACEHOLDER}, which cannot deliver, so the compliance self-check fails the build.`;
  }

  let endpoint = provider.endpoint;
  if (record.form_endpoint) endpoint = record.form_endpoint;
  endpoint = endpoint
    .replace("{key}", key)
    .replace("{recipient}", encodeURIComponent(record.form_recipient))
    .replace("{endpoint}", record.form_endpoint ?? "");

  return {
    provider,
    endpoint,
    recipient: record.form_recipient,
    key,
    hiddenFields: provider.hiddenFields({ recipient: record.form_recipient, business: record.name, key }),
    warning,
  };
}
