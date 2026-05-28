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
  return normalize(value).split(' ').filter((t) => t.length >= 3);
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

function getCandidateText(item: any) {
  return [
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
    item.concours,
  ].join(' ');
}

function identityCompatible(search: string, candidate: string) {
  const s = normalize(search);
  const c = normalize(candidate);

  const critical = [
    'nabaifu',
    'heyu',
    'yizhu',
    'happy',
    'reunion',
    'vidal',
    'icewine',
    'ice wine',
    'semi sweet',
    'semisweet',
  ];

  for (const term of critical) {
    const st = normalize(term);

    if (s.includes(st)) {
      if (st === 'ice wine' && c.includes('icewine')) continue;
      if (st === 'icewine' && c.includes('ice wine')) continue;
      if (st === 'semi sweet' && c.includes('semisweet')) continue;
      if (st === 'semisweet' && c.includes('semi sweet')) continue;

      if (!c.includes(st)) return false;
    }
  }

  if (
    hasAny(s, ['white', 'blanc', 'branco']) &&
    hasAny(c, ['red', 'rouge', 'tinto', 'vranec', 'cabernet', 'merlot', 'syrah', 'marselan'])
  ) {
    return false;
  }

  if (
    hasAny(s, ['icewine', 'ice wine']) &&
    !hasAny(c, ['icewine', 'ice wine'])
  ) {
    return false;
  }

  return true;
}

function isSweetWhiteRescueCandidate(item: any) {
  const text = getCandidateText(item);

  return (
    item.imageUrl &&
    (
      hasAny(text, ['icewine', 'ice wine']) ||
      hasAny(text, ['vidal']) ||
      hasAny(text, ['sweet']) ||
      hasAny(text, ['white', 'blanc']) ||
      hasAny(text, ['nabaifu', 'heyu', 'yizhu'])
    ) &&
    !hasAny(text, ['red', 'rouge', 'tinto', 'vranec', 'cabernet', 'merlot', 'syrah', 'marselan'])
  );
}

async function visualDoubleCheck(capturedImage: string, candidates: any[]) {
  const visualCandidates = candidates.filter((c) => c.item?.imageUrl);

  if (!capturedImage || visualCandidates.length === 0) return null;

  const batches = [];

  for (let i = 0; i < visualCandidates.length; i += 8) {
    batches.push(visualCandidates.slice(i, i + 8));
  }

  for (const batch of batches) {
    const candidateText = batch
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
- matchIndex is 1-based according to the candidate list in this batch.
- If none clearly match, return matchIndex 0.
- Use visual identity: label design, bottle shape, typography, colors, layout, capsule, and overall appearance.
- Do not choose a candidate if the bottle is visually different.
- Do not choose red wine candidates for white/icewine labels.
- For Icewine/Vidal/Semi Sweet/White wines, prioritize label family and exact bottle appearance.
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

    for (const c of batch) {
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
        response.output_text.replace(/```json/g, '').replace(/```/g, '').trim()
      );

      const index = Number(parsed.matchIndex || 0);
      const confidence = Number(parsed.confidence || 0);

      if (index > 0 && confidence >= 0.72) {
        return batch[index - 1]?.item || null;
      }
    } catch {
      continue;
    }
  }

  return null;
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
        const candidateAll = getCandidateText(item);

        const wineScore = overlap(searchWine, candidateWine);
        const producerScore = producer ? overlap(producer, item.producer || '') : 0;
        const fullScore = overlap(searchAll, candidateAll);
        const rareScore = rareOverlap(searchAll, candidateAll);
        const vintageOk = sameVintage(vintage, item.vintage || '');
        const vintageExact =
          vintage && item.vintage && String(vintage) === String(item.vintage);

        let score =
          wineScore * 0.5 +
          producerScore * 0.15 +
          fullScore * 0.15 +
          rareScore * 0.2;

        if (vintageExact) score += 0.4;
        if (vintage && !vintageOk) score -= 1.2;

        if (!identityCompatible(searchAll, candidateAll)) {
          score -= 2.5;
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
        if (!identityCompatible(searchAll, entry.candidateAll)) return false;

        return (
          entry.wineScore >= 0.35 ||
          entry.rareScore >= 0.16 ||
          entry.fullScore >= 0.2
        );
      })
      .sort((a: any, b: any) => b.score - a.score);

    let best =
      scored.find((entry: any) => entry.score >= 0.68)?.item || null;

    const normalVisualPool = scored
      .filter((entry: any) => entry.item.imageUrl)
      .slice(0, 24);

    const rescueVisualPool = records
      .filter((item: any) => {
        if (!isSweetWhiteRescueCandidate(item)) return false;

        const text = getCandidateText(item);

        if (!identityCompatible(searchAll, text)) return false;

        if (
          vintage &&
          item.vintage &&
          String(vintage) !== String(item.vintage)
        ) {
          return false;
        }

        return true;
      })
      .map((item: any) => ({
        item,
        score: overlap(searchAll, getCandidateText(item)),
      }))
      .sort((a: any, b: any) => {
        const av =
          String(a.item.vintage || '') === String(vintage || '') ? 1 : 0;
        const bv =
          String(b.item.vintage || '') === String(vintage || '') ? 1 : 0;

        if (bv !== av) return bv - av;

        return b.score - a.score;
      });

    const combinedVisualPool = Array.from(
      new Map(
        [...normalVisualPool, ...rescueVisualPool].map((entry: any) => [
          `${entry.item.wineName}-${entry.item.vintage}-${entry.item.producer}`,
          entry,
        ])
      ).values()
    ).slice(0, 48);

    const visualMatch = await visualDoubleCheck(capturedImage, combinedVisualPool);

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