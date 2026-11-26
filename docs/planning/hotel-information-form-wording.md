# Hotel Information Form: draft wording for approval

> **Status:** draft, 23 November 2026, for counsel's review and AMPM's approval (gate HF-G2 in [hotel-information-form-plan.md](hotel-information-form-plan.md)). Nothing here is live.
> Each text gets a version constant in `packages/core`. Changing a text means a new version, and the API refuses a stale one with "The form was updated. Please reload."

Placeholders are in angle brackets. The help contact and the reply-to are AMPM's admin mailbox for now (decision 21).

## 1. Privacy notice for the people who fill in the form

Version `hf-notice-2026-11-25` (core `HOTEL_FORM_NOTICE_VERSION`). It is shown on the welcome page (HF-01), and must be accepted before a code is issued.

> **How AMPM uses what you give us**
>
> AMPM plans weddings and recommends hotels to its clients. This form collects information about your hotel so that AMPM can describe it accurately.
>
> **What we collect**
>
> - **About you:** your name, your designation and your mobile number.
> - **About the hotel:** the hotel's details and the files you upload. These include the people you name as contacts.
> - **Technical records:** the time of each step, your network (IP) address and your browser type. We use these to keep the form secure.
>
> **Who sees it**
>
> - **AMPM's Hotel team** reviews everything before any of it is used.
> - **Anyone who has this hotel's link.** They can open the form and see what you and your colleagues have entered, so share the link only with colleagues who are helping.
> - **AMPM's clients** see only the hotel details that AMPM approves and publishes. If you say Yes below, that can include photographs. Clients never see your own details, menus or prices.
>
> **Companies that process it for us**
>
> - our hosting provider and its backup service;
> - Resend, for emails;
> - Cloudflare, for the check that you are not a robot;
> - our text-message provider, once text messages are in use.
>
> **How long we keep it**
>
> - code records and network addresses: 12 months;
> - your details on a request that expires without being submitted: 12 months after it expires;
> - rejected or cancelled requests, and files we decline: 12 months;
> - once AMPM has used a submission, your personal details are masked after 24 months.
>
> Nothing is deleted without a review by AMPM.
>
> **Your choices**
>
> - You can correct your details while the form is open.
> - After you submit, the status page lets you withdraw your consent or ask us to remove your details.
> - You can also write to <AMPM help contact>, who handles questions and complaints about personal data.
> - This notice is in English. Ask us for it in another Indian language and we will provide it.
>
> - [ ] I have read this notice and agree to AMPM using my details as described.

## 2. Notice to a contact named in the form

This is an email, sent when an AMPM reviewer adds the person as a hotel contact. The subject is "AMPM has added you as a contact for <catalogue hotel name>". The email carries no text the hotel typed.

> Hello,
>
> <Hotel name>, through its staff, gave AMPM your name and work contact details. AMPM has saved them as a contact for the hotel, so that its team can reach you about weddings and events.
>
> Only AMPM's staff can see these details; AMPM's clients cannot. AMPM keeps them while it works with the hotel.
>
> If you do not want AMPM to keep your details, or something is wrong, reply to this email or write to <AMPM help contact>, and we will correct or remove them.
>
> AMPM

## 3. Accuracy confirmation (question 7.4)

Version `hf-accuracy-2026-11-26` (core `HOTEL_FORM_ACCURACY_VERSION`). It is a required tick on the review page (HF-06), recorded against the submitted revision.

> - [ ] I confirm that the information in this form is correct to the best of my knowledge. I am authorised by the hotel to share it, including the work contact details of the people named in it.

## 4. Display authorisation (question 7.5, reworded)

Version `hf-display-2026-11-26` (core `HOTEL_FORM_DISPLAY_VERSION`). It is an explicit Yes or No on the review page (HF-06), never pre-selected, and recorded against the submitted revision.

> **May AMPM show your hotel's details to its clients?**
>
> If you say Yes, AMPM may show its registered clients the hotel details and photographs that AMPM has reviewed and approved. Menus and price lists stay private to AMPM. Clients see prices only after AMPM has confirmed them with the hotel.
>
> If you say No, AMPM uses the information only for its own planning and shows none of your photographs.
>
> ( ) Yes ( ) No

## 5. Points for counsel

1. **The lawful basis for the named contacts.** The hotel supplies their details, so they are not the person accepting the notice. AMPM's approach is a notice email (section 2), with reply-to removal.
2. **Minimum retention for logs.** Check the CERT-In direction of April 2022 (180 days for ICT logs) and the DPDP Rules, before the first clean-up.
3. **On-screen codes.** Until a text-message provider is wired, the one-time code is shown on screen, and anyone with the hotel's link can take part (decision 4). The notice says that anyone with the link can see what is entered. Check whether that is enough.
4. **The help contact.** It is the admin mailbox for now. Name the grievance officer, if one is required.
