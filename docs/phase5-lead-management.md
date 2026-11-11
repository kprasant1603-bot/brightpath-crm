# Phase 5 lead management notes

## Phone number entry

Phone numbers are stored as E.164. A 10-digit number without a country prefix is interpreted as an Indian number and receives `+91`. A number for any other country must include its explicit `+` country code and already use a valid international number format. This lightweight client normalizer removes spaces, parentheses, periods, and hyphens; it does not infer non-Indian national numbering plans, extensions, or trunk prefixes. If it cannot normalize a value, the form explains the accepted formats and does not submit it.

## Lost reason codes

The form uses only the Phase 3 migration's allowed values, with the codes displayed verbatim:

- `not_interested`
- `no_response`
- `chose_competitor`
- `not_eligible`
- `other`

## Fictional development seed

See [phase5-fictional-lead-seed.sql](./phase5-fictional-lead-seed.sql) for an optional SQL Editor snippet that associates three clearly fictional leads with the existing admin, manager, and counsellor test profiles. It is not run by the app and was not executed as part of this phase. Verify the three profile roles before running it. Run only on the development project.
