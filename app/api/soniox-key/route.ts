import { NextResponse } from 'next/server';

// This endpoint provides the Soniox API key to the client
// In production, you should implement proper authentication
// and potentially use Soniox's temporary key generation
export async function GET() {
  const sonioxApiKey = process.env.SONIOX_API_KEY;

  if (!sonioxApiKey) {
    return NextResponse.json(
      { error: 'Soniox API key not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({ apiKey: sonioxApiKey });
}
