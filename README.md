# AG-SHIELD Partner SDK

**Server-side TypeScript SDK | v0.1.0-preview.1 | Integration preview**

AG-SHIELD provides a bank-account risk-indicator API for approved partner integrations. This repo contains **only** the public client, compiled library, API contract, automated tests and documentation. It **does not** contain the fraud-scoring engine, internal database, provider secrets or administrator dashboard.

> **Launch status:** The client compiles and passes isolated tests. Production partner API authentication, data provenance and real-name resolution have **not** been verified end-to-end. Do not use this preview for automated financial decisions or present risk labels as proof of fraud.

## What is available now

- `AGShieldClient.riskCheck()` - server-to-server request to the current `POST /risk-check` gateway. Requires an administrator-issued `verify:read` partner key.
- Fails closed: malformed responses, invalid credentials and network errors produce `AGShieldError` with `decision = 'UNKNOWN'`.
- Node.js 22+; no API key in browser, mobile app or GitHub source code.
- A versioned OpenAPI contract at [`docs/openapi.yaml`](docs/openapi.yaml).
- Automated unit tests in [`test/client.test.mjs`](test/client.test.mjs), and a manually triggered live gateway test.

**Not yet included:** `resolveAccount()` for bank-holder names. The currently observed `resolve-account` deployment returned HTTP 503, so name verification must not be advertised as functional or silently replaced with fabricated values.

## Install from this public GitHub repository

Once you create the repository as `agtech-workspace/ag-shield-partner-sdk`, another project's `package.json` can contain:

```json
{
  "dependencies": {
    "@ag-tech/shield-sdk": "github:agtech-workspace/ag-shield-partner-sdk#main"
  }
}
```

Install your application's dependencies with its normal package manager. The compiled `dist/` directory is included so the partner does not have to build the SDK. There is **no npm registry release yet**; the package remains `private: true` to prevent accidental npm publication. If you create the repo under a different account, change the owner in the GitHub dependency.

## Use it on your server

```js
import { AGShieldClient, AGShieldError } from '@ag-tech/shield-sdk'

const client = new AGShieldClient({
  apiKey: process.env.AG_SHIELD_API_KEY,
  baseUrl: process.env.AG_SHIELD_BASE_URL,
  retries: 0,
})

try {
  const result = await client.riskCheck({
    account_number: process.env.AUTHORIZED_ACCOUNT_NUMBER,
    bank_name: process.env.AUTHORIZED_BANK_NAME,
    is_new_recipient: true,
  })
  // Apply your own documented review/hold policy.
  console.log('Assessment received:', result.recommended_action)
} catch (error) {
  if (error instanceof AGShieldError) {
    // UNKNOWN means a decision could NOT be made.
    // Hold or send for manual review. Never assume SAFE.
    console.error('Assessment unavailable:', error.code ?? error.status ?? 'UNKNOWN')
  }
}
```

**Do not log bank account numbers, API keys, personal names or full risk responses in a public CI pipeline.** The sample uses environment variables so it never embeds real account details.

## Run checks without writing scripts

After uploading the files, GitHub automatically runs **Actions -> SDK build and unit tests** on every commit. A green check means source compilation and simulated contract tests passed; it does **not** mean the bank provider or deployed gateway works.

For a live gateway check, create four private repository **Actions secrets** as described in [`docs/INTEGRATION.md`](docs/INTEGRATION.md). Then go to **Actions -> Real API smoke test (manual and consented) -> Run workflow**, and confirm that you are authorized to use the test account. Results are deliberately restricted to PASS/FAIL in public Actions logs.

## Documentation and links

- [API integration guide](docs/INTEGRATION.md)
- [OpenAPI specification](docs/openapi.yaml)
- [Static partner developer page](docs/index.html) - optionally publish using **Settings -> Pages -> Deploy from a branch -> main -> /docs**.
- [Hosted AG-SHIELD web app](https://ag-shield.pages.dev/) - separate from this backend SDK; do not paste the partner key into its browser.
- Security contact: agtechrelations@gmail.com (do not email passwords or full banking identifiers).

No permissive open-source license has been granted by publishing these files. Confirm AG Tech's intended licensing terms before accepting third-party redistribution or contributions.
