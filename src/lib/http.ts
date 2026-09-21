/** Parses a request's form data, returning null instead of throwing on a malformed body. */
export async function parseFormData(req: Request): Promise<FormData | null> {
  try {
    return await req.formData();
  } catch {
    return null;
  }
}
