# AG-SHIELD partner integration guide

**Status: CONTROLLED PREVIEW — NOT CERTIFIED FOR PRODUCTION FINANCIAL DECISIONING**

For the shortest setup, start with the [root README](../README.md). The [developer website](https://agtech-workspace.github.io/ag-shield-partner-sdk/) and [OpenAPI contract](https://agtech-workspace.github.io/ag-shield-partner-sdk/openapi.yaml) require GitHub Pages to be enabled for this repository.

## 1. Obtain authorized access

AG-SHIELD's administrator issues an approved partner tenant key with `verify:read`. Store the key only in server-side secrets. Treat the display-format prefix `sg_live.` as optional; the SDK strips this prefix when preparing its `X-API-Key` request. Keys can be rotated or revoked. Never expose keys in a browser, mobile application, a `VITE_` variable, or GitHub.

## 2. Confirm the actual gateway

**GitHub Pages is documentation, not the backend API.** Obtain the verified deployed Supabase function URL from AG Tech. The SDK accepts a base URL such as `https://<project-ref>.supabase.co/functions/v1` and appends `/risk-check`. The checked-in SDK contains another default Supabase functions-origin format, but operators should explicitly provide a tested URL rather than relying on its default. Validate live partner authentication before onboarding.

## 3. Request contract

`POST /risk-check` with `Content-Type: application/json` and `X-API-Key: <partner key>`.

| Field | Required | Meaning |
| --- | --- | --- |
| `account_number` | Yes | Exactly 10 digits as a string, including leading zeros |
| `bank_name` | Yes | Nonempty bank name, up to 100 characters |
| `amount` | No | Nonnegative NGN amount; default 0 in the current gateway |
| `is_new_recipient` | No | Boolean; default `true` |
| `holder_name` | No | Unverified name hint, **not** account-name confirmation |

## 4. Response interpretation

Successful contract responses contain `risk_level: safe | warning | high_risk`, `risk_score: 0..100`, `recommended_action: ALLOW | REVIEW | BLOCK | FORCE_MANDATORY_SECONDARY_OTP`, `reasons`, and `source_registry`. `confidence_interval` is a legacy scalar field, **not** a statistical confidence interval.

**Do not treat `risk_level: safe` as an independent confirmation of account ownership or a promise that payment is safe.** No negative reports may mean there is insufficient coverage rather than evidence of legitimacy. A numeric score is not a calibrated probability of fraud.

| Outcome | Partner handling |
| --- | --- |
| 200 | Apply independently approved policy; verify evidence quality |
| 400 | Fix request data |
| 401 / 403 | Check key and scope, without exposing credentials |
| 429 | Stop or apply bounded backoff according to your quota policy |
| 500 / 503, malformed response, network error | **UNKNOWN**. Do not treat as safe; use manual review |

Requests may be metered. The SDK defaults to zero automatic retries.

## 5. Automated and live tests

Unit tests simulate provider/gateway behavior and validate SDK error handling. They **do not** establish live uptime, correctness of account names, registry coverage, or fraud-detection performance.

For a real pilot, arrange a fresh partner key and verified gateway URL with AG Tech. Test using an account you own or for which explicit authorization has been provided. Check success, quota exhaustion, invalid credentials, timeout behavior and unknown evidence. Avoid leaking full financial identifiers into public logs or bug reports.

## 6. Account-name resolution is a separate capability

The AG-SHIELD consumer website has a separate authenticated `resolve-account` flow, using bank/provider lookups. It is **not a method in this partner SDK**, and availability varies by provider, supported bank, valid credentials and coverage. We do not promise partner name-resolution functionality or treat `holder_name` as verified. A partner `resolveAccount()` API would require its own scoped authorization, documentation, privacy controls and live tests before release.

## 7. Security, privacy and launch controls

- Keep keys private and rotate any exposed credentials before onboarding.
- Use an appropriate legal basis, transparent notices, data minimization and bounded retention for financial identifiers.
- Assess registry provenance, false positives/negatives and regional bank coverage before automated decisions.
- Audit quotas, key revocation and failures; preserve a human-review path.
- Obtain AG Tech approval for commercial terms, partner policies and service availability expectations.

**Partner contact:** agtechrelations@gmail.com
