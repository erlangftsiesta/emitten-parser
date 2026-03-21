import type { WordToken, RowBucket } from '../types/token.js';

const Y_THRESHOLD = Number(process.env.Y_THRESHOLD ?? 8);

/**
 * Kelompokkan token ke dalam row buckets berdasarkan proximity koordinat top.
 * Token dengan selisih top <= Y_THRESHOLD dimasukkan ke bucket yang sama.
 */
export function groupByRow(words: WordToken[]): RowBucket[] {
  if (words.length === 0) return [];

  // Sort by top ascending first
  const sorted = [...words].sort((a, b) => a.top - b.top);

  const buckets: RowBucket[] = [];
  let currentBucket: WordToken[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentBucket[currentBucket.length - 1];
    const curr = sorted[i];

    if (Math.abs(curr.top - prev.top) <= Y_THRESHOLD) {
      currentBucket.push(curr);
    } else {
      buckets.push(finalizeBucket(currentBucket));
      currentBucket = [curr];
    }
  }
  buckets.push(finalizeBucket(currentBucket));

  return buckets;
}

function finalizeBucket(tokens: WordToken[]): RowBucket {
  // Sort tokens in bucket by x0 (left to right)
  const sorted = [...tokens].sort((a, b) => a.x0 - b.x0);
  const topValues = sorted.map(t => t.top);
  const topCenter = topValues.reduce((a, b) => a + b, 0) / topValues.length;

  return { topCenter, tokens: sorted };
}