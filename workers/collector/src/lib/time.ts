export function minuteBucketFrom(date: Date): string {
  const copy = new Date(date)
  copy.setUTCSeconds(0, 0)
  return copy.toISOString()
}

export function nowIso(): string {
  return new Date().toISOString()
}
