const DEFAULT_LOCAL_SERVICE_URL = 'http://localhost:8000';

export function getSbertEmbedUrl(): string | null {
  const configuredUrl = process.env.SBERT_SERVICE_URL?.trim();
  if (!configuredUrl) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SBERT] SBERT_SERVICE_URL is required in production.');
      return null;
    }
    return `${DEFAULT_LOCAL_SERVICE_URL}/api/v1/embed`;
  }

  const normalizedUrl = configuredUrl.replace(/\/+$/, '');
  return normalizedUrl.endsWith('/api/v1/embed')
    ? normalizedUrl
    : `${normalizedUrl}/api/v1/embed`;
}
