import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const image = body.image;

    if (!image) {
      return NextResponse.json({
        wineName: '',
        producer: '',
        vintage: '',
        countryOrRegion: '',
        confidence: 0,
        rawText: '',
      });
    }

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
You are a wine-label recognition system for Concours Mondial de Bruxelles.

Analyze the wine label image and extract ONLY the commercially useful wine-identification fields.

Return STRICT JSON only. No markdown. No explanation.

Rules:
- Prioritize the FRONT LABEL.
- Identify the wine name as the main commercial label name or cuvée.
- Do not use importer text, legal warning text, barcode text, alcohol statement, bottle size, marketing slogans, address, back-label text, or appellation as the wine name.
- If the label shows a vintage year, return it as vintage.
- If producer is visible, return producer.
- If country, region or appellation is visible, return countryOrRegion.
- Do not invent missing data.
- If unsure, leave the field empty.
- rawText should include only relevant label text, not every legal or back-label phrase.

JSON schema:
{
  "wineName": "",
  "producer": "",
  "vintage": "",
  "countryOrRegion": "",
  "confidence": 0,
  "rawText": ""
}
              `.trim(),
            },
            {
              type: 'input_image',
              image_url: image,
            },
          ],
        },
      ],
    });

    const text = response.output_text || '';

    let parsed: any = null;

    try {
      const cleaned = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        wineName: '',
        producer: '',
        vintage: '',
        countryOrRegion: '',
        confidence: 0,
        rawText: text,
      };
    }

    return NextResponse.json({
      wineName: safeString(parsed.wineName),
      producer: safeString(parsed.producer),
      vintage: safeString(parsed.vintage),
      countryOrRegion: safeString(parsed.countryOrRegion),
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
      rawText: safeString(parsed.rawText),
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      wineName: '',
      producer: '',
      vintage: '',
      countryOrRegion: '',
      confidence: 0,
      rawText: '',
    });
  }
}