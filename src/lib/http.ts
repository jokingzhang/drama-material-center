export async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string };
    return new Error(body.error || fallback);
  } catch {
    return new Error(fallback);
  }
}
