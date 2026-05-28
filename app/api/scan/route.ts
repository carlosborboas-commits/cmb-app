import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalize(value: string = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·•–—_\-\/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string = '') {
  return normalize(value)
    .split(' ')
    .filter((t) => t.length >= 3);
}

function rareTokens(value: string = '') {
  return tokens(value).filter((t) => t.length >= 5);
}

function overlap(source: string, target: string) {
  const a = tokens(source);
  const b = tokens(target);

  if (!a.length || !b.length) return 0;

  return a.filter((t) => b.includes(t)).length / a.length;
}

function rareOverlap(source: string, target: string) {
  const a = rareTokens(source);
  const b = tokens(target);

  if (!a.length || !b.length) return 0;

  return a.filter((t) => b.includes(t)).length / a.length;
}

function year(value: any) {
  return Number(String(value || '').match(/\d{4}/)?.[0] || 0);
}

function sameVintage(a: string, b: string) {
  const aa = String(a || '').match(/\d{4}/)?.[0] || '';
  const bb = String(b || '').match(/\d{4}/)?.[0] || '';

  if (!aa || !bb) return true;

  return aa === bb;
}

function hasAny(text: string, words: string[]) {
  const n = normalize(text);
  return words.some((w) => n.includes(normalize(w)));
}

function hardConflict(search: string, candidate: string) {
  const s = normalize(search);
  const c = normalize(candidate);

  const criticalGroups = [
    ['nabaifu'],
    ['heyu'],
    ['vidal'],
    ['icewine', 'ice wine'],
    ['semi sweet', 'semisweet'],
    ['happy', 'reunion'],
  ];

  for (const group of criticalGroups) {
    const searchHas = group.some((w) => s.includes(normalize(w)));
    const candidateHas = group.some((w) => c.includes(normalize(w)));

    if (searchHas && !candidateHas) {
      return true;
    }
  }

  if (
    hasAny(s, ['white', 'blanc', 'branco']) &&
    hasAny(c, ['red', 'rouge', 'cabernet', 'merlot', 'syrah', 'marselan'])
  ) {
    return true;
  }

  return false;
}

async function visualDoubleCheck(capturedImage: string, candidates: any[]) {
  const visualCandidates = candidates
    .filter((c) => c.item?.imageUrl)
    .slice(0, 10);

  if (!capturedImage || visualCandidates.length === 0) {
    return null;
  }

  const candidateText = visualCandidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.item.wineName} ${c.item.vintage} | ${c.item.producer} | ${c.item.medal} | ${c.item.session} ${c.item.year}`
    )
    .join('\n');

  const content: any[] = [
    {
      type: 'input_text',
      text: `
Compare the first image, which is the user's captured wine bottle, against the official CMB candidate bottle images.

Return STRICT JSON only:
{
  "matchIndex": 0,
  "confidence": 0,
  "reason": ""
}

Rules:
- matchIndex is 1-based according to the candidate list.
- If none clearly match, return matchIndex 0.
- Use visual identity: label design, bottle shape, typography, colors, layout, capsule, and overall appearance.
- Do not choose a candidate if the bottle is visually different.
- Do not choose a candidate only because the text is vaguely similar.
- If the label design is clearly the same product family and the name/vintage are compatible, choose it.
- confidence must be between 0 and 1.

Candidates:
${candidateText}
      `.trim(),
    },
    {
      type: 'input_image',
      image_url: capturedImage,
      detail: 'high',
    },
  ];

  for (const c of visualCandidates) {
    content.push({
      type: 'input_image',
      image_url: c.item.imageUrl,
      detail: 'high',
    });
  }

  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content,
      },
    ],
  });

  try {
    const parsed = JSON.parse(
      response.output_text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()
    );

    const index = Number(parsed.matchIndex || 0);
    const confidence = Number(parsed.confidence || 0);

    if (index > 0 && confidence >= 0.72) {
      return visualCandidates[index - 1]?.item || null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = String(body.wineName || '');
    const producer = String(body.producer || '');
    const vintage = String(body.vintage || '');
    const detectedText = String(body.detectedText || '');
    const capturedImage = String(body.image || '');

    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'cmb-results.json'
    );

    const raw = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(raw);

    const searchWine = wineName || detectedText;
    const searchAll = [wineName, producer, vintage, detectedText].join(' ');

    const scored = records
      .map((item: any) => {
        const candidateWine = `${item.wineName || ''} ${item.vintage || ''}`;

        const candidateAll = [
          item.wineName,
          item.producer,
          item.vintage,
          item.country,
          item.region,
          item.appellation,
          item.color,
          item.type,
          item.subType,
          item.award,
          item.medal,
          item.session,
        ].join(' ');

        const wineScore = overlap(searchWine, candidateWine);
        const producerScore = producer
          ? overlap(producer, item.producer || '')
          : 0;
        const fullScore = overlap(searchAll, candidateAll);
        const rareScore = rareOverlap(searchAll, candidateAll);
        const vintageOk = sameVintage(vintage, item.vintage || '');
        const vintageExact =
          vintage &&
          item.vintage &&
          String(vintage) === String(item.vintage);

        let score =
          wineScore * 0.52 +
          producerScore * 0.16 +
          fullScore * 0.12 +
          rareScore * 0.2;

        if (vintageExact) score += 0.3;
        if (vintage && !vintageOk) score -= 0.9;

        if (hardConflict(searchAll, candidateAll)) {
          score -= 1.2;
        }

        score += year(item.year) * 0.00002;

        return {
          item,
          score,
          wineScore,
          producerScore,
          fullScore,
          rareScore,
          vintageOk,
          candidateAll,
        };
      })
      .filter((entry: any) => {
        if (!entry.vintageOk) return false;
        if (hardConflict(searchAll, entry.candidateAll)) return false;

        return (
          entry.wineScore >= 0.42 ||
          entry.rareScore >= 0.25 ||
          entry.fullScore >= 0.28
        );
      })
      .sort((a: any, b: any) => b.score - a.score);

    const strongTextCandidates = scored.filter((entry: any) => {
      return entry.score >= 0.55 && entry.wineScore >= 0.45;
    });

    let best = strongTextCandidates[0]?.item || null;

    const visualPool = records
      .filter((item: any) => {
        if (!item.imageUrl) return false;

        const candidateText = [
          item.wineName,
          item.producer,
          item.vintage,
          item.country,
          item.region,
          item.session,
          item.medal,
        ].join(' ');

        const base = overlap(searchAll, candidateText);
        const rare = rareOverlap(searchAll, candidateText);

        return (
          base >= 0.12 ||
          rare >= 0.08 ||
          (hasAny(searchAll, ['nabaifu']) &&
            hasAny(candidateText, ['nabaifu'])) ||
          (hasAny(searchAll, ['heyu']) &&
            hasAny(candidateText, ['heyu'])) ||
          (hasAny(searchAll, ['vidal']) &&
            hasAny(candidateText, ['vidal'])) ||
          (hasAny(searchAll, ['icewine', 'ice wine']) &&
            hasAny(candidateText, ['icewine', 'ice wine'])) ||
          (hasAny(searchAll, ['semi sweet', 'semisweet']) &&
            hasAny(candidateText, ['semi sweet', 'semisweet', 'sweet']))
        );
      })
      .map((item: any) => ({
        item,
        score: overlap(searchAll, [
          item.wineName,
          item.producer,
          item.vintage,
          item.country,
          item.region,
          item.session,
          item.medal,
        ].join(' ')),
      }))
      .sort((a: any, b: any) => {
        const av =
          String(a.item.vintage || '') === String(vintage || '') ? 1 : 0;
        const bv =
          String(b.item.vintage || '') === String(vintage || '') ? 1 : 0;

        if (bv !== av) return bv - av;

        return b.score - a.score;
      })
      .slice(0, 40);

    const visualMatch = await visualDoubleCheck(
      capturedImage,
      visualPool
    );

    if (visualMatch) {
      best = visualMatch;
    }

    if (!best) {
      return NextResponse.json({
        awarded: false,
        reason: 'low_confidence',
      });
    }

    const sameWineRecords = records
      .filter((r: any) => {
        return (
          normalize(r.wineName || '') === normalize(best.wineName || '') &&
          normalize(r.producer || '') === normalize(best.producer || '') &&
          sameVintage(vintage, r.vintage || '')
        );
      })
      .sort((a: any, b: any) => year(b.year) - year(a.year));

    if (sameWineRecords.length) {
      best = sameWineRecords[0];
    }

    return NextResponse.json({
      awarded: true,
      wine: `${best.wineName || ''} ${best.vintage || ''}`.trim(),
      producer: best.producer,
      country: best.location || best.country,
      medal: best.medal,
      session: `${best.session} · ${best.year}`,
      feedbackUrl: best.resultUrl,
      productImageUrl: best.imageUrl,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
      reason: 'server_error',
    });
  }
}