const DEV_API_BASE_URL = "http://localhost:3001";

export class ApiBaseUrlConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiBaseUrlConfigurationError";
  }
}

function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (rawApiUrl) {
    const normalized = normalizeBaseUrl(rawApiUrl);

    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new ApiBaseUrlConfigurationError(
        "NEXT_PUBLIC_API_URL must be a valid absolute URL (for example: https://openforum-api.onrender.com)."
      );
    }

    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw new ApiBaseUrlConfigurationError(
        "NEXT_PUBLIC_API_URL must use https:// in production."
      );
    }

    return normalized;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_API_BASE_URL;
  }

  throw new ApiBaseUrlConfigurationError(
    "NEXT_PUBLIC_API_URL is not configured for production. Set it to your HTTPS backend origin."
  );
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}