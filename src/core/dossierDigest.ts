function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function normalizeControlsInPayload(payload: unknown): unknown {
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.controls)) {
      const normalized = {
        ...obj,
        controls: [...obj.controls].sort((a, b) => {
          const itemA = a as Record<string, unknown>;
          const itemB = b as Record<string, unknown>;
          const idA = String(itemA?.id ?? itemA?.controlId ?? '');
          const idB = String(itemB?.id ?? itemB?.controlId ?? '');
          return idA.localeCompare(idB);
        }),
      };
      return sortDeep(normalized);
    }
  }
  return sortDeep(payload);
}

export function canonicalizeDossierPayload(payload: unknown): string {
  return JSON.stringify(normalizeControlsInPayload(payload));
}

export async function computePayloadDigest(canonicalText: string): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalText);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeDossierSha256(payload: unknown): Promise<string> {
  return computePayloadDigest(canonicalizeDossierPayload(payload));
}
