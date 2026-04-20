const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 1. CONFIGURACIÓN
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: Faltan variables de entorno en .env.local');
  console.log('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Tablas a respaldar
const TABLES_TO_BACKUP = [
  'radar_zones',
  'community_radars',
  'profiles',
  'friendships',
  'luxury_yacht_list',
  'festivals',
  'friend_invitations',
  'friend_nicknames'
];

async function backupTable(tableName) {
  console.log(`⏳ Respaldando tabla: ${tableName}...`);
  
  try {
    // Usamos select('*') con la Service Role Key para saltarnos cualquier RLS
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.error(`❌ Error en ${tableName}:`, error.message);
      return;
    }

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${tableName}_${timestamp}.json`;
    const filePath = path.join(backupDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ ${tableName} guardada en: ${fileName} (${data.length} registros)`);
    
    // Crear también un archivo "latest" para facilitar la restauración rápida
    const latestPath = path.join(backupDir, `${tableName}_latest.json`);
    fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));

  } catch (err) {
    console.error(`💥 Error inesperado en ${tableName}:`, err);
  }
}

async function runBackup() {
  console.log('🚀 Iniciando Backup de Base de Datos Supabase...');
  console.log('------------------------------------------------');
  
  for (const table of TABLES_TO_BACKUP) {
    await backupTable(table);
  }
  
  console.log('------------------------------------------------');
  console.log('✨ Backup finalizado con éxito.');
}

runBackup();
