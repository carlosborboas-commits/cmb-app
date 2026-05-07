import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = body?.image;

    if (!image) {
      return NextResponse.json(
        {
          wineName: '',
          producer: '',
          vintage: '',
          countryOrRegion: '',
          confidence: 0,
          rawText: '',
          debug: 'No image received by /api/vision',
        },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
You are reading a wine bottle label.

Do your best to extract visible text and identify:
- wine name
- producer / winery / brand
- vintage
- region or country

Return ONLY valid JSON:
{
  "wineName": "",
  "producer": "",
  "vintage": "",
  "countryOrRegion": "",
  "confidence": 0,
  "rawText": "",
  "debug": ""
}

Important:
- Never return "not detected".
- If unsure, put the readable words in rawText and explain briefly in debug.
- confidence from 0 to 1.
              `,
            },
            {
              type: 'input_image',
              image_url: image,
              detail: 'high',
            },
          ],
        },
      ],
    });

    const text = response.output_text || '';

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
        debug: 'OpenAI returned non-JSON text',
      };
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('VISION ERROR:', error);

    return NextResponse.json(
      {
        wineName: '',
        producer: '',
        vintage: '',
        countryOrRegion: '',
        confidence: 0,
        rawText: '',
        debug: String(error?.message || error || 'Unknown vision error'),
      },
      { status: 500 }
    );
  }
}