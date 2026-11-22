// Synthetic fixtures ONLY: these unit tests do not call live bank providers or production endpoints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGShieldClient, AGShieldError } from '../dist/index.js';
const payload = {risk_level:'warning',risk_score:60,recommended_action:'REVIEW',reasons:['synthetic test flag'],confidence_interval:0.8,source_registry:['TEST']};
const req = { account_number:'0123456789', bank_name:'Test Bank' };
test('parses synthetic successful risk response and passes API key', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async (url, opts) => {
    assert.equal(url,'https://zmiaaxnevvznmvfzlcba.functions.supabase.co/risk-check');
    assert.equal(opts.headers['X-API-Key'],'fake');
    return new Response(JSON.stringify(payload),{status:200});
  }});
  assert.equal((await client.riskCheck(req)).recommended_action,'REVIEW');
});
test('does not treat 500 body risk_level safe as success', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({error:'db error',risk_level:'safe'}),{status:500})});
  await assert.rejects(client.riskCheck(req), e => e instanceof AGShieldError && e.status===500 && /UNKNOWN/.test(e.message));
});
test('rejects malformed 200 payload', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({risk_level:'safe'}),{status:200})});
  await assert.rejects(client.riskCheck(req),/UNKNOWN/);
});
test('rejects malformed account before network', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => {throw new Error('should not fetch')}});
  await assert.rejects(client.riskCheck({...req,account_number:'123'}),/10 digits/);
});
test('rejects score outside 0-100 range', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({...payload,risk_score:200}),{status:200})});
  await assert.rejects(client.riskCheck(req),/UNKNOWN/);
});
test('rejects missing source registry array', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({...payload,source_registry:null}),{status:200})});
  await assert.rejects(client.riskCheck(req),/UNKNOWN/);
});
test('treats malformed JSON as unknown', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response('{bad',{status:200})});
  await assert.rejects(client.riskCheck(req),/UNKNOWN/);
});
test('rejects HTTP base URL outside localhost', () => {
  assert.throws(()=> new AGShieldClient({apiKey:'fake',baseUrl:'http://attacker.invalid'}),/HTTPS/);
});
test('network failure never returns a safe verdict', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => {throw new Error('network down')}});
  await assert.rejects(client.riskCheck(req),/unavailable/);
});
test('rejects invalid confidence scalar', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({...payload,confidence_interval:[0.4,0.9]}),{status:200})});
  await assert.rejects(client.riskCheck(req),/UNKNOWN/);
});
test('rejects malformed source registry entries', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({...payload,source_registry:['TEST',7]}),{status:200})});
  await assert.rejects(client.riskCheck(req),/UNKNOWN/);
});
test('rejects invalid optional request fields', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => {throw new Error('network should not run')}});
  await assert.rejects(client.riskCheck({...req,is_new_recipient:'yes'}),/boolean/);
});
test('rejects invalid timeouts', () => {
  assert.throws(()=> new AGShieldClient({apiKey:'fake', timeoutMs:-1}),/timeoutMs/);
});
test('secondary OTP action remains a hold, never an automatic safe verdict', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({...payload, recommended_action:'FORCE_MANDATORY_SECONDARY_OTP'}), {status:200})});
  const result = await client.riskCheck(req);
  assert.equal(result.recommended_action, 'FORCE_MANDATORY_SECONDARY_OTP');
  assert.notEqual(result.recommended_action, 'ALLOW');
});
test('accepts admin-prefixed API keys but sends only raw token', async () => {
  const client = new AGShieldClient({apiKey:'sg_live.synthetic-secret-not-real',fetchImpl: async (_url, opts) => {
    assert.equal(opts.headers['X-API-Key'],'synthetic-secret-not-real');
    return new Response(JSON.stringify(payload), {status:200});
  }});
  await client.riskCheck(req);
});
test('401 unauthorized remains UNKNOWN', async () => {
  const client = new AGShieldClient({apiKey:'fake',fetchImpl: async () => new Response(JSON.stringify({error:'invalid key'}),{status:401})});
  await assert.rejects(client.riskCheck(req), e=>e instanceof AGShieldError && e.status === 401 && e.decision === 'UNKNOWN');
});
test('uses the configured HTTPS Supabase Edge Function base URL', async () => {
  const expected = 'https://zmiaaxnevvznmvfzlcba.supabase.co/functions/v1/risk-check';
  const client = new AGShieldClient({apiKey:'fake',baseUrl:'https://zmiaaxnevvznmvfzlcba.supabase.co/functions/v1',fetchImpl: async (url) => {
    assert.equal(url,expected);
    return new Response(JSON.stringify(payload),{status:200});
  }});
  await client.riskCheck(req);
});
