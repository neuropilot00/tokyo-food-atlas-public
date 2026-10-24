# Frontend validation — 2026-10-24

## Scope and method

This pass reviewed the deployed `public/app.js`, `public/beta-ui.js`, and `public/recommend.js` against the current cold-start data and market API contracts. It exercised the actual manual-property form handler, property application, finance calculations, recommendation evidence, and country switching in a Node VM with small DOM stand-ins.

This is **not a browser screenshot, responsive-layout, authenticated API, or deployed Worker verification**. The independent shell used for this check could not connect to `localhost:4173`; the main implementation thread owns the managed-preview browser and API verification. No live API success is inferred from these tests.

## Commands and results

| Check | Result | What it establishes |
|---|---|---|
| `node --check public/app.js` | Pass | Frontend script parses. |
| `node --check public/beta-ui.js` | Pass | Beta feature script parses. |
| `node --check public/recommend.js` | Pass | Recommendation script parses. |
| `node tests/frontend-validation.cjs` | Pass | Blank versus zero property costs, invalid-result blocking, cost provenance, country isolation, applied-source snapshot, and competition evidence regressions. |
| `node tests/recommend.cjs` | Pass | Existing recommendation, budget, experience, preference, time-window, missing-data, accounting, and input-purity checks. |
| `node tests/finance.cjs` | Pass | Existing break-even and target-profit identities, cash distinction, invalid/overflow values, zero occupancy, and browser/Node module exports. |

A separate rendering smoke check used the real cold-start data for all five main views. Four data-dependent views also rendered with null resident, worker, and flow metrics without exceptions, `NaN`, infinity, or fabricated percentages. Adding 3,000 region objects still produced only eight map candidates. These checks verify bounded rendering logic; they do not measure browser frame rate or network latency.

## Findings and fixes

### Unknown property costs

The manual-property form already preserved an empty rent, management fee, deposit, or transfer fee as `null`; explicit `0` remained zero. `applyProperty()` already replaced missing property costs with null instead of retaining an old estimate. Invalid costs blocked calculation display and saving.

The review found that the internal initial-cash subtotal still used a null-to-zero reduction even when calculation validity was false. It now returns null whenever one of deposit, transfer fee, fit-out, opening costs, or reserve is unknown. Budget remaining is also null until the required cash total is known. Overflow remains an error.

### Property values versus remaining assumptions

The applied-property notice now identifies:

- fields that still equal the stored property record;
- unknown fields that need input;
- fields the user has entered or changed;
- other inputs, such as payroll, ticket price, fit-out, and reserve, which remain editable planning assumptions.

This notice updates with finance input changes. No submitted value is promoted to an independently verified market fact.

### Stable applied-cost snapshot

Previously an additional monthly charge was looked up again from the property list whenever finance was calculated. Removing or updating that record could silently change the calculation even though the user had not changed the plan.

Applying a property now preserves the applied record in the country-specific state. Saved finance plans include that snapshot. A previously applied source charge, such as the JPY 1,100 monthly charge on listing `jp-404586`, remains in the calculation if the listing is subsequently absent from the list. The original listed charges and the user's edited finance inputs remain separate.

### Competition evidence

Recommendation ranking continues to use `usedInScore:false` for competition counts. The review found that the recommendation evidence transformation dropped `quality_flags` and availability metadata, so the source-review badge could disappear in a candidate's detail card.

The evidence now preserves availability and quality flags. Missing rows retain null counts, and reviewed rows display a source-review badge. The detail card uses the evidence's actual reporting quarter instead of a fixed quarter string. The regression verifies that ranking and scores stay unchanged when flagged or missing competition rows are added.

### KRW and JPY separation

The regression switches between countries after changing property inputs. It verifies separate finance storage, JPY recommendation assumptions and currency labels, explicit zero retention, null deposit/transfer values for the Japanese listing, and restoration of the Korean finance inputs. No exchange-rate conversion is performed.

## Remaining integration validation

The main preview/deployment QA still needs to verify real browser rendering, the region and shop APIs using the complete deployed data, same-origin account authentication, encrypted credential storage, real upstream responses, and cloud synchronization across browser sessions. An available button or configured key is not evidence that an upstream provider or property feed is connected.

## Lazy-region restoration and expanded sources

The regression now also selects a non-seed region, persists its `area-snapshot-KR`, reloads the cold-start data, and verifies that the same region remains selected. Saved plans carry an `areaRecord` snapshot and restore the same region even when the country-level snapshot is absent. Legacy `area-record-{country}` caches remain readable. When no valid snapshot exists, the UI keeps a restoration placeholder and calls the exact-ID region API; it does not silently substitute a seed neighborhood or choose a same-named search result.

The first age-band label is now taken from the displayed metric's `sourceAgeLabel` when present. The MOIS administrative resident source therefore displays confirmed 0–19 years, while Seoul trade-area source rows retain their original unverified native age-10 label.

Official shop search counts are labeled as source **records**, keyed by source shop ID. Same-name or same-address records are not silently combined or represented as a count of unique physical businesses. The meal/café/pub chips now appear within the saved investigation section; the official list retains its own explicit filter controls.

The live-population picker reads the independently verified `/seoul-live-areas.json` catalog. Without an eligible configured key, only POI009 can be selected. Selecting another catalog place does not mark the provider connected: the UI displays the returned source observation, mode, and failure status. Browser verification of authenticated non-sample places remains separate from these script checks.

The frontend regression additionally uses mocked provider/catalog responses to verify that a non-sample place is disabled without a configured key, enabled after eligible provider metadata is returned, requested by its exact official code, and displayed with its actual place label and separate-geography notice. This verifies UI control flow only; no mocked response is included in production data or represented as a live upstream test.

## Public-source refresh after snapshot restoration

`afterRender()` now requests the selected region by exact ID once per account, country, and area ID during the page lifetime, including regions already restored from a valid snapshot. A loop-prevention set is populated before the request. A successful response replaces only the selected area's public source data and updates its country snapshot.

Request application checks the captured account ID, account-change epoch, selection-context epoch, country, and area ID. A delayed response cannot overwrite a different account, country, or selection. An absent region, malformed ID match, or failed request preserves the existing source snapshot and date; no unrelated region is substituted.

The refresh does not call `loadCountry()` or replace the user's profile, finance inputs, property, or saved plans. Discovery updates only the region heading, source metrics, and an already-submitted recommendation result. Cost inputs and open dialogs keep their DOM and values. Existing unsubmitted recommendation inputs remain unsubmitted. The area-analysis view can rerender its public charts; official-shop filter drafts are preserved if a changed source coordinate requires refreshing that list.

`node tests/source-refresh.cjs` passes checks for once-only exact-ID requests, null-to-current population replacement, source snapshot persistence, untouched private finance/profile values and open dialog, failure/unknown/wrong-ID retention, and selection/country/account/account-epoch race guards. These are isolated control-flow tests, not live upstream API claims.

The property screen now explicitly labels its cards as the selected region's review workspace plus the country's held reference/manually registered list. Its notice states that this is not a listing search for the selected neighborhood and that addresses must be checked before applying costs.
