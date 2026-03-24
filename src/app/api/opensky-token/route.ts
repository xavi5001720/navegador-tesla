import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountIndex = searchParams.get('account');
  
  if (accountIndex !== '2' && accountIndex !== '3') {
    return NextResponse.json({ error: 'Invalid account index. Must be 2 or 3.' }, { status: 400 });
  }

  try {
    const file2 = path.join(process.cwd(), 'API opensky', 'credentials(2).json');
    const file3 = path.join(process.cwd(), 'API opensky', 'credentials(3).json');
    const filePath = accountIndex === '2' ? file2 : file3;
    
    if (!fs.existsSync(filePath)) {
       return NextResponse.json({ error: 'Credentials file not found.' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const credentials = JSON.parse(fileContent);

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
