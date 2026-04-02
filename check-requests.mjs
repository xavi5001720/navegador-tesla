const SUPABASE_URL = 'https://uhvwptagewswfiluqgmc.supabase.co';
const ANON_KEY = 'sb_publishable_9EUX4dnQ9rqxS9Bon7SKVg_HXrII5vD';

async function checkRequests() {
  console.log('Checking opensky_requests table...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/opensky_requests?select=*`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });

    const data = await res.json();
    console.log('Current Requests in DB:', JSON.stringify(data, null, 2));
    
    if (data.length > 0) {
      console.log('Last requested at (first item):', new Date(data[0].last_requested_at).toLocaleString());
      console.log('Current Time:', new Date().toLocaleString());
    }
  } catch (err) {
    console.error('Error checking requests:', err.message);
  }
}

checkRequests();
