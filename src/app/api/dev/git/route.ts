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
    // 1. Obtener historial de commits para este módulo
    const GIT_PATH = '/usr/bin/git';
    const { stdout: logStdout } = await execAsync(`${GIT_PATH} log --grep="\\[${moduleId}\\]" --pretty=format:"%h|%ad|%s" --date=short -n 20`);
    
    const history = logStdout.split('\n').filter(line => line.trim()).map(line => {
      const [hash, date, message] = line.split('|');
      return { hash, date, message };
    });

    // 2. Determinar estado (Gray, Green, Orange)
    let status = 'gray';
    if (history.length > 0) {
      status = 'green'; // Por defecto verde si hay historial

      // 3. Verificar si hay cambios locales sin confirmar en archivos que usen este moduleId
      const { stdout: statusStdout } = await execAsync(`${GIT_PATH} status --porcelain`);
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

    // Ejecutamos git commit
    const GIT_PATH = '/usr/bin/git';
    await execAsync(`${GIT_PATH} add . && ${GIT_PATH} commit -m "${fullMessage}"`);

    return NextResponse.json({ success: true, message: fullMessage });
  } catch (err: any) {
    console.error('Error Git Commit:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
