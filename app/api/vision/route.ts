import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractJson(text: string) {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');

  if (first === -1 || last === -1) {
    return cleaned;
  }

  return cleaned.slice(first, last + 1);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = body?.image;

    if (!image) {
      return NextResponse.json({
        wineName: '',
        producer: '',
        vintage: '',
        countryOrRegion: '',
        confidence: 0,
        rawText: 'No image received',
      });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a wine label recognition system. Return only valid JSON. Never use markdown fences.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Read this wine label image carefully.

Return ONLY valid JSON with this exact structure:

{
  "wineName": "",
  "producer": "",
  "vintage": "",
  "countryOrRegion": "",
  "confidence": 0,
  "rawText": ""
}

Rules:
- rawText must include every readable word you can see.
- Do not use markdown.
- Do not wrap the JSON in \`\`\`.
- If uncertain, put the readable text in rawText.
- confidence from 0 to 1.
              `,
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 700,
    });

    const text = completion.choices?.[0]?.message?.content || '';
    const jsonText = extractJson(text);

    let parsed;

    try {
      parsed = JSON.parse(jsonText);
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

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({
      wineName: '',
      producer: '',
      vintage: '',
      countryOrRegion: '',
      confidence: 0,
      rawText: `VISION ERROR: ${String(error?.message || error)}`,
    });
  }
}