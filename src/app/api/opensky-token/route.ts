import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountIndex = searchParams.get('account');
  
  if (accountIndex !== '2' && accountIndex !== '3') {
    return NextResponse.json({ error: 'Invalid account index. Must be 2 or 3.' }, { status: 400 });
  }

  try {
    let credentials;
    // Forzamos al bundler de Vercel/Next.js a hidratar el JSON en el código directamente
    if (accountIndex === '2') {
      credentials = require('../../../../../API opensky/credentials(2).json');
    } else {
      credentials = require('../../../../../API opensky/credentials(3).json');
    }

    const tokenResponse = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
      cache: 'no-store'
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token fetch failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    return NextResponse.json({ access_token: tokenData.access_token });
  } catch (error) {
    console.error(`[opensky-token] Error fetching token for account ${accountIndex}:`, error);
    return NextResponse.json({ error: 'Failed to fetch token' }, { status: 500 });
  }
}
