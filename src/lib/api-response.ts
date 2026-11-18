const noStore = { "Cache-Control": "private, no-store" };

export function apiJson<T>(body: T, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

export function apiError(status: number, code: string, message: string) {
  return apiJson({ error: { code, message } }, status);
}
