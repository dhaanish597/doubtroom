const noStore = { "Cache-Control": "private, no-store" };

export function apiJson<T>(body: T, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

export function apiError(status: number, code: string, message: string) {
  if (status < 500) return apiJson({ error: { code, message } }, status);
  const requestId = crypto.randomUUID();
  console.error("API request failed", { requestId, code, status });
  const response = apiJson({ error: { code, message, requestId } }, status);
  response.headers.set("X-Request-ID", requestId);
  return response;
}
