export function getApiErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status
  }
  return undefined
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as {
      response?: { data?: { error?: unknown; message?: unknown } }
    }).response
    const data = response?.data
    if (typeof data?.error === 'string' && data.error) return data.error
    if (typeof data?.message === 'string' && data.message) return data.message
  }
  return fallback
}