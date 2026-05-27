import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(
      /\b(reserve|reserva|estate|bottled|producer|cellars|vineyards|vin|wine|appellation|controlee|mis en bouteille|grand vin)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsWord(text: string, words: string[]) {
  return words.some((word) =>
    text.includes(word.toLowerCase())
  );
}

function similarity(a: string, b: string) {
  const aa = normalize(a).split(' ');
  const bb = normalize(b).split(' ');

  let score = 0;

  for (const word of aa) {
    if (word.length < 3) continue;

    if (bb.includes(word)) score++;
  }

  return score / Math.max(aa.length, 1);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = body.wineName || '';
    const producer = body.producer || '';
    const vintage = body.vintage || '';
    const detectedText = body.detectedText || '';

    const searchText = normalize(
      [
        wineName,
        producer,
        vintage,
        detectedText,
      ].join(' ')
    );

    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'cmb-results.json'
    );

    const raw = fs.readFileSync(filePath, 'utf8');

    const records = JSON.parse(raw);

    let candidates: any[] = [];

    for (const item of records) {
      const candidateText = normalize(
        [
          item.wineName,
          item.producer,
          item.vintage,
          item.country,
          item.region,
          item.appellation,
        ].join(' ')
      );

      let wineScore = similarity(
        `${wineName} ${vintage}`,
        `${item.wineName} ${item.vintage}`
      );

      let producerScore = similarity(
        producer,
        item.producer
      );

      let textScore = similarity(
        searchText,
        candidateText
      );

      let total =
        wineScore * 0.45 +
        producerScore * 0.4 +
        textScore * 0.15;

      const lowerSearch = searchText.toLowerCase();

      const lowerCandidate = candidateText.toLowerCase();

      const whiteKeywords = [
        'chardonnay',
        'blanc',
        'white',
      ];

      const redKeywords = [
        'cabernet',
        'merlot',
        'syrah',
        'malbec',
        'red',
        'rouge',
      ];

      const roseKeywords = [
        'rose',
        'rosé',
      ];

      if (
        containsWord(lowerSearch, whiteKeywords) &&
        containsWord(lowerCandidate, redKeywords)
      ) {
        total -= 0.45;
      }

      if (
        containsWord(lowerSearch, redKeywords) &&
        containsWord(lowerCandidate, whiteKeywords)
      ) {
        total -= 0.45;
      }

      if (
        containsWord(lowerSearch, roseKeywords) &&
        !containsWord(lowerCandidate, roseKeywords)
      ) {
        total -= 0.55;
      }

      if (
        vintage &&
        item.vintage &&
        vintage !== item.vintage
      ) {
        total -= 0.18;
      }

      if (
        producer &&
        producer.length > 3 &&
        !normalize(item.producer).includes(
          normalize(producer)
        )
      ) {
        total -= 0.12;
      }

      const yearValue = parseInt(item.year || '0');

      total += yearValue * 0.0001;

      candidates.push({
        item,
        score: total,
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];

    if (!best || best.score < 0.42) {
      return NextResponse.json({
        awarded: false,
        debug: candidates.slice(0, 5),
      });
    }

    const bestMatch = best.item;

    return NextResponse.json({
      awarded: true,

      wine: `${bestMatch.wineName} ${bestMatch.vintage}`,

      producer: bestMatch.producer,

      country:
        bestMatch.location || bestMatch.country,

      medal: bestMatch.medal,

      session: `${bestMatch.session} · ${bestMatch.year}`,

      feedbackUrl: bestMatch.resultUrl,

      productImageUrl: bestMatch.imageUrl,

      debug: candidates.slice(0, 5),
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
    });
  }
}