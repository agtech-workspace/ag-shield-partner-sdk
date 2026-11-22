/** Server-side AG Shield risk-check SDK. Never expose API keys in browser/mobile clients. */
export type RiskLevel = 'safe' | 'warning' | 'high_risk';
export type RecommendedAction = 'ALLOW' | 'REVIEW' | 'BLOCK' | 'FORCE_MANDATORY_SECONDARY_OTP';
export interface RiskCheckRequest {
  account_number: string;
  bank_name: string;
  amount?: number;
  is_new_recipient?: boolean;
  /** Unverified hint, not proof of identity. */
  holder_name?: string;
}
export interface RiskCheckResponse {
  status?: RiskLevel;
  risk_level: RiskLevel;
  risk_score: number;
  /** Legacy name: the gateway sends scalar confidence, not an interval. */
  confidence_interval?: number | null;
  source_registry?: string[];
  primary_match_flags?: unknown[];
  recommended_action: RecommendedAction;
  reasons: string[];
  social_proof?: unknown;
  execution_time_ms?: number;
}
export class AGShieldError extends Error {
  public readonly decision = 'UNKNOWN' as const;
  constructor(message: string, public readonly status?: number, public readonly code?: string, public readonly retryAfterSeconds?: number) {
    super(message); this.name = 'AGShieldError';
  }
}
export interface AGShieldOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Defaults to zero to prevent accidental duplicate billable calls. */
  retries?: number;
}
const DEFAULT_BASE_URL = 'https://zmiaaxnevvznmvfzlcba.functions.supabase.co';
const validRisk = new Set(['safe','warning','high_risk']);
const validAction = new Set(['ALLOW','REVIEW','BLOCK','FORCE_MANDATORY_SECONDARY_OTP']);
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function normalizeBaseUrl(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Invalid baseUrl'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('HTTPS baseUrl required');
  if (url.username || url.password || url.search || url.hash || !url.hostname) throw new Error('Invalid baseUrl');
  return url.toString().replace(/\/+$/, '');
}

export class AGShieldClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly apiKey: string;
  constructor(options: AGShieldOptions) {
    if (!options?.apiKey?.trim() || /\s/.test(options.apiKey.trim())) throw new Error('Shield by AG Tech apiKey is required');
    const presented = options.apiKey.trim();
    this.apiKey = presented.startsWith('sg_live.') ? presented.slice('sg_live.'.length) : presented;
    if (!this.apiKey || this.apiKey.length > 512) throw new Error('Invalid API key');
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 120_000) throw new Error('timeoutMs must be between 1 and 120000');
    this.retries = options.retries ?? 0;
    if (!Number.isInteger(this.retries) || this.retries < 0 || this.retries > 3) throw new Error('retries must be 0..3');
  }
  async riskCheck(request: RiskCheckRequest): Promise<RiskCheckResponse> {
    if (!isObject(request) || typeof request.account_number !== 'string' || !/^\d{10}$/.test(request.account_number)) throw new AGShieldError('account_number must be exactly 10 digits');
    if (typeof request.bank_name !== 'string' || !request.bank_name.trim() || request.bank_name.length > 100) throw new AGShieldError('bank_name must be a nonempty string up to 100 characters');
    if (request.amount !== undefined && (typeof request.amount !== 'number' || !Number.isFinite(request.amount) || request.amount < 0)) throw new AGShieldError('amount must be nonnegative');
    if (request.holder_name !== undefined && (typeof request.holder_name !== 'string' || request.holder_name.trim().length > 150)) throw new AGShieldError('holder_name must be a string up to 150 characters');
    if (request.is_new_recipient !== undefined && typeof request.is_new_recipient !== 'boolean') throw new AGShieldError('is_new_recipient must be boolean');
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let response: Response;
      let raw: string;
      try {
        ({ response, raw } = await Promise.race([
          (async () => {
            const response = await this.fetchImpl(`${this.baseUrl}/risk-check`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
              body: JSON.stringify(request), signal: controller.signal,
            });
            const raw = await response.text();
            return { response, raw };
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, this.timeoutMs);
          }),
        ]));
      } catch {
        if (attempt < this.retries) { await delay(200 * (2 ** attempt)); continue; }
        throw new AGShieldError('Risk check unavailable due to network failure or timeout; decision is UNKNOWN', undefined, 'NETWORK_UNAVAILABLE');
      } finally { if (timer) clearTimeout(timer); }
      if (!response.ok) {
        const retryAfterRaw = response.headers.get('Retry-After');
        const retryAfter = retryAfterRaw && /^\d+$/.test(retryAfterRaw.trim()) ? Number(retryAfterRaw) : undefined;
        if (attempt < this.retries && (response.status === 503 || response.status === 429)) {
          await delay(Math.min(3000, retryAfter !== undefined && Number.isFinite(retryAfter) ? retryAfter * 1000 : 200 * (2 ** attempt)));
          continue;
        }
        throw new AGShieldError(`Risk API request failed (HTTP ${response.status}); decision is UNKNOWN`, response.status, undefined, retryAfter);
      }
      let body: unknown;
      try { body = JSON.parse(raw); } catch { throw new AGShieldError('Risk API returned invalid JSON; decision is UNKNOWN', response.status); }
      if (!isObject(body) || !validRisk.has(String(body.risk_level)) || !validAction.has(String(body.recommended_action)) || (body.status !== undefined && body.status !== body.risk_level) || typeof body.risk_score !== 'number' || !Number.isInteger(body.risk_score) || body.risk_score < 0 || body.risk_score > 100 || !Array.isArray(body.reasons) || !body.reasons.every(x => typeof x === 'string') || !Array.isArray(body.source_registry) || !body.source_registry.every(x => typeof x === 'string') || (body.confidence_interval !== undefined && body.confidence_interval !== null && (typeof body.confidence_interval !== 'number' || !Number.isFinite(body.confidence_interval) || body.confidence_interval < 0 || body.confidence_interval > 1))) {
        throw new AGShieldError('Unexpected risk API response; decision is UNKNOWN', response.status);
      }
      return body as unknown as RiskCheckResponse;
    }
    throw new AGShieldError('Risk check exhausted retries; decision is UNKNOWN');
  }
}
