import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BufReader, BufWriter } from "https://deno.land/std@0.168.0/io/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendSmtpEmail(opts: {
  smtpHost: string
  smtpPort: number
  user: string
  pass: string
  from: string
  to: string
  subject: string
  html: string
}) {
  const conn = await Deno.connectTls({ hostname: opts.smtpHost, port: opts.smtpPort })
  const reader = new BufReader(conn)
  const writer = new BufWriter(conn)
  const encoder = new TextEncoder()

  async function readAll(): Promise<string> {
    let result = ''
    while (true) {
      const line = await reader.readString('\n')
      if (!line) throw new Error('Connection closed unexpectedly')
      result += line
      console.log('SMTP <', line.trim())
      // If the 4th char is a space, this is the last line of the response
      if (line.length >= 4 && line[3] === ' ') break
    }
    return result.trim()
  }

  async function send(command: string): Promise<string> {
    const masked = command.startsWith('AUTH') ? 'AUTH LOGIN ****' : command
    console.log('SMTP >', masked)
    await writer.write(encoder.encode(command + '\r\n'))
    await writer.flush()
    return await readAll()
  }

  // Greeting
  await readAll()

  // EHLO
  let resp = await send('EHLO [127.0.0.1]')
  if (!resp.startsWith('250')) throw new Error(`EHLO failed: ${resp}`)

  // AUTH LOGIN
  resp = await send('AUTH LOGIN')
  if (!resp.startsWith('334')) throw new Error(`AUTH init failed: ${resp}`)

  resp = await send(btoa(opts.user))
  if (!resp.startsWith('334')) throw new Error(`AUTH user failed: ${resp}`)

  resp = await send(btoa(opts.pass))
  if (!resp.startsWith('235')) throw new Error(`AUTH pass failed: ${resp}`)

  // MAIL FROM
  resp = await send(`MAIL FROM:<${opts.from}>`)
  if (!resp.startsWith('250')) throw new Error(`MAIL FROM failed: ${resp}`)

  // RCPT TO
  resp = await send(`RCPT TO:<${opts.to}>`)
  if (!resp.startsWith('250')) throw new Error(`RCPT TO failed: ${resp}`)

  // DATA
  resp = await send('DATA')
  if (!resp.startsWith('354')) throw new Error(`DATA failed: ${resp}`)

  // Message
  const boundary = `boundary_${Date.now()}`
  const message = [
    `From: "NavegaPRO" <${opts.from}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    `Tu amigo ${senderName} te ha invitado a NavegaPRO. Regístrate ahora y únete, tu amigo te espera: https://navegador-tesla.vercel.app`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
    ``,
    `.`,
    ``,
  ].join('\r\n')

  await writer.write(encoder.encode(message))
  await writer.flush()

  resp = await readAll()
  if (!resp.startsWith('250')) throw new Error(`Send failed: ${resp}`)

  await send('QUIT')
  conn.close()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { senderName, receiverEmail } = await req.json()
    console.log(`Sending invite from "${senderName}" to ${receiverEmail}`)

    const smtpUser = Deno.env.get("SMTP_USER") ?? "registros@viajandoentesla.es"
    const smtpPass = Deno.env.get("SMTP_PASS") ?? ""

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- LOGO -->
    <div style="text-align:center;margin-bottom:36px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:16px 28px;border-radius:16px;">
        <span style="font-size:32px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-2px;text-shadow:0 2px 12px rgba(0,0,0,0.5);">Navega<span style="color:#93c5fd;">PRO</span></span>
      </div>
    </div>

    <!-- CARD PRINCIPAL -->
    <div style="background-color:#111;border:1px solid #222;border-radius:24px;padding:36px;">

      <p style="font-size:20px;line-height:1.6;color:#fff;margin:0 0 16px;">Hola,</p>

      <p style="font-size:18px;line-height:1.6;color:#e5e7eb;margin:0 0 28px;">
        Tu amigo <strong style="color:#fff;">${senderName}</strong> te ha invitado a unirte a la red social de <strong style="color:#3b82f6;">NavegaPRO</strong> para conductores.
      </p>

      <!-- DESCRIPCIÓN -->
      <div style="background-color:#0d0d0d;border:1px solid #2a2a2a;border-left:3px solid #3b82f6;padding:24px;border-radius:16px;margin-bottom:28px;">
        <h2 style="font-size:13px;color:#3b82f6;text-transform:uppercase;letter-spacing:2px;margin:0 0 20px;font-weight:700;">¿Qué es NavegaPRO?</h2>
        <ul style="padding-left:0;color:#d1d5db;list-style:none;margin:0;">
          <li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">
            <span style="color:#3b82f6;font-size:18px;line-height:1;margin-top:2px;">&#8594;</span>
            <span>Navegación social en tiempo real con tus amigos que te permite tenerlos localizados en el mapa.</span>
          </li>
          <li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">
            <span style="color:#3b82f6;font-size:18px;line-height:1;margin-top:2px;">&#8594;</span>
            <span>Alertas de radares, tráfico, clima y aviones en tiempo real.</span>
          </li>
          <li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">
            <span style="color:#3b82f6;font-size:18px;line-height:1;margin-top:2px;">&#8594;</span>
            <span>Localización de cargadores EV y gasolineras con precios en vivo y filtrado para localizar los más económicos de la ruta.</span>
          </li>
          <li style="display:flex;gap:12px;align-items:flex-start;">
            <span style="color:#3b82f6;font-size:18px;line-height:1;margin-top:2px;">&#8594;</span>
            <span>Diseño premium optimizado para la pantalla de tu coche.</span>
          </li>
        </ul>
      </div>

      <p style="font-size:17px;color:#d1d5db;margin:0 0 28px;">Regístrate ahora y únete, tu amigo te espera.</p>

      <!-- CTA BUTTON -->
      <div style="text-align:center;">
        <a href="https://navegador-tesla.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 4px 20px rgba(59,130,246,0.4);">ENTRAR EN NAVEGAPRO &rarr;</a>
      </div>

    </div>

    <!-- FOOTER -->
    <p style="margin-top:28px;font-size:12px;color:#444;text-align:center;">Mensaje automático enviado por NavegaPRO &mdash; Disfruta del viaje.</p>
  </div>
</body>
</html>`

    await sendSmtpEmail({
      smtpHost: "smtp.ionos.es",
      smtpPort: 465,
      user: smtpUser,
      pass: smtpPass,
      from: smtpUser,
      to: receiverEmail,
      subject: `${senderName} te invita a unirte a NavegaPRO`,
      html: htmlContent,
    })

    console.log("Email sent successfully to", receiverEmail)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
