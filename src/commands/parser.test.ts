import { parseCommand } from './parser.js';
import { detectWakeWord } from '../speech/wakeWord.js';

interface TestCase {
  input: string;
  expected: { action: string; query?: string } | null;
}

const testCases: TestCase[] = [
  // Skip / Next commands
  { input: 'siguiente', expected: { action: 'skip' } },
  { input: 'siguiente canción', expected: { action: 'skip' } },
  { input: 'siguiente musica', expected: { action: 'skip' } },
  { input: 'siguiente tema', expected: { action: 'skip' } },
  { input: 'pasa la canción', expected: { action: 'skip' } },
  { input: 'pasa de canción', expected: { action: 'skip' } },
  { input: 'pasa música', expected: { action: 'skip' } },
  { input: 'salta la canción', expected: { action: 'skip' } },
  { input: 'salta', expected: { action: 'skip' } },
  { input: 'cambia la canción', expected: { action: 'skip' } },
  { input: 'cambia de música', expected: { action: 'skip' } },
  { input: 'cámbiala', expected: { action: 'skip' } },
  { input: 'otra canción', expected: { action: 'skip' } },
  { input: 'otra rolita', expected: { action: 'skip' } },
  { input: 'skip', expected: { action: 'skip' } },
  { input: 'next', expected: { action: 'skip' } },

  // Play commands
  { input: 'pon Blinding Lights', expected: { action: 'play', query: 'Blinding Lights' } },
  { input: 'pón Bad Bunny', expected: { action: 'play', query: 'Bad Bunny' } },
  { input: 'ponme algo de reggaeton', expected: { action: 'play', query: 'reggaeton' } },
  { input: 'Pón, Maná', expected: { action: 'play', query: 'Maná' } },
  { input: 'reproduce The Weeknd', expected: { action: 'play', query: 'The Weeknd' } },
  { input: 'play Despacito', expected: { action: 'play', query: 'Despacito' } },

  // Pause
  { input: 'pausa', expected: { action: 'pause' } },
  { input: 'pause', expected: { action: 'pause' } },
  { input: 'pausa la música', expected: { action: 'pause' } },

  // Resume
  { input: 'continúa', expected: { action: 'resume' } },
  { input: 'continua', expected: { action: 'resume' } },
  { input: 'sigue', expected: { action: 'resume' } },
  { input: 'dale play', expected: { action: 'resume' } },

  // Stop
  { input: 'para', expected: { action: 'stop' } },
  { input: 'stop', expected: { action: 'stop' } },
  { input: 'detente', expected: { action: 'stop' } },
  { input: 'cállate', expected: { action: 'stop' } },

  // Volume
  { input: 'sube el volumen', expected: { action: 'volume_up' } },
  { input: 'baja el volumen', expected: { action: 'volume_down' } },
  { input: 'más volumen', expected: { action: 'volume_up' } },
  { input: 'menos volumen', expected: { action: 'volume_down' } },
  { input: 'súbele', expected: { action: 'volume_up' } },
  { input: 'bájale', expected: { action: 'volume_down' } },

  // Unknown / normal conversation words
  { input: 'hola', expected: null },
  { input: 'qué estás jugando', expected: null },
  { input: 'vamos a ganar la partida', expected: null },
];

let passed = 0;
let failed = 0;

console.log('\n=== Parser Tests ===\n');

for (const tc of testCases) {
  const result = parseCommand(tc.input);
  const resultStr = JSON.stringify(result);
  const expectedStr = JSON.stringify(tc.expected);

  if (resultStr === expectedStr) {
    console.log(`  ✅ "${tc.input}" → ${resultStr}`);
    passed++;
  } else {
    console.log(`  ❌ "${tc.input}"`);
    console.log(`     Expected: ${expectedStr}`);
    console.log(`     Got:      ${resultStr}`);
    failed++;
  }
}

// Test wake word filtering
console.log('\n=== Wake Word Filtering Tests ===\n');
const wakeWordTests = [
  // Should trigger:
  { text: 'DJ siguiente música', expectedDetected: true, expectedCommand: 'siguiente música' },
  { text: 'DJ siguiente canción', expectedDetected: true, expectedCommand: 'siguiente canción' },
  { text: 'DJ pasa la canción', expectedDetected: true, expectedCommand: 'pasa la canción' },
  { text: 'DJ salta', expectedDetected: true, expectedCommand: 'salta' },
  { text: 'D.J. Pon Bad Bunny', expectedDetected: true, expectedCommand: 'Pon Bad Bunny' },
  { text: 'Dejota, pon The Weeknd', expectedDetected: true, expectedCommand: 'pon The Weeknd' },
  { text: 'DJ pausa', expectedDetected: true, expectedCommand: 'pausa' },
  { text: 'DJ continúa', expectedDetected: true, expectedCommand: 'continúa' },

  // Should NOT trigger (normal conversation):
  { text: 'Hola amigo cómo estás', expectedDetected: false },
  { text: 'Vamos a jugar otra partida', expectedDetected: false },
  { text: 'Qué hora es bro', expectedDetected: false },
  { text: 'Mira ese gol que metieron', expectedDetected: false },
  { text: 'Pásame el control', expectedDetected: false },
];

for (const tc of wakeWordTests) {
  const res = detectWakeWord(tc.text);
  if (res.detected === tc.expectedDetected) {
    console.log(`  ✅ "${tc.text}" → detected: ${res.detected}`);
    passed++;
  } else {
    console.log(`  ❌ "${tc.text}" → detected: ${res.detected} (expected ${tc.expectedDetected})`);
    failed++;
  }
}

console.log(`\n=== Total: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
