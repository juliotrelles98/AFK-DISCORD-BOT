export interface WakeWordResult {
  /** Whether the wake word was detected */
  detected: boolean;
  /** The specific wake word that matched */
  wakeWord?: string;
  /** The command text after the wake word */
  command: string;
}

/**
 * Remove accents / diacritics from a string.
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Detect the wake word "DJ" (and its Spanish phonetic mishearings).
 * Strictly requires the wake word at the start of the utterance so the bot
 * ignores normal background conversations completely.
 */
export function detectWakeWord(text: string): WakeWordResult {
  const cleaned = removeAccents(text.trim().toLowerCase().replace(/^[¡¿\-\s]+/, ''));

  // Patterns for "DJ" and its Spanish phonetic mishearings
  const wakeWordPatterns = [
    // Standard abbreviations
    /^d\.?j\.?\b\s*/i,
    /^d\s+j\b\s*/i,
    // Phonetic Spanish spelling
    /^(?:dejota|de\s+jota|deyei|de\s+yei|diyei|di\s+yei|deejay|dee\s+jay|di\s*jei)\b\s*/i,
    // Common Whisper Spanish mishearings for "DJ"
    /^(?:dia\s*y|d\.?a\.?|tie|dya|dy|tia\s*y|ria\s*y|rie\s*y)\b\s*/i,
    // Invocations
    /^(?:oye\s+bot|oye\s+dj|hey\s+dj|bot|oye)\b\s*/i,
  ];

  for (const pattern of wakeWordPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const commandStart = match[0].length;
      const command = text.trim().substring(commandStart).replace(/^[,.:;!¡?¿\-\s]+/, '').trim();
      return {
        detected: true,
        wakeWord: match[0].trim(),
        command: command || text.trim(),
      };
    }
  }

  return {
    detected: false,
    command: '',
  };
}
