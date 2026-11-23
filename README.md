# AG-SHIELD Partner SDK

**A server-side TypeScript SDK for AG Tech's account-risk assessment API.**

> **Partner preview — controlled pilots only.** AG-SHIELD is an early-stage service. The gateway, provider integrations, credentials, and data coverage may be unavailable or incomplete. A low score is **not proof that a payee is legitimate**. Always use independent verification and a human-reviewed payment policy.

## Start here

| Resource | Link |
| --- | --- |
| Partner documentation website | [AG-SHIELD Partner Developers](https://agtech-workspace.github.io/ag-shield-partner-sdk/) |
| OpenAPI contract | [Read the API specification](https://agtech-workspace.github.io/ag-shield-partner-sdk/openapi.yaml) |
| Integration guide | [Setup and error handling](https://github.com/agtech-workspace/ag-shield-partner-sdk/blob/main/docs/INTEGRATION.md) |
| SDK source | [Public GitHub repository](https://github.com/agtech-workspace/ag-shield-partner-sdk/tree/main/src) |
| Package source | [package.json](https://github.com/agtech-workspace/ag-shield-partner-sdk/blob/main/package.json) |

**GitHub Pages must be enabled** (repository Settings → Pages → Deploy from a branch → `main` / `/docs`) before the documentation-site links above will work. Pages hosts the developer website and OpenAPI file; **the actual TypeScript SDK source stays on GitHub**. If Pages is not yet live, use [`docs/openapi.yaml`](docs/openapi.yaml) and [`src/index.ts`](src/index.ts).

## 1. Request access

AG Tech provisions an approved partner tenant and issues a key with the `verify:read` scope. You will need:

- An active, authorized API key, issued through AG-SHIELD's protected administration process.
- The **confirmed** API base URL for your pilot environment. This is not the Pages URL; Pages only serves documentation.
- Node.js **22 or newer** and a backend that can securely store a secret.

Email **agtechrelations@gmail.com** to request a controlled pilot. Do not send account numbers, API keys, or other financial data in an initial email.

## 2. Install from GitHub

This package is a GitHub-hosted preview and is **not published to npm**. Run the following in your **backend project**:

```sh
npm install github:agtech-workspace/ag-shield-partner-sdk#main
```

The package name for imports is `@ag-tech/shield-sdk`. Use a fixed, reviewed commit rather than `#main` when your pilot is stable. The repository includes prebuilt `dist/` files for GitHub installation.

Do **not** import this SDK in a React frontend, mobile app, browser, or any location where its API key would become visible.

## 3. Configure your backend

Store the following as **server-side secrets**:

```dotenv
AG_SHIELD_API_KEY=YOUR_ADMIN_ISSUED_PARTNER_KEY
AG_SHIELD_BASE_URL=YOUR_CONFIRMED_SUPABASE_FUNCTION_BASE_URL
```

`AG_SHIELD_BASE_URL` must be the base of the actual deployed API, for example `https://<project-ref>.supabase.co/functions/v1`, **not** `https://agtech-workspace.github.io/ag-shield-partner-sdk/`, and it must **not** end in `/risk-check`.

Never commit `.env` files or put the key in `VITE_` variables. Use a secret manager in deployed environments.

## 4. Make an assessment (backend only)

```ts
import { AGShieldClient, AGShieldError } from '@ag-tech/shield-sdk'

const shield = new AGShieldClient({
  apiKey: process.env.AG_SHIELD_API_KEY!,
  baseUrl: process.env.AG_SHIELD_BASE_URL!,
  timeoutMs: 10_000,
  retries: 0,
})

try {
  const result = await shield.riskCheck({
    account_number: process.env.AUTHORIZED_ACCOUNT_NUMBER!,
    bank_name: process.env.AUTHORIZED_BANK_NAME!,
    amount: 2500,
    is_new_recipient: true,
  })

  console.log({
    riskLevel: result.risk_level,
    riskScore: result.risk_score,
    action: result.recommended_action,
    reasons: result.reasons,
  })
  // Treat results as risk indicators, not approval to transfer money.
} catch (error) {
  if (error instanceof AGShieldError) {
    console.error('Assessment unavailable:', error.code ?? error.status ?? 'unknown')
    // Decision = UNKNOWN: pause or route for manual verification.
  } else {
    throw error
  }
}
```

Use only an account you own or are authorized to test. The code above does not supply or generate a real account number.

### Request summary

| Field | Required | Notes |
| --- | --- | --- |
| `account_number` | Yes | Exactly **10 digits as a string**; preserve leading zeros |
| `bank_name` | Yes | Exact supported bank name |
| `amount` | No | Non-negative NGN amount |
| `is_new_recipient` | No | Boolean; defaults to `true` |
| `holder_name` | No | **Unverified** name hint, never evidence of ownership |

Successful responses include `risk_level` (`safe`, `warning`, `high_risk`), `risk_score` (0–100), `reasons`, `source_registry`, and `recommended_action` (`ALLOW`, `REVIEW`, `BLOCK`, `FORCE_MANDATORY_SECONDARY_OTP`). These labels reflect the service's scoring rules; the SDK does not independently certify fraud or safety.

## 5. When the API fails

AG-SHIELD is still in preview. A request might fail because the gateway is updating, the authorization key is invalid or expired, a quota was reached, an upstream provider is unavailable, or account/registry coverage is limited.

| Outcome | Your application should do |
| --- | --- |
| `200` with valid contract | Evaluate signals under your **own reviewed** policy |
| `400` | Correct the request format |
| `401` or `403` | Check key and permission; do not log the secret |
| `429` | Respect limits; use bounded retry/backoff if appropriate |
| `500`, `503`, network timeout, or malformed response | Treat outcome as **UNKNOWN**; do not silently mark safe |

The SDK defaults to **zero retries**, avoiding accidental repeated billable calls. Never treat an exception or a missing risk record as a positive safety signal.

## 6. What is and is not included

**Included:** a backend TypeScript client for the `risk-check` API, an OpenAPI contract, local unit tests, and pilot-oriented integration instructions.

**Not included:** a public `resolveAccount()` method, guaranteed real-time bank-holder-name verification, guaranteed fraud prediction, guaranteed uptime, a published npm package, or a verified production SLA.

AG-SHIELD's website may call a **separate, authenticated account-name resolution service**. That does **not** mean this partner SDK offers name resolution. The `holder_name` input field remains an unverified hint. Name verification would require a separate documented partner endpoint, permission scope, consent/data rules, and live validation before release.

A numerical risk score is not a fraud probability. Low observed risk and adequate evidence are different things. A bank account with no known reports may simply have **insufficient data**.

## 7. Test safely

- `npm test` runs isolated tests of SDK behavior and simulated HTTP responses. It does **not** establish real-world fraud accuracy or production availability.
- For a live pilot, AG Tech must issue a **fresh**, scoped key and confirm the gateway base URL.
- Run a single authorized request with a consenting test account; inspect the result and error path.
- Test unknown/insufficient-evidence cases, expired keys, timeouts, quotas and unexpected responses before moving real funds or using automated decisions.
- Use manual review for adverse decisions; assess false positives, false negatives, data provenance and coverage before expansion.

## Security and privacy

Keep keys on the server. Do not publish customer account details, provider secrets, raw verification responses, financial documents, or risk logs. Rotate compromised credentials immediately. Apply lawful processing, consent or another appropriate legal basis, retention limits, and access controls under applicable Nigerian data-protection rules.

**Pilot contact:** agtechrelations@gmail.com  
**Repository:** https://github.com/agtech-workspace/ag-shield-partner-sdk  
**Status:** Partner preview; availability and real-world accuracy not independently certified.
