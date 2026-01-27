/**
 * Safely parses a JSON response, handling empty bodies and non-JSON responses.
 * Returns null if the response body is empty or not valid JSON.
 */
export async function safeJsonParse<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();

    // Check if response has content
    if (!text || text.trim() === "") {
      return null;
    }

    // Try to parse as JSON
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("JSON parse error:", err);
    return null;
  }
}

/**
 * Extracts an error message from an API error response.
 * Handles RFC 7807 Problem Details and simple error objects.
 */
export async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await safeJsonParse<{ detail?: string; message?: string; error?: string }>(response);

  if (data) {
    return data.detail || data.message || data.error || fallback;
  }

  return fallback;
}
