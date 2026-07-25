import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// GET: Ver historial y estado de un módulo
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ history: [], status: 'gray' });
  }

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get('moduleId');

  if (!moduleId) {
    return NextResponse.json({ error: 'Falta moduleId' }, { status: 400 });
  }

  try {
    let gitCommand = 'git';
    if (fs.existsSync('/usr/bin/git')) gitCommand = '/usr/bin/git';
    else if (fs.existsSync('/bin/git')) gitCommand = '/bin/git';

    const execOptions = {
      env: { ...process.env, PATH: `${process.env.PATH}:/usr/bin:/bin` },
      cwd: process.cwd()
    };

    const { stdout: logStdout } = await execAsync(`${gitCommand} log -F --grep="[${moduleId}]" --pretty=format:"%h|%ad|%s" --date=short -n 20`, execOptions);
    
    const history = logStdout.split('\n').filter(line => line.trim()).map(line => {
      const [hash, date, message] = line.split('|');
      return { hash, date, message };
    });

    let status = 'gray';
    if (history.length > 0) {
      status = 'green';
    }

    return NextResponse.json({ history, status });
  } catch (err) {
    console.error('Error Git API:', err);
    return NextResponse.json({ history: [], status: 'gray' });
  }
}

// POST: Crear nuevo checkpoint para un módulo
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Dev route disabled in production' }, { status: 403 });
  }

  try {
    const { moduleId, message } = await req.json();

    if (!moduleId || !message) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    let gitCommand = 'git';
    if (fs.existsSync('/usr/bin/git')) gitCommand = '/usr/bin/git';
    else if (fs.existsSync('/bin/git')) gitCommand = '/bin/git';

    const execOptions = {
      env: { ...process.env, PATH: `${process.env.PATH}:/usr/bin:/bin` },
      cwd: process.cwd()
    };

    const commitMsg = `[${moduleId}] ✅ Checkpoint Blindado: ${message}`;
    await execAsync(`${gitCommand} add . && ${gitCommand} commit --allow-empty -m "${commitMsg}"`, execOptions);
    
    return NextResponse.json({ 
      success: true, 
      message: `🛡️ Módulo ${moduleId} marcado como BLINDADO con éxito.`,
      status: 'success' 
    });
  } catch (err: any) {
    console.error('Error Git API POST:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
