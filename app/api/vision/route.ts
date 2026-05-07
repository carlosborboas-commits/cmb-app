import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
        rawText: '',
        debug: 'No image received',
      });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You analyze wine labels and extract visible wine information.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Analyze this wine label image.

Return ONLY valid JSON.

Format:
{
  "wineName": "",
  "producer": "",
  "vintage": "",
  "countryOrRegion": "",
  "confidence": 0,
  "rawText": ""
}

Rules:
- Extract ALL readable text.
- Never say "not detected".
- rawText must contain all readable text.
- confidence from 0 to 1.
              `,
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const text =
      completion.choices?.[0]?.message?.content || '';

    console.log('VISION RAW:', text);

    let parsed;

    try {
      parsed = JSON.parse(text);
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
    console.error('VISION ERROR:', error);

    return NextResponse.json({
      wineName: '',
      producer: '',
      vintage: '',
      countryOrRegion: '',
      confidence: 0,
      rawText: '',
      debug: String(error?.message || error),
    });
  }
}