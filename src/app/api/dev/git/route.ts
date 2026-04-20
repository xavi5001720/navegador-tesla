import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// GET: Ver historial de un módulo
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get('moduleId');

  if (!moduleId) {
    return NextResponse.json({ error: 'Falta moduleId' }, { status: 400 });
  }

  try {
    // Buscamos commits que contengan el [moduleId] en el mensaje
    const { stdout } = await execAsync(`git log --grep="\\[${moduleId}\\]" --pretty=format:"%h|%ad|%s" --date=short -n 20`);
    
    const history = stdout.split('\n').filter(line => line.trim()).map(line => {
      const [hash, date, message] = line.split('|');
      return { hash, date, message };
    });

    return NextResponse.json({ history });
  } catch (err) {
    console.error('Error Git Log:', err);
    return NextResponse.json({ history: [] }); // Si no hay commits devuelve vacío
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
    // Nota: Usamos git add . para asegurar que se guardan los cambios actuales del proyecto
    await execAsync(`git add . && git commit -m "${fullMessage}"`);

    return NextResponse.json({ success: true, message: fullMessage });
  } catch (err: any) {
    console.error('Error Git Commit:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
