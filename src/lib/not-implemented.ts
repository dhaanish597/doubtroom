export function notImplemented() {
  return Response.json(
    { error: { code: "NOT_IMPLEMENTED", message: "This endpoint is reserved for a later phase." } },
    { status: 501 },
  );
}
