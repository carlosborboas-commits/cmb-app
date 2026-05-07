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
        rawText: 'DEBUG: No image received by API',
      });
    }

    const imageInfo = `DEBUG IMAGE RECEIVED. Length: ${image.length}. Starts with: ${String(image).slice(0, 40)}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a wine label recognition system. You must read visible text from wine labels.',
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
- Do not write "not detected".
- If you are unsure, guess from visible text.
- If the image is unclear, describe what you see in rawText.
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
        rawText: `NON JSON RESPONSE: ${text}`,
      };
    }

    return NextResponse.json({
      ...parsed,
      rawText: `${parsed.rawText || ''}\n\n${imageInfo}`,
    });
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