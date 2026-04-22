import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const YACHTS = [
  { mmsi: '319618000', name: 'Plan B', owner: 'Brad Pitt', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Brad_Pitt_2019_by_Glenn_Francis.jpg/220px-Brad_Pitt_2019_by_Glenn_Francis.jpg' },
  { mmsi: '319306200', name: 'Faith', owner: 'Lawrence Stroll', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Lawrence_Stroll_2019.jpg/220px-Lawrence_Stroll_2019.jpg' },
  { mmsi: '538071163', name: 'Coral Ocean', owner: 'Ian Malouf', owner_photo_url: 'https://images.crunchbase.com/image/upload/c_thumb,h_256,w_256,f_auto,g_faces,z_0.7/v1438914605/j0r9j7j8j7j8j7j8j7j8.jpg' },
  { mmsi: '303455000', name: 'Utopia IV', owner: 'J.R. Ridinger', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/JR_Ridinger.jpg/220px-JR_Ridinger.jpg' },
  { mmsi: '538071476', name: 'Kismet', owner: 'Shahid Khan', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Shahid_Khan_2013.jpg/220px-Shahid_Khan_2013.jpg' },
  { mmsi: '339304000', name: 'Vision', owner: '44m Feadship', owner_photo_url: 'https://www.feadship.nl/images/yachts/vision/vision_1.jpg' },
  { mmsi: '247337500', name: 'Seven', owner: 'David Beckham', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/David_Beckham_2024.jpg/220px-David_Beckham_2024.jpg' },
  { mmsi: '319866000', name: 'Octopus', owner: 'Paul Allen', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Paul_Allen_2011.jpg/220px-Paul_Allen_2011.jpg' },
  { mmsi: '235075032', name: 'Nahlin', owner: 'James Dyson', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/James_Dyson_2013.jpg/220px-James_Dyson_2013.jpg' },
  { mmsi: '319225300', name: 'Seven Seas', owner: 'Familia Jobs', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Steve_Jobs_headshot_2010-edit.jpg/220px-Steve_Jobs_headshot_2010-edit.jpg' },
  { mmsi: '319524000', name: 'Dragonfly', owner: 'Larry Page', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Larry_Page_in_the_European_Parliament%2C_2009.jpg/220px-Larry_Page_in_the_European_Parliament%2C_2009.jpg' },
  { mmsi: '319113100', name: 'Black Pearl', owner: 'Oleg Burlakov', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Oleg_Burlakov.jpg/220px-Oleg_Burlakov.jpg' },
  { mmsi: '538071581', name: 'Dream', owner: 'Michael Schumacher', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Michael_Schumacher_2012.jpg/220px-Michael_Schumacher_2012.jpg' },
  { mmsi: '235057247', name: 'Mirage', owner: '53m Feadship', owner_photo_url: 'https://www.feadship.nl/images/yachts/mirage/mirage_1.jpg' },
  { mmsi: '319133100', name: 'Nord', owner: 'Alexey Mordashov', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Alexey_Mordashov_2018.jpg/220px-Alexey_Mordashov_2018.jpg' },
  { mmsi: '249555000', name: 'Maltese Falcon', owner: 'Elena Ambrosiadou', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Elena_Ambrosiadou.jpg/220px-Elena_Ambrosiadou.jpg' },
  { mmsi: '319133800', name: 'Flying Fox', owner: 'Jeff Bezos', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Jeff_Bezos_at_the_2017_Amazon_Port_Palace_Blue_Carpet_in_Cannes.jpg/220px-Jeff_Bezos_at_the_2017_Amazon_Port_Palace_Blue_Carpet_in_Cannes.jpg' },
  { mmsi: '319137200', name: 'Lady S', owner: 'Sergey Brin', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Sergey_Brin_2017.jpg/220px-Sergey_Brin_2017.jpg' },
  { mmsi: '319205400', name: 'Boardwalk', owner: 'Tilman Fertitta', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Tilman_Fertitta_2018.jpg/220px-Tilman_Fertitta_2018.jpg' },

  { mmsi: '319142100', name: 'Joy', owner: 'Michael Jordan', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Michael_Jordan_in_2014.jpg/220px-Michael_Jordan_in_2014.jpg' },
  { mmsi: '319011700', name: 'Privacy', owner: 'Tiger Woods', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Tiger_Woods_2018.jpg/220px-Tiger_Woods_2018.jpg' },
  { mmsi: '247348100', name: 'Aurelia', owner: 'Conor McGregor', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Conor_McGregor_2018.jpg/220px-Conor_McGregor_2018.jpg' },
  { mmsi: '247228800', name: 'Main', owner: 'Giorgio Armani', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Giorgio_Armani_2013.jpg/220px-Giorgio_Armani_2013.jpg' },
  { mmsi: '310165000', name: 'Cyan', owner: 'Bono (U2)', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Bono_2017.jpg/220px-Bono_2017.jpg' },
  { mmsi: '319022600', name: 'Va Bene', owner: 'Eric Clapton', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Eric_Clapton_2010.jpg/220px-Eric_Clapton_2010.jpg' },
  { mmsi: '319192000', name: 'Maraya', owner: 'Sean \'Diddy\' Combs', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Sean_Combs_2010.jpg/220px-Sean_Combs_2010.jpg' },
  { mmsi: '319082100', name: 'Amphitrite', owner: 'Johnny Depp', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Johnny_Depp_2020.jpg/220px-Johnny_Depp_2020.jpg' },
  { mmsi: '319107400', name: 'Aquarius', owner: 'Shakira', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Shakira_2023.jpg/220px-Shakira_2023.jpg' },
  { mmsi: '511100826', name: 'Azzurra II', owner: 'Cristiano Ronaldo', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cristiano_Ronaldo_2018.jpg/220px-Cristiano_Ronaldo_2018.jpg' },
  { mmsi: '538070201', name: 'Sirona III', owner: 'Lewis Hamilton', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Lewis_Hamilton_2021.jpg/220px-Lewis_Hamilton_2021.jpg' },
  { mmsi: '319327000', name: 'Venus', owner: 'Steve Jobs / Laurene Powell', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Laurene_Powell_Jobs_2017.jpg/220px-Laurene_Powell_Jobs_2017.jpg' },
  { mmsi: '319043200', name: 'A+ (Topaz)', owner: 'Eddie Murphy', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Eddie_Murphy_2019.jpg/220px-Eddie_Murphy_2019.jpg' },
  { mmsi: '310593000', name: 'Eclipse', owner: 'Roman Abramovich', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Roman_Abramovich_2018.jpg/220px-Roman_Abramovich_2018.jpg' },
  { mmsi: '319111000', name: 'Solaris', owner: 'Roman Abramovich', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Roman_Abramovich_2018.jpg/220px-Roman_Abramovich_2018.jpg' },
  { mmsi: '538071064', name: 'Sailing Yacht A', owner: 'Andrey Melnichenko', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Andrey_Melnichenko_2018.jpg/220px-Andrey_Melnichenko_2018.jpg' },
  { mmsi: '319000001', name: 'Dilbar', owner: 'Alisher Usmanov', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Alisher_Usmanov_2018.jpg/220px-Alisher_Usmanov_2018.jpg' },
  { mmsi: '319028000', name: 'Rising Sun', owner: 'David Geffen', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/David_Geffen_2017.jpg/220px-David_Geffen_2017.jpg' },
  { mmsi: '319111400', name: 'Kaos', owner: 'Nancy Walton', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Nancy_Walton_Laurie.jpg/220px-Nancy_Walton_Laurie.jpg' },
  { mmsi: '319763000', name: 'Eos', owner: 'Barry Diller', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Barry_Diller_2017.jpg/220px-Barry_Diller_2017.jpg' },
  { mmsi: '319034900', name: 'Vava II', owner: 'Ernesto Bertarelli', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Ernesto_Bertarelli_2013.jpg/220px-Ernesto_Bertarelli_2013.jpg' },
  { mmsi: '319522000', name: 'Athena', owner: 'Jim Clark', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Jim_Clark_2017.jpg/220px-Jim_Clark_2017.jpg' },
  { mmsi: '240590000', name: 'Christina O', owner: 'Aristóteles Onassis', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Aristotle_Onassis_1967.jpg/220px-Aristotle_Onassis_1967.jpg' },
  { mmsi: '538071192', name: 'Savannah', owner: 'Lukas Lundin', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Lukas_Lundin_2013.jpg/220px-Lukas_Lundin_2013.jpg' },
  { mmsi: '319161000', name: 'Scheherazade', owner: 'Eduard Khudainatov', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Eduard_Khudainatov.jpg/220px-Eduard_Khudainatov.jpg' },
  { mmsi: '319021900', name: 'Serene', owner: 'Mohammed bin Salman', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Mohammed_bin_Salman_2018.jpg/220px-Mohammed_bin_Salman_2018.jpg' },
  { mmsi: '310065000', name: 'Grand Ocean', owner: 'Blohm & Voss', owner_photo_url: 'https://www.blohmvoss.com/images/grand-ocean.jpg' },
  { mmsi: '319030100', name: 'Palladium', owner: 'Mikhail Prokhorov', owner_photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Mikhail_Prokhorov_2011.jpg/220px-Mikhail_Prokhorov_2011.jpg' },
  { mmsi: '235011746', name: 'Euphoria', owner: '29m Mayra', owner_photo_url: 'https://www.mayrayachts.com/images/euphoria_1.jpg' },
  { mmsi: '511100679', name: 'Muse', owner: '37m Palmer Johnson', owner_photo_url: 'https://www.palmerjohnson.com/images/yachts/muse/muse_1.jpg' },
  { mmsi: '256230000', name: 'Serendipity', owner: '40m Perini Navi', owner_photo_url: 'https://www.perininavi.it/images/yachts/serendipity/serendipity_1.jpg' }
];

async function updateYachtList() {
  console.log('--- UPDATING YACHT LIST WITH PHOTOS ---');
  
  // Clean first
  await supabase.from('luxury_yacht_list').delete().neq('mmsi', '0');
  
  // Insert with photos
  const { error } = await supabase.from('luxury_yacht_list').insert(YACHTS);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Successfully updated yacht list with 50 VIP photos.');
  }
}

updateYachtList();
