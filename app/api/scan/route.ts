import { NextResponse } from 'next/server';

import fs from 'fs';

import path from 'path';

function normalize(value: string = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string = '') {
  return normalize(value)
    .split(' ')
    .filter((w) => w.length > 1);
}

function similarity(a: string, b: string) {
  const aa = tokenize(a);

  const bb = tokenize(b);

  if (!aa.length || !bb.length) return 0;

  let score = 0;

  for (const word of aa) {
    if (bb.includes(word)) {
      score++;
    }
  }

  return score / aa.length;
}

function containsRareTokens(
  detectedTokens: string[],
  candidateTokens: string[]
) {
  const rare = detectedTokens.filter((t) => t.length >= 5);

  if (!rare.length) return 0;

  let matches = 0;

  for (const token of rare) {
    if (candidateTokens.includes(token)) {
      matches++;
    }
  }

  return matches / rare.length;
}

function vintageScore(
  detectedVintage: string,
  candidateVintage: string
) {
  if (!detectedVintage || !candidateVintage) {
    return 0.5;
  }

  return detectedVintage === candidateVintage ? 1 : 0;
}

function producerBoost(
  detectedProducer: string,
  candidateProducer: string
) {
  const score = similarity(
    detectedProducer,
    candidateProducer
  );

  if (score > 0.9) return 1.3;

  if (score > 0.7) return 1.15;

  return 1;
}

function exactWineBoost(
  detectedWine: string,
  candidateWine: string
) {
  const a = normalize(detectedWine);

  const b = normalize(candidateWine);

  if (!a || !b) return 1;

  if (a === b) return 2;

  if (b.includes(a)) return 1.5;

  return 1;
}

function getYear(record: any) {
  const year = parseInt(record.year || '0');

  if (isNaN(year)) return 0;

  return year;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = body.wineName || '';

    const producer = body.producer || '';

    const vintage = body.vintage || '';

    const detectedText = body.detectedText || '';

    const detectedWineTokens = tokenize(wineName);

    const detectedProducerTokens = tokenize(producer);

    const searchText = [
      wineName,
      producer,
      vintage,
      detectedText,
    ].join(' ');

    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'cmb-results.json'
    );

    const raw = fs.readFileSync(filePath, 'utf8');

    const records = JSON.parse(raw);

    /*
      STEP 1
      PRE FILTER
    */

    let candidates = records.filter((item: any) => {
      const wineTokens = tokenize(item.wineName);

      const producerTokens = tokenize(item.producer);

      const wineOverlap = wineTokens.filter((t: string) =>
        detectedWineTokens.includes(t)
      ).length;

      const producerOverlap = producerTokens.filter((t: string) =>
        detectedProducerTokens.includes(t)
      ).length;

      return (
        wineOverlap >= 1 ||
        producerOverlap >= 1 ||
        item.vintage === vintage
      );
    });

    /*
      fallback
    */

    if (candidates.length < 10) {
      candidates = records;
    }

    let scored = [];

    for (const item of candidates) {
      const wineScore = similarity(
        `${wineName} ${vintage}`,
        `${item.wineName} ${item.vintage}`
      );

      const producerScoreValue = similarity(
        producer,
        item.producer
      );

      const textScore = similarity(
        searchText,
        `${item.wineName} ${item.producer} ${item.vintage}`
      );

      const rareTokenScore = containsRareTokens(
        detectedWineTokens,
        tokenize(item.wineName)
      );

      const vintageMatch = vintageScore(
        vintage,
        item.vintage
      );

      let total =
        wineScore * 0.4 +
        producerScoreValue * 0.2 +
        textScore * 0.15 +
        rareTokenScore * 0.25;

      /*
        EXACT BOOSTS
      */

      total *= exactWineBoost(
        wineName,
        item.wineName
      );

      total *= producerBoost(
        producer,
        item.producer
      );

      /*
        VINTAGE BOOST
      */

      total *= vintageMatch;

      /*
        PENALTIES
      */

      if (
        vintage &&
        item.vintage &&
        vintage !== item.vintage
      ) {
        total *= 0.7;
      }

      /*
        YEAR PRIORITY
      */

      total += getYear(item) * 0.0001;

      scored.push({
        item,
        score: total,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    if (!best || best.score < 0.42) {
      return NextResponse.json({
        awarded: false,
      });
    }

    /*
      SAME WINE RECENT AWARD PRIORITY
    */

    const normalizedBestWine = normalize(
      best.item.wineName
    );

    const sameWine = records.filter((r: any) => {
      return (
        normalize(r.wineName) === normalizedBestWine &&
        normalize(r.producer) ===
          normalize(best.item.producer)
      );
    });

    sameWine.sort(
      (a: any, b: any) => getYear(b) - getYear(a)
    );

    const finalWine = sameWine[0] || best.item;

    return NextResponse.json({
      awarded: true,

      wine: `${finalWine.wineName} ${finalWine.vintage}`,

      producer: finalWine.producer,

      country:
        finalWine.location || finalWine.country,

      medal: finalWine.medal,

      session: `${finalWine.session} · ${finalWine.year}`,

      feedbackUrl: finalWine.resultUrl,

      productImageUrl: finalWine.imageUrl,

      debug: scored.slice(0, 3).map((x) => ({
        wine: x.item.wineName,
        producer: x.item.producer,
        score: x.score,
      })),
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
    });
  }
}