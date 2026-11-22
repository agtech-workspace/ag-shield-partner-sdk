// Manual consented live test, never run automatically on push. Do not log any account identifiers or secrets.
import { AGShieldClient, AGShieldError } from '../dist/index.js';
const mustHave = [
  'AG_SHIELD_API_KEY',
  'AG_SHIELD_BASE_URL',
  'AG_SHIELD_TEST_ACCOUNT_NUMBER',
  'AG_SHIELD_TEST_BANK',
];
for (const name of mustHave) {
  if (!process.env[name]) throw new Error(`Missing GitHub Actions secret: ${name}`);
}
const client = new AGShieldClient({
  apiKey: process.env.AG_SHIELD_API_KEY,
  baseUrl: process.env.AG_SHIELD_BASE_URL,
  retries: 0,
});
try {
  const result = await client.riskCheck({
    account_number: process.env.AG_SHIELD_TEST_ACCOUNT_NUMBER,
    bank_name: process.env.AG_SHIELD_TEST_BANK,
    is_new_recipient: false,
  });
  // A successful HTTP response only proves API availability/contract, not scoring accuracy.
  if (!Number.isInteger(result.risk_score) || result.risk_score < 0 || result.risk_score > 100) {
    throw new Error('Invalid score');
  }
  console.log('PASS: authenticated API returned a valid risk contract. Real-world scoring accuracy is NOT established.');
} catch (error) {
  if (error instanceof AGShieldError) {
    console.error(`Live check FAILED: ${error.message} (HTTP ${error.status ?? 'no response'})`);
  } else console.error('Live check failed before the request could be completed.');
  process.exitCode = 1;
}
