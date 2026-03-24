import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountIndex = searchParams.get('account');
  
  if (accountIndex !== '2' && accountIndex !== '3') {
    return NextResponse.json({ error: 'Invalid account index. Must be 2 or 3.' }, { status: 400 });
  }

  try {
    // En Vercel, incluir carpetas externas al root a veces da problemas en producción.
    // Como son estáticas y privadas, las leemos directamente aquí.
    const credentialsMap: Record<string, { clientId: string, clientSecret: string }> = {
      '2': {
        clientId: 'pepinperez-api-client',
        clientSecret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A'
      },
      '3': {
        clientId: 'saracruzhortelana-api-client',
        clientSecret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1'
      }
    };

    const credentials = credentialsMap[accountIndex];
    
    if (!credentials) {
      return NextResponse.json({ error: 'Credentials not found.' }, { status: 404 });
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
