# AG-SHIELD partner integration guide

Status: **PREVIEW / NOT CERTIFIED FOR PRODUCTION DECISIONING**

## 1. Obtain authorized access

AG-SHIELD's administrator creates a tenant and issues a server-side key with the `verify:read` scope through its protected dashboard. Store the key in your server's secrets manager. A key can be revoked or rotated; the full raw token is visible at issuance only. The dashboard may display `sg_live.<raw>`; the SDK strips the display prefix when it sends `X-API-Key`.

**Never** place the partner API key in `VITE_` variables, a GitHub commit, a mobile app, or an HTTP request executed by an end user's browser.

## 2. Select your endpoint

The checked-in SDK defaults to `https://zmiaaxnevvznmvfzlcba.functions.supabase.co`. Supabase's project-function path `https://zmiaaxnevvznmvfzlcba.supabase.co/functions/v1` is also a supported SDK `baseUrl` format (the SDK appends `/risk-check`). **Neither address has been independently verified here to serve the deployed risk-check function successfully.** The operator must confirm the correct URL and staging/production separation before onboarding.

## 3. Request contract

`POST /risk-check` with `Content-Type: application/json` and `X-API-Key: <raw-key>`.

| Field | Required | Meaning |
|---|---|---|
| `account_number` | Yes | Exactly 10 digits as a string, preserve leading zero |
| `bank_name` | Yes | Nonempty bank name, <=100 characters |
| `amount` | No | Nonnegative finite numeric NGN amount; omitted means 0 in the current gateway |
| `is_new_recipient` | No | Boolean; defaults to `true` |
| `holder_name` | No | Unverified name hint, up to 150 characters; NOT name verification |

Do not infer that the account belongs to a real person from an input hint.

## 4. Response contract

A valid success has `risk_level: safe | warning | high_risk`, `risk_score` between 0 and 100, `recommended_action: ALLOW | REVIEW | BLOCK | FORCE_MANDATORY_SECONDARY_OTP`, `reasons: string[]`, and `source_registry: string[]`. `confidence_interval`, despite the name, is a scalar confidence value and **not** a statistical confidence interval. Reported sources and scores require independent provenance and accuracy review before being used for financial decisions.

| Status | Meaning | Partner handling |
|---|---|---|
| 200 | Contract-valid assessment | Apply your independently reviewed policy |
| 400 | Invalid request | Correct request |
| 401 | Unauthorized API key | Check configured key; do not expose it |
| 403 | Missing `verify:read` scope or origin restriction | Ask AG Tech to review access |
| 429 | Burst or monthly quota | Stop and respect retry guidance |
| 500 / 503 | Server, database or audit failure | UNKNOWN; hold/review, never SAFE |
| Network failure / malformed JSON | No reliable assessment | UNKNOWN; hold/review, never SAFE |

Requests may be metered. Do not retry automatically without a bounded policy. This SDK defaults to zero retries.

## 5. Automated tests (no secrets required)

The repository has a build-and-test workflow in `.github/workflows/ci.yml`, which runs on every push or pull request. Unit tests intentionally use **synthetic fixtures** for input validation and error handling only. They do not demonstrate bank verification accuracy, live model performance, or production deployment.

## 6. Real partner smoke test (manual only)

**Before testing, fix exposed credentials in the original AG-SHIELD repo.** Avoid testing with a compromised key.

In the NEW partner repository, open **Settings -> Secrets and variables -> Actions -> New repository secret** and set these values privately:

| Secret | Value |
|---|---|
| `AG_SHIELD_API_KEY` | Fresh valid partner key issued by AG-SHIELD Admin with `verify:read` |
| `AG_SHIELD_BASE_URL` | Verified deployed base URL, e.g. project `/functions/v1` origin (no `/risk-check`) |
| `AG_SHIELD_TEST_ACCOUNT_NUMBER` | A 10-digit account belonging to you or an explicitly consenting test participant |
| `AG_SHIELD_TEST_BANK` | The exact bank name accepted by the deployed gateway |

Use **Actions -> Real API smoke test (manual and consented) -> Run workflow** and confirm authorization. The test makes **one real request**, checks the SDK's response contract, and logs only a redacted PASS/FAIL summary. A passing smoke test proves the endpoint and partner API key respond with a valid contract; it does NOT establish predictive fraud accuracy or account-name verification.

If the test fails, inspect Supabase Edge Functions `risk-check` logs for the same execution without posting raw request bodies or keys in public issues. Fix function deployment, key lookup and RLS/migration discrepancies before inviting partners to send real data.

## 7. Account-name verification is a separate integration

The observed `resolve-account` gateway returned **503** during live testing and is not offered by this SDK. It requires an authorized bank provider, a verified canonical bank code, private provider credentials, secure caching, and a human-reviewed privacy policy. A name hint in `riskCheck` is not a verified account holder. Do **not** market this SDK as verifying names until a real consented provider lookup succeeds.

## 8. Security, privacy and launch gate

- Use your own lawful basis, clear notices, purpose limitation, retention controls and human review of adverse decisions.
- Protect API keys and account data from public repositories, client logs and browser code.
- Measure false positives, false negatives and data provenance on verified outcomes before describing the risk engine as accurate.
- Audit key revocation, scope denial, monthly quota, errors and deployment status.
- AG Tech should approve partner contracts and license terms before general availability.
