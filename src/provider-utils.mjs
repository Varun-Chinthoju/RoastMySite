export function extractGeminiOutputText(response = {}) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  const entries = [
    ...(Array.isArray(response.outputs) ? response.outputs : []),
    ...(Array.isArray(response.steps) ? response.steps : []),
    ...(Array.isArray(response.output) ? response.output : []),
  ];
  for (const entry of entries.slice().reverse()) {
    if (typeof entry.text === 'string' && entry.text.trim()) return entry.text;
    for (const part of Array.isArray(entry.content) ? entry.content.slice().reverse() : []) {
      if (typeof part.text === 'string' && part.text.trim()) return part.text;
    }
  }
  return null;
}
