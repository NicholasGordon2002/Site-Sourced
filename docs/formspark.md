# Formspark — what it actually does with a submission

Read on 2026-09-28, from Formspark's own pages. Every claim below is quoted or
paraphrased from one of the sources listed at the end. The provider-facing
strings in `src/demo/forms.ts` and the visitor-facing sentence in
`src/demo/copy.ts` are built from this file — change one, change the others.

**Account / form in use:** form name `Site Sourced demo form (MVP test)`,
form id `nsPQBCgbx`, endpoint `https://submit-form.com/nsPQBCgbx`.
The id lives in the gitignored `pipeline/.env.local` as
`SS_FORMSPARK_FORM_ID`; the records reference it as
`"form_access_key": "env:SS_FORMSPARK_FORM_ID"`, so a form can be swapped per client
without editing code. **No credential is in git — but this document is tracked, and
it does name the form id and the recipient address** (above, and again in the source
list at the end). Neither is a secret: the id is the endpoint URL of every published
demo page, and the address is our own working inbox. Nothing else credential-shaped
is stored here, and no API key or token appears anywhere in this file.

## Does it deliver email on the free plan?

Yes. The free workspace's Notifications panel reads `1 recipient — Active`, and
the recipient list is `site-sourced-311e0184@ctomail.io (member)`. Recipients are
per form: Formspark's docs say to manage them in *that form's* Settings section,
ticking workspace team members or adding "guests" outside the workspace. Nothing
in the limits page restricts notifications on the free plan — only the paid
features (autoresponder, branding removal, REST API, custom templates) are
gated.

## The free tier

> "Submissions 250 · Forms 10 · Team members 5 · Submission archive Forever"

> "Every accepted submission spends one submission from its workspace. Submissions
> rejected as spam do not count against your total."

> "Formspark does not cut you off at exactly zero. There is a small buffer past the
> end of your submissions, and recent submissions that arrive beyond it are held
> back rather than discarded. Purchasing a new bundle releases the held
> submissions straight into your inbox."

Bundles are a one-off purchase and "do not expire"; there is no subscription.
Everything is per workspace.

## Does it store the message body, and for how long?

Yes — and this is the part that changes what our demo page is allowed to say.

Privacy policy, "Data we handle for our customers" table:

| Field | Retention |
| --- | --- |
| Submission content — "every field a form's visitor fills in", purpose "Deliver submissions to the customer who owns the form" | "Until the customer deletes it. Deleted submissions stay recoverable for 30 days" |
| Submitter IP address | 12 months |
| Approximate location derived from an IP address | 12 months |
| Request metadata (user agent, referring page, origin) | "With the submission it belongs to" |
| Filtered (spam-held) submissions | 12 months; "visible to the customer for 30 days" |
| Notification recipients | until the customer removes the address or the account is deleted |
| Export files | 7 days |

Also: "If you delete your account, we remove your workspaces and their
submissions straight away." Formspark is the *processor*; the account holder is
the controller. Data is stored in Ireland and Germany (Trampoline Software SRL,
Belgium).

## Can storage be switched off?

No. There is no "do not store" setting anywhere in the form settings — the
settings screen offers Notifications, Autoresponder, Integrations, Spam
protection, and (at the bottom) `Delete all submissions` / `Delete form`. The
archive is the product. Deletion is manual or programmatic
(`DELETE /forms/{formId}` deletes the form and its submissions;
`DELETE /submissions/{submissionId}` deletes one; spam-quarantined submissions
"expire on their own and cannot be deleted early").

The only submissions Formspark will *not* save at all are empty ones, ones whose
spam verification failed, and ones that trip the honeypot: "Formspark will not
save submissions, send notifications or decrement your submission counter if any
of the following conditions are true: the submission is empty; the spam
protection verification was unsuccessful; the submission contains a honeypot."

## Is the recipient configurable per form?

Yes — per form, in the dashboard (see above). It is not a field in the POST body,
so the business's address never appears in the page source.

## Consequences for our copy

The old line under the form — "Site Sourced only passes it along and doesn't keep
or use it for anything else" — was written for a forward-only relay and is **not
true of Formspark**: the message sits in the client's Formspark account until the
client deletes it. It is still true that *Site Sourced* never receives a copy, so
the notice now reads (built in `src/demo/copy.ts` from the provider preset):

> This form sends your message to {business} through Formspark, the form service
> set up in {business}'s own account. Formspark emails it to {business} and also
> keeps a copy in {business}'s own Formspark account until {business} deletes it.
> Site Sourced never receives a copy of it and never uses your details for
> anything else.

If we move a client to a forward-only provider (Web3Forms, StaticForms), the
sentence shortens automatically — it is generated, not hand-written.

## Useful behaviour for the hand-over pack

- **Replying works.** The submission body contains a field named `email`, and
  Formspark treats `mail`, `email`, `_replyto` or `_email.replyto` as the reply
  address: "From your email inbox, you can directly reply to the person who
  submitted the form."
- **Honeypot.** A hidden field named `_honeypot` or `_gotcha` (we use `_gotcha`)
  silently discards bot submissions — and such a submission is not counted
  against the allowance.
- **Notification title.** Set with a hidden field `_email.template.title`; there
  is no documented `_subject` field, which is why we do not use one.
- **Formspark branding** on notification emails cannot be removed on the free
  plan.

## Open gaps in this record — named rather than papered over

Recorded 4 October 2026, with the privacy-notice wording pass. None of these is a
claim we make; each is a limit of what this file can support.

- **The provider's own response page.** With JavaScript off (or when the fetch is
  blocked and `site.js` falls back to a plain form post), the browser *navigates to
  Formspark's own page*. We have never read what that page sets or loads. The privacy
  notice's sentence is therefore scoped to "on this page" — and the scope is enforced:
  `externalReferenceProblems` in `src/demo/build.ts` fails a bundle that loads
  anything from another origin, carries an inline script, or runs a script other
  than its own `site.js`.
- **Our own mailbox.** A notification copy also lands in the working inbox
  (`site-sourced-311e0184@ctomail.io`), hosted by a provider we have not researched.
  The notice says the message is kept in the form service's account; it says nothing
  about the mailbox, which is a gap rather than a clearance.
- **Exports.** Formspark keeps export files 7 days, and an export we made would be a
  copy we hold. We export nothing today, so the notice claims nothing about exports.
  Anyone who starts exporting changes what the notice may say.
- **Collection facts are Formspark's.** The IP address, approximate location and
  request metadata are recorded in Formspark's own policy table (above). Our record
  says nothing about IP or metadata handling by Web3Forms, StaticForms or FormSubmit,
  so those presets carry `collection_extra: []` and their notice claims nothing
  beyond what the visitor typed. A forward-only provider's notice cannot carry the
  Formspark sentence until that research exists.
- **Deleting a quarantined submission.** "cannot be deleted early" is Formspark's
  wording; whether the paid REST API can remove a quarantined submission is
  unverified. The notice prints only the provider's own statement, never a route we
  have not confirmed.

## Sources (all fetched 2026-09-28)

- https://formspark.io/legal/privacy-policy/ (effective 22 August 2026)
- https://formspark.io/pricing/
- https://documentation.formspark.io/troubleshooting/limits-and-plans.html
- https://documentation.formspark.io/dashboard/email-notification-settings.html
- https://documentation.formspark.io/setup/spam-protection.html
- https://documentation.formspark.io/customization/direct-replies.html
- https://documentation.formspark.io/customization/notification-email.html
- https://documentation.formspark.io/api/reference.html
- dashboard.formspark.io — form `nsPQBCgbx`, Settings → Notifications (recipient list)
