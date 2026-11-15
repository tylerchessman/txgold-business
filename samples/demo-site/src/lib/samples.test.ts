import { describe, expect, it } from 'vitest';
import { SAMPLES, statementRange } from './samples';
import { STEP_MARKERS } from './steps';

describe('statementRange', () => {
  const source = [
    'const a = 1;',
    'const request = await client.paymentRequests.create({',
    '  accountId, // a comment (with a bracket',
    "  memo: 'a ) in a string',",
    '});',
    'next();',
  ].join('\n');

  it('spans a multi-line call, ignoring brackets in strings and comments', () => {
    expect(statementRange(source, 'paymentRequests.create(')).toEqual([1, 4]);
  });

  it('is one line for a one-line statement', () => {
    expect(statementRange(source, 'next()')).toEqual([5, 5]);
  });

  it('lights only the first branch of an if / else', () => {
    const chain = ["if (a === 'paid') {", '  ship();', "} else if (a === 'pending') {", '  wait();', '}'].join('\n');
    expect(statementRange(chain, "if (a === 'paid')")).toEqual([0, 2]);
  });

  it('is null when the marker is not there', () => {
    expect(statementRange(source, 'nothing here')).toBeNull();
  });
});

describe('every step marker is in its sample', () => {
  for (const [name, { file, marker }] of Object.entries(STEP_MARKERS)) {
    it(`${name}: "${marker}" in ${file}`, () => {
      expect(SAMPLES[file]).toContain(marker);
    });
  }
});
