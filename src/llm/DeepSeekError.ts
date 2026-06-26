/**
 * Translate a non-2xx DeepSeek API response into a human-readable Error.
 * Pure function — no obsidian dependency, unit-testable in isolation.
 *
 *  401 → invalid key
 *  402 → out of balance (top up at platform.deepseek.com)
 *  403 → not enabled
 *  404 → invalid model for this tier
 *  429 → rate limited
 *  5xx → upstream error
 */
export function asRequestError(status: number, body: string): Error {
  // Try to extract the API's `message` field
  let apiMsg = body;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) apiMsg = parsed.error.message;
  } catch {
    /* leave body as-is */
  }
  let hint = "";
  switch (status) {
    case 401:
      hint = "  → Check that your API key in Settings is correct.";
      break;
    case 402:
      hint = "  → Your DeepSeek account is out of balance. Top up at https://platform.deepseek.com → Billing.";
      break;
    case 403:
      hint = "  → This model/endpoint is not enabled on your account.";
      break;
    case 404:
      hint = "  → The model name is invalid for your account tier.";
      break;
    case 429:
      hint = "  → Rate limit hit. Wait a few seconds and retry.";
      break;
    case 500:
    case 502:
    case 503:
      hint = "  → DeepSeek server error. Retry shortly.";
      break;
  }
  return new Error(`DeepSeek API ${status}: ${apiMsg}${hint}`);
}
