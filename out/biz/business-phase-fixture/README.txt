Delivered Fixture Barber Shop — your website files
==================================================

This folder is a complete website. The pages are:

  index.html               the front page
  services.html            everything recorded for the business
  about.html               about the business, its hours and where it is
  contact.html             the contact form
  privacy.html             how a message sent from these pages is handled
  contact-haircut.html     the contact form with "Haircut" already chosen
  contact-beard-trim.html  the contact form with "Beard trim" already chosen
  contact-hot-shave.html   the contact form with "Hot shave" already chosen

The only pages that load site.js are the ones that carry the contact form: contact.html, contact-haircut.html, contact-beard-trim.html and contact-hot-shave.html. Every other page works unchanged with JavaScript switched off.

They all share styles.css (the colours and spacing) and the fonts/ folder. Every link
between them is an ordinary link to a file. There is no database, no content management
system and no server software to keep patched, so nothing here goes stale or needs a
monthly update.

Opening it
----------
Double-click index.html to view it in a browser. To put it on the web, upload the
whole folder to your hosting as it is.

Changing the words
------------------
Open any .html file in a text editor (Notepad, TextEdit, VS Code). Every sentence is
plain text between tags. Change the text between the tags and save — do not change
the tags themselves. For example:

  <h2>Opening hours</h2>   ...change only "Opening hours"

The business name appears in several places (the headers, the footers, the page
titles), so use Find and Replace across all the files to change them at once. The
navigation at the top of every page names the pages — if you rename a file, update the
links on every page that points at it.

The photograph
--------------
The hero picture on this page is an AI-generated illustration (a labelled fallback used
because no suitable free-to-use photograph existed). It is not a photograph of your
business, and the page labels it as an illustration, so the site is honest with visitors
as it stands — nothing here waits on a photograph before it can go live. When you have a
photograph of your own, swap it in and the layout follows automatically: the file is
inside the bundle, so keep the same file name, or update the name in styles.css and
index.html.

The contact form
----------------
The form posts to Formspark. Notifications go to hello@delivered-fixture-barber.ca;
nobody at Site Sourced receives a copy and no list of names is gathered.

  Does it need an account? yes — a free account (email magic-link sign-in) creates the form id
  Whose account is it? whoever's account holds the form — the form id belongs to it, so they can read, export or delete submissions themselves. In a delivered site that is the client's own account; on a demonstration page it is Site Sourced's
  Does the form service keep a copy? yes — the message is kept in the Formspark account that owns the form (dashboard) for as long as that account's holder leaves it there; a deleted submission stays recoverable for a further 30 days
  What does it cost? free plan: 250 submissions, 10 forms, 5 team members; more submissions are a one-off bundle, never a subscription
  If it stops working: the form stops accepting new submissions once the allowance is spent (recent ones are held back rather than discarded, and released by buying a bundle); the printed email address and phone number still work
  Documentation: https://documentation.formspark.io/

The page says the same thing to your visitors, in the line just above the form.
If you change form provider, that line changes with it — do not edit it by hand
without checking what the new provider does with a submission.

The form also shows your email address and phone number, so an enquiry can always
reach you even if the form service is ever down.
One recurring job
-----------------
Your domain name needs renewing once a year. Set it to auto-renew and the website
can sit untouched indefinitely.

Built by Site Sourced
---------------------
These files were built by Site Sourced and are yours outright: no content management
system, no database and no account of ours holds anything they need.
