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

function tokenOverlap(source: string, target: string) {
  const a = tokens(source);
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

async function visualDoubleCheck(
  capturedImage: string,
  candidates: any[]
) {
  const visualCandidates = candidates
    .filter((c) => c.item.imageUrl)
    .slice(0, 6);

  if (!capturedImage || visualCandidates.length === 0) return null;

  const candidateText = visualCandidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.item.wineName} ${c.item.vintage} | ${c.item.producer} | ${c.item.medal}`
    )
    .join('\n');

  const content: any[] = [
    {
      type: 'input_text',
      text: `
You are verifying whether a photographed wine bottle matches one of the official CMB database bottle images.

Compare the first image, which is the user's captured bottle photo, against the candidate official bottle images.

Return STRICT JSON only:
{
  "matchIndex": 0,
  "confidence": 0,
  "reason": ""
}

Rules:
- matchIndex must be 1-based according to the candidate list.
- If none clearly match, return matchIndex 0.
- Use visual identity: label design, bottle shape, typography, colors, layout, capsule, and overall appearance.
- Do not choose a candidate only because the text is similar.
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
      response.output_text.replace(/```json/g, '').replace(/```/g, '').trim()
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
        ].join(' ');

        const wineScore = tokenOverlap(searchWine, candidateWine);
        const producerScore = producer
          ? tokenOverlap(producer, item.producer || '')
          : 0;
        const fullScore = tokenOverlap(searchAll, candidateAll);

        const vintageOk = sameVintage(vintage, item.vintage || '');
        const vintageExact =
          vintage && item.vintage && String(vintage) === String(item.vintage);

        let score =
          wineScore * 0.62 +
          producerScore * 0.23 +
          fullScore * 0.15;

        if (vintageExact) score += 0.28;
        if (vintage && !vintageOk) score -= 0.7;

        score += year(item.year) * 0.000025;

        return {
          item,
          score,
          wineScore,
          producerScore,
          fullScore,
          vintageOk,
        };
      })
      .sort((a: any, b: any) => b.score - a.score);

    const strongTextCandidates = scored.filter((entry: any) => {
      if (!entry.vintageOk) return false;
      if (entry.wineScore < 0.55) return false;
      return entry.score >= 0.5;
    });

    let best = strongTextCandidates[0]?.item || null;

    const visualCandidatePool =
      strongTextCandidates.length > 0
        ? strongTextCandidates
        : scored.filter((x: any) => x.vintageOk).slice(0, 18);

    const visualMatch = await visualDoubleCheck(
      capturedImage,
      visualCandidatePool
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