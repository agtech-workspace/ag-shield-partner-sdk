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
export declare class AGShieldError extends Error {
    readonly status?: number | undefined;
    readonly code?: string | undefined;
    readonly retryAfterSeconds?: number | undefined;
    readonly decision: "UNKNOWN";
    constructor(message: string, status?: number | undefined, code?: string | undefined, retryAfterSeconds?: number | undefined);
}
export interface AGShieldOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    /** Defaults to zero to prevent accidental duplicate billable calls. */
    retries?: number;
}
export declare class AGShieldClient {
    private readonly baseUrl;
    private readonly fetchImpl;
    private readonly timeoutMs;
    private readonly retries;
    private readonly apiKey;
    constructor(options: AGShieldOptions);
    riskCheck(request: RiskCheckRequest): Promise<RiskCheckResponse>;
}
