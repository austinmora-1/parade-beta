import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeCity(city: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', city);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status === 'OK' && data.results?.length > 0) {
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tripLocation, friendCities } = await req.json();
    // tripLocation: string (city name)
    // friendCities: Array<{ userId: string, city: string }>

    if (!tripLocation || !friendCities?.length) {
      return new Response(
        JSON.stringify({ nearbyFriendIds: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('Google Places API key not configured');
    }

    // Geocode trip destination
    const tripCoords = await geocodeCity(tripLocation, apiKey);
    if (!tripCoords) {
      return new Response(
        JSON.stringify({ nearbyFriendIds: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate friend cities to minimize API calls
    const uniqueCities = new Map<string, { lat: number; lng: number } | null>();
    const cityKey = (c: string) => c.trim().toLowerCase();

    for (const fc of friendCities) {
      const key = cityKey(fc.city);
      if (!uniqueCities.has(key)) {
        uniqueCities.set(key, null); // placeholder
      }
    }

    // Geocode each unique city (in parallel, batched)
    const geocodePromises = Array.from(uniqueCities.keys()).map(async (key) => {
      const coords = await geocodeCity(key, apiKey);
      uniqueCities.set(key, coords);
    });
    await Promise.all(geocodePromises);

    // Filter friends within 25 miles
    const RADIUS_MILES = 25;
    const nearbyFriendIds: string[] = [];

    for (const fc of friendCities) {
      const coords = uniqueCities.get(cityKey(fc.city));
      if (!coords) continue;
      const dist = haversineDistance(tripCoords.lat, tripCoords.lng, coords.lat, coords.lng);
      if (dist <= RADIUS_MILES) {
        nearbyFriendIds.push(fc.userId);
      }
    }

    return new Response(
      JSON.stringify({ nearbyFriendIds }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in filter-friends-by-location:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
