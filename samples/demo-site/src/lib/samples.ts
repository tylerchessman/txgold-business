// The code panels show the JavaScript samples themselves (samples/javascript), imported as text
// at build time, so the demo can't drift from them. A step highlights the statement that starts
// on the first line containing its marker text.
import accountLink from '../../../javascript/account-link.mjs?raw';
import appHandoff from '../../../javascript/app-handoff.mjs?raw';
import checkoutHandle from '../../../javascript/checkout-handle.mjs?raw';
import invoiceLink from '../../../javascript/invoice-link.mjs?raw';
import tillQr from '../../../javascript/till-qr.mjs?raw';
import tour from '../../../javascript/tour.mjs?raw';

export const SAMPLES = {
  'account-link.mjs': accountLink,
  'app-handoff.mjs': appHandoff,
  'checkout-handle.mjs': checkoutHandle,
  'invoice-link.mjs': invoiceLink,
  'till-qr.mjs': tillQr,
  'tour.mjs': tour,
} as const;

export type SampleFile = keyof typeof SAMPLES;

export const SAMPLE_URL = (file: SampleFile) =>
  `https://github.com/tylerchessman/txgold-business/blob/main/samples/javascript/${file}`;

/**
 * The 0-based [first, last] lines of the statement starting at the first line that contains
 * `marker`: it runs until its brackets balance (and the line doesn't end in an operator), or until
 * the first block it opens closes.
 * Null when the marker isn't found, so a renamed sample degrades to "no highlight".
 */
export function statementRange(source: string, marker: string): [number, number] | null {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.includes(marker));
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    const code = stripStringsAndComments(lines[i]);
    let closed = false;
    for (const ch of code) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch) && --depth <= 0 && i > start) closed = true;
    }
    // Stops where the first block closes, so `if (...) {` lights its own branch, not the else
    if (closed) return [start, i];
    const continues = /(\?\?|\|\||&&|[+\-*/,=?:(]|=>)\s*$/.test(code.trimEnd());
    if (depth <= 0 && !continues) return [start, i];
  }
  return [start, lines.length - 1];
}

function stripStringsAndComments(line: string): string {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
}
