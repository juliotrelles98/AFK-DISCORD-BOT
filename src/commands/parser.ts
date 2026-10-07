import { removeAccents } from '../speech/wakeWord.js';

export interface ParsedCommand {
  action: 'play' | 'pause' | 'resume' | 'skip' | 'stop' | 'volume_up' | 'volume_down';
  query?: string;
}

interface CommandRule {
  keywords: string[];
  action: ParsedCommand['action'];
  hasQuery: boolean;
}

const COMMAND_RULES: CommandRule[] = [
  // Volume commands
  {
    keywords: [
      'sube el volumen', 'subele el volumen', 'sube volumen', 'subele',
      'mas volumen', 'aumenta el volumen', 'aumenta volumen', 'volume up', 'volumen arriba',
    ],
    action: 'volume_up',
    hasQuery: false,
  },
  {
    keywords: [
      'baja el volumen', 'bajale el volumen', 'baja volumen', 'bajale',
      'menos volumen', 'disminuye el volumen', 'disminuye volumen', 'volume down', 'volumen abajo',
    ],
    action: 'volume_down',
    hasQuery: false,
  },
  // Skip / Next commands
  {
    keywords: [
      'siguiente cancion', 'siguiente musica', 'siguiente tema', 'siguiente pista', 'siguiente rolita', 'siguiente',
      'pasa la cancion', 'pasa de cancion', 'pasa la musica', 'pasa de musica', 'pasa cancion', 'pasa musica', 'pasa tema', 'pasa',
      'salta la cancion', 'salta la musica', 'salta de cancion', 'salta de musica', 'salta cancion', 'salta musica', 'salta esta', 'salta',
      'cambia la cancion', 'cambia de cancion', 'cambia la musica', 'cambia de musica', 'cambia cancion', 'cambia musica', 'cambia tema', 'cambiala', 'cambialo', 'cambia',
      'otra cancion', 'otra musica', 'otra rolita', 'otra pista', 'otro tema', 'otra', 'otro',
      'skip', 'next',
    ],
    action: 'skip',
    hasQuery: false,
  },
  // Play commands
  {
    keywords: [
      'ponme la cancion de', 'ponme la cancion', 'ponme el tema de', 'ponme el tema', 'ponme musica de', 'ponme algo de', 'ponme',
      'pon la cancion de', 'pon la cancion', 'pon el tema de', 'pon el tema', 'pon musica de', 'pon algo de', 'pon',
      'reproduce la cancion de', 'reproduce la cancion', 'reproduce musica de', 'reproduce algo de', 'reproducela', 'reproducila', 'reproduce',
      'quiero escuchar a', 'quiero escuchar', 'quiero oir a', 'quiero oir',
      'toca la cancion de', 'toca la cancion', 'toca musica de', 'toca algo de', 'toca',
      'play', 'escuchar',
    ],
    action: 'play',
    hasQuery: true,
  },
  // Pause
  {
    keywords: ['pausa la musica', 'pausa la cancion', 'pausa', 'pause', 'pausar', 'pausala', 'pausalo'],
    action: 'pause',
    hasQuery: false,
  },
  // Resume
  {
    keywords: [
      'continua la musica', 'continua la cancion', 'continua', 'resume', 'sigue la musica', 'sigue', 'reanuda la musica', 'reanuda',
      'despausa la musica', 'despausa', 'dale play', 'dale', 'siguele',
    ],
    action: 'resume',
    hasQuery: false,
  },
  // Stop
  {
    keywords: [
      'para la musica', 'para la cancion', 'para', 'stop', 'detente', 'deten la musica', 'deten la cancion', 'deten',
      'parale', 'ya no', 'callate', 'silencio', 'apaga la musica', 'apagate',
    ],
    action: 'stop',
    hasQuery: false,
  },
];

/**
 * Parse a voice command string into a structured command.
 * Normalizes accents, punctuation, and casing.
 */
export function parseCommand(commandText: string): ParsedCommand | null {
  const rawClean = commandText.trim().replace(/^[,.:;!¡?¿\-\s]+/, '');
  const normalized = removeAccents(rawClean.toLowerCase());

  if (!normalized) return null;

  for (const rule of COMMAND_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = removeAccents(keyword);
      if (normalized.startsWith(normalizedKeyword)) {
        if (rule.hasQuery) {
          const query = rawClean.substring(normalizedKeyword.length).replace(/^[,.:;!¡?¿\-\s]+/, '').trim();
          return {
            action: rule.action,
            query: query || undefined,
          };
        }
        return { action: rule.action };
      }
    }
  }

  return null;
}
