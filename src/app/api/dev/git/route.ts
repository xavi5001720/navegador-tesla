import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// GET: Ver historial y estado de un módulo
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get('moduleId');

  if (!moduleId) {
    return NextResponse.json({ error: 'Falta moduleId' }, { status: 400 });
  }

  try {
    // 1. Intentar encontrar git dinámicamente o usar rutas comunes
    let gitCommand = 'git';
    try {
      const { stdout: whichGit } = await execAsync('which git');
      if (whichGit.trim()) gitCommand = whichGit.trim();
    } catch (e) {
      // Si 'which' falla, probamos rutas típicas
      if (fs.existsSync('/usr/bin/git')) gitCommand = '/usr/bin/git';
      else if (fs.existsSync('/bin/git')) gitCommand = '/bin/git';
    }

    console.log(`[Git API] Usando comando: ${gitCommand}`);

    const execOptions = {
      env: { ...process.env, PATH: `${process.env.PATH}:/usr/bin:/bin` },
      cwd: process.cwd()
    };

    // 2. Obtener historial de commits para este módulo
    const { stdout: logStdout } = await execAsync(`${gitCommand} log --grep="\\[${moduleId}\\]" --pretty=format:"%h|%ad|%s" --date=short -n 20`, execOptions);
    
    const history = logStdout.split('\n').filter(line => line.trim()).map(line => {
      const [hash, date, message] = line.split('|');
      return { hash, date, message };
    });

    // 2. Determinar estado (Gray, Green, Orange)
    let status = 'gray';
    if (history.length > 0) {
      status = 'green'; // Por defecto verde si hay historial

      // 4. Verificar si hay cambios locales sin confirmar en archivos que usen este moduleId
      const { stdout: statusStdout } = await execAsync(`${gitCommand} status --porcelain`, execOptions);
      const changedFiles = statusStdout.split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3).trim()); // Obtener ruta relativa del archivo

      for (const file of changedFiles) {
        try {
          const absolutePath = path.join(process.cwd(), file);
          if (fs.existsSync(absolutePath) && !fs.lstatSync(absolutePath).isDirectory()) {
            const content = fs.readFileSync(absolutePath, 'utf8');
            if (content.includes(`moduleId="${moduleId}"`)) {
              status = 'orange';
              break;
            }
          }
        } catch (e) {
          // Ignorar errores de lectura (archivos binarios, etc)
        }
      }
    }

    return NextResponse.json({ history, status });
  } catch (err) {
    console.error('Error Git API:', err);
    return NextResponse.json({ history: [], status: 'gray' });
  }
}

// POST: Crear nuevo checkpoint para un módulo
export async function POST(req: NextRequest) {
  try {
    const { moduleId, message } = await req.json();

    if (!moduleId || !message) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const fullMessage = `[${moduleId}] ✅ ${message}`;

    // 1. Encontrar git
    let gitCommand = 'git';
    if (fs.existsSync('/usr/bin/git')) gitCommand = '/usr/bin/git';
    else if (fs.existsSync('/bin/git')) gitCommand = '/bin/git';

    // 2. Ejecutamos git commit (Solo si hay cambios para evitar error 128)
    const execOptions = {
      env: { ...process.env, PATH: `${process.env.PATH}:/usr/bin:/bin` },
      cwd: process.cwd()
    };

    try {
      // Usamos diff-index para detectar si hay cambios antes de hacer commit
      // El patrón: add && (diff-index || commit) asegura que el comando total devuelva éxito (0) 
      // tanto si se hizo commit como si no había nada que subir.
      await execAsync(`${gitCommand} add . && (${gitCommand} diff-index --quiet HEAD || ${gitCommand} commit -m "${fullMessage}")`, execOptions);
      return NextResponse.json({ success: true, message: fullMessage });
    } catch (err: any) {
      console.error('Error Git Exec:', err.stderr || err.stdout || err.message);
      return NextResponse.json({ 
        error: err.stderr || err.stdout || err.message,
        details: 'El comando de git falló. Revisa que el repositorio esté inicializado y tengas permisos.'
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error('Error Git API POST:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
