/**
 * Site Sourced — contact-form providers.
 *
 * A static page cannot send email by itself, so the form posts to a relay the
 * client owns. These presets are the ones we evaluated; the record picks one by
 * name and supplies the key. Every fact below was read off the provider's own
 * pages during the evaluation on 28 September 2026 (see README for the caveats) —
 * update this file when a provider changes its pricing.
 *
 * What we will not do, whichever provider is chosen:
 *   - keep a copy of a submission ourselves (no database, no log, no list),
 *   - put the client's email address in the page (the key does the routing),
 *   - leave a visitor with no route when the relay is down (email + phone are
 *     always printed next to the form).
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
  needs_account: string;
  who_owns_the_account: string;
  free_tier: string;
  if_it_lapses: string;
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
    url: "https://web3forms.com/",
  },
  formspark: {
    key: "formspark",
    label: "Formspark",
    endpoint: "https://submit-form.com/{key}",
    hiddenFields: ({ business }) => ({ _subject: `Website enquiry from ${business} (Site Sourced demo)` }),
    encode: "form",
    // Verified from formspark.io/pricing on 2026-09-28.
    stores_submissions: "yes — a submission archive is held on the provider's side (shown in their dashboard)",
    needs_account: "yes — a free account (email sign-in) creates the form id",
    who_owns_the_account: "the client: the account is theirs and the form id belongs to it",
    free_tier: "free plan: 250 submissions, 10 forms; extra volume is a one-time data bundle, never a subscription",
    if_it_lapses: "submissions are refused once the free allowance is spent; the printed email address and phone number still work",
    url: "https://formspark.io/pricing",
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
 * `form_access_key` reads the value from the environment, so a real key never has
 * to be committed to the repository.
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
      warning = `form key: environment variable ${name} is not set — the bundle was written with the placeholder ${KEY_PLACEHOLDER}, so the form will not deliver until it is set.`;
    }
  }
  if (!key && provider.key !== "relay") {
    key = KEY_PLACEHOLDER;
    warning = `form key: no form_access_key in the record — the bundle was written with the placeholder ${KEY_PLACEHOLDER}.`;
  }

  let endpoint = key === KEY_PLACEHOLDER && provider.key === "formsubmit" ? provider.endpoint : provider.endpoint;
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
