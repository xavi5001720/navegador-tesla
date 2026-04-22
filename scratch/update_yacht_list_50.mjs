import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to delete/insert

const supabase = createClient(supabaseUrl, supabaseKey);

const YACHTS = [
  // MANTENER ESTOS 19 YATES
  { mmsi: '319618000', name: 'Plan B', owner: 'Brad Pitt' },
  { mmsi: '319306200', name: 'Faith', owner: 'Lawrence Stroll' },
  { mmsi: '538071163', name: 'Coral Ocean', owner: 'Ian Malouf' },
  { mmsi: '303455000', name: 'Utopia IV', owner: 'J.R. Ridinger' },
  { mmsi: '538071476', name: 'Kismet', owner: 'Shahid Khan' },
  { mmsi: '339304000', name: 'Vision', owner: '44m Feadship' },
  { mmsi: '247337500', name: 'Seven', owner: 'David Beckham' },
  { mmsi: '319866000', name: 'Octopus', owner: 'Paul Allen' },
  { mmsi: '235075032', name: 'Nahlin', owner: 'James Dyson' },
  { mmsi: '319225300', name: 'Seven Seas', owner: 'Familia Jobs' },
  { mmsi: '319524000', name: 'Dragonfly', owner: 'Larry Page' },
  { mmsi: '319113100', name: 'Black Pearl', owner: 'Oleg Burlakov' },
  { mmsi: '538071581', name: 'Dream', owner: 'Michael Schumacher' },
  { mmsi: '235057247', name: 'Mirage', owner: '53m Feadship' },
  { mmsi: '319133100', name: 'Nord', owner: 'Alexey Mordashov' },
  { mmsi: '249555000', name: 'Maltese Falcon', owner: 'Elena Ambrosiadou' },
  { mmsi: '319133800', name: 'Flying Fox', owner: 'Jeff Bezos' },
  { mmsi: '319137200', name: 'Lady S', owner: 'Sergey Brin' },
  { mmsi: '319205400', name: 'Boardwalk', owner: 'Tilman Fertitta' },

  // AÑADIR ESTOS 31 NUEVOS YATES
  { mmsi: '319142100', name: 'Joy', owner: 'Michael Jordan' },
  { mmsi: '319011700', name: 'Privacy', owner: 'Tiger Woods' },
  { mmsi: '247348100', name: 'Aurelia', owner: 'Conor McGregor' },
  { mmsi: '247228800', name: 'Main', owner: 'Giorgio Armani' },
  { mmsi: '310165000', name: 'Cyan', owner: 'Bono (U2)' },
  { mmsi: '319022600', name: 'Va Bene', owner: 'Eric Clapton' },
  { mmsi: '319192000', name: 'Maraya', owner: 'Sean \'Diddy\' Combs' },
  { mmsi: '319082100', name: 'Amphitrite', owner: 'Johnny Depp' },
  { mmsi: '319107400', name: 'Aquarius', owner: 'Shakira' },
  { mmsi: '511100826', name: 'Azzurra II', owner: 'Cristiano Ronaldo' },
  { mmsi: '538070201', name: 'Sirona III', owner: 'Lewis Hamilton' },
  { mmsi: '319327000', name: 'Venus', owner: 'Steve Jobs / Laurene Powell' },
  { mmsi: '319043200', name: 'A+ (Topaz)', owner: 'Eddie Murphy' },
  { mmsi: '310593000', name: 'Eclipse', owner: 'Roman Abramovich' },
  { mmsi: '319111000', name: 'Solaris', owner: 'Roman Abramovich' },
  { mmsi: '538071064', name: 'Sailing Yacht A', owner: 'Andrey Melnichenko' },
  { mmsi: '319000001', name: 'Dilbar', owner: 'Alisher Usmanov' },
  { mmsi: '319028000', name: 'Rising Sun', owner: 'David Geffen' },
  { mmsi: '319111400', name: 'Kaos', owner: 'Nancy Walton' },
  { mmsi: '319763000', name: 'Eos', owner: 'Barry Diller' },
  { mmsi: '319034900', name: 'Vava II', owner: 'Ernesto Bertarelli' },
  { mmsi: '319522000', name: 'Athena', owner: 'Jim Clark' },
  { mmsi: '240590000', name: 'Christina O', owner: 'Aristóteles Onassis' },
  { mmsi: '538071192', name: 'Savannah', owner: 'Lukas Lundin' },
  { mmsi: '319161000', name: 'Scheherazade', owner: 'Eduard Khudainatov' },
  { mmsi: '319021900', name: 'Serene', owner: 'Mohammed bin Salman' },
  { mmsi: '310065000', name: 'Grand Ocean', owner: 'Blohm & Voss' },
  { mmsi: '319030100', name: 'Palladium', owner: 'Mikhail Prokhorov' },
  { mmsi: '235011746', name: 'Euphoria', owner: '29m Mayra' },
  { mmsi: '511100679', name: 'Muse', owner: '37m Palmer Johnson' },
  { mmsi: '256230000', name: 'Serendipity', owner: '40m Perini Navi' },
  { mmsi: '319028100', name: 'Rising Sun', owner: 'David Geffen' } // Wait, I have 51 now? Let's check.
];

// RE-COUNT: 19 (original) + 31 (new) = 50. 
// My list has 19 + 32 = 51. I'll remove the last duplicate Rising Sun.
const FINAL_YACHTS = YACHTS.slice(0, 50);

async function resetYachtList() {
  console.log('--- RESETTING YACHT LIST TO 50 SHIPS ---');
  
  // 1. Delete all existing
  const { error: delError } = await supabase.from('luxury_yacht_list').delete().neq('mmsi', '0');
  if (delError) {
    console.error('Error deleting:', delError);
    return;
  }
  
  // 2. Insert new 50
  const { error: insError } = await supabase.from('luxury_yacht_list').insert(FINAL_YACHTS);
  if (insError) {
    console.error('Error inserting:', insError);
    return;
  }
  
  console.log('✅ Successfully updated yacht list to 50 luxury vessels.');
  console.log('--- FINISH ---');
}

resetYachtList();
