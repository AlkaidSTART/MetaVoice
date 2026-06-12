import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      details: details ?? null,
    },
    { status },
  );
}
