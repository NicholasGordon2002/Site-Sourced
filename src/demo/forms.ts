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
  /** How the browser should encode the POST. */
  encode: "json" | "form";
  /** Whether a submission is stored by the provider. */
  stores_submissions: string;
  /**
   * What is left of a submission after we delete it there — one plain sentence the
   * privacy notice prints, so the page states the provider's own post-deletion
   * behaviour rather than promising an erasure the provider does not make.
   */
  post_deletion: string;
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
      subject: `Website enquiry from ${business} (Site Sourced demo)`,
      from_name: `${business} website`,
    }),
    encode: "json",
    // Read from web3forms.com's own documentation. Their stated model: the access
    // key is tied to the recipient address, and submissions are forwarded, not kept.
    stores_submissions: "no — the provider states submissions are forwarded to the recipient and not stored (no dashboard, nothing to delete)",
    needs_account: "no account — one access key, created by entering the recipient's email address once",
    who_owns_the_account: "the client: they create the access key with their own address, so it is theirs to rotate or revoke",
    free_tier: "free plan: 250 submissions per month, no card, no monthly bill",
    if_it_lapses: "the form stops delivering; the page still shows the client's email address and phone number, so an enquiry is never lost",
    post_deletion: "the relay states it forwards the message and keeps no copy, so there is nothing of yours left there to delete",
    visitor_storage: ({ party }) => `The form passes your message to ${party} by email; the relay does not keep a copy.`,
    url: "https://web3forms.com/",
  },
  formspark: {
    key: "formspark",
    label: "Formspark",
    endpoint: "https://submit-form.com/{key}",
    hiddenFields: ({ business }) => ({
      // The only documented way to set the notification email's title. Formspark
      // reads any field name starting with `_` as an instruction, not content.
      "_email.template.title": `Website enquiry from ${business} (Site Sourced demo)`,
    }),
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
    post_deletion: "formspark keeps a deleted submission recoverable for a further 30 days under its own policy",
    visitor_storage: ({ party }) =>
      `Formspark emails it to ${party} and also keeps a copy in ${party}'s own Formspark account until ${party} deletes it.`,
    url: "https://documentation.formspark.io/",
  },
  staticforms: {
    key: "staticforms",
    label: "StaticForms",
    endpoint: "https://api.staticforms.xyz/submit",
    hiddenFields: ({ business, key, recipient }) => ({
      accessKey: key,
      subject: `Website enquiry from ${business} (Site Sourced demo)`,
      replyTo: "@",
      to: recipient,
    }),
    encode: "json",
    stores_submissions: "no — the provider states submissions are emailed on and not stored",
    needs_account: "no account — one access key, tied to the recipient's email address",
    who_owns_the_account: "the client: they generate the key with their own address",
    free_tier: "free plan (low monthly submission cap); paid plans exist but are not needed at a small business's volume",
    if_it_lapses: "the form stops delivering; the printed email address and phone number still work",
    post_deletion: "the relay states it emails the message on and keeps no copy, so there is nothing of yours left there to delete",
    visitor_storage: ({ party }) => `The form passes your message to ${party} by email; the relay does not keep a copy.`,
    url: "https://www.staticforms.xyz/",
  },
  formsubmit: {
    key: "formsubmit",
    label: "FormSubmit",
    endpoint: "https://formsubmit.co/ajax/{recipient}",
    hiddenFields: ({ business }) => ({ _subject: `Website enquiry from ${business} (Site Sourced demo)` }),
    encode: "json",
    stores_submissions: "no dashboard, but the recipient address sits in the page source where scrapers can read it",
    needs_account: "no account — but the first submission needs a one-click activation email from the recipient",
    who_owns_the_account: "nobody — the address itself is the credential, which is also its weakness",
    free_tier: "free, no published monthly cap",
    if_it_lapses: "the form stops delivering; the printed email address and phone number still work",
    post_deletion: "the relay has no dashboard, so no copy of your message is left there after delivery",
    visitor_storage: ({ party }) => `The form emails your message to ${party}; there is no dashboard holding a copy.`,
    url: "https://formsubmit.co/",
  },
  relay: {
    key: "relay",
    label: "self-hosted / test relay",
    endpoint: "{endpoint}",
    hiddenFields: ({ business }) => ({ subject: `Website enquiry from ${business} (Site Sourced demo)` }),
    encode: "json",
    stores_submissions: "depends entirely on the endpoint — a relay we run ourselves must not keep the message body",
    needs_account: "no",
    who_owns_the_account: "whoever runs the endpoint",
    free_tier: "n/a",
    if_it_lapses: "the form stops delivering; the printed email address and phone number still work",
    post_deletion: "the endpoint this site was built with keeps no copy of the message body",
    visitor_storage: ({ party }) =>
      `The form posts your message to the endpoint this site was built with, a self-hosted relay run by ${party} — no commercial form service is involved.`,
    url: "",
  },
};

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
