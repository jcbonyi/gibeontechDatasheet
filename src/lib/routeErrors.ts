import { NextResponse } from 'next/server';

export function handleRouteError(err: unknown, context: string) {
  console.error(context, err);
  const message =
    err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  return NextResponse.json({ message }, { status: 500 });
}
