import { NextRequest, NextResponse } from 'next/server';
import { fetchEscapadas, EscapadaSearchQuery } from '@/lib/travelpayouts';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const origin = searchParams.get('origin') || 'MAD';
    const destination = searchParams.get('destination') || 'ANY';
    const adults = parseInt(searchParams.get('adults') || '2', 10);
    const children = parseInt(searchParams.get('children') || '0', 10);
    const infants = parseInt(searchParams.get('infants') || '0', 10);

    const durationDays = parseInt(searchParams.get('durationDays') || '2', 10);
    const flexibility = (searchParams.get('flexibility') || 'weekend') as EscapadaSearchQuery['flexibility'];
    const month = searchParams.get('month') || undefined;
    const minStars = parseInt(searchParams.get('minStars') || '3', 10);
    const evChargingOnly = searchParams.get('evChargingOnly') === 'true';

    const query: EscapadaSearchQuery = {
      origin,
      destination,
      adults,
      children,
      infants,
      durationDays,
      flexibility,
      month,
      minStars,
      evChargingOnly,
    };

    const deals = await fetchEscapadas(query);

    return NextResponse.json({
      success: true,
      query,
      count: deals.length,
      deals,
    });
  } catch (error: any) {
    console.error('Error in /api/escapadas/search:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error procesando la búsqueda' },
      { status: 500 }
    );
  }
}
