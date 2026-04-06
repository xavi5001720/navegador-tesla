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
    `Tu amigo te ha invitado a NavegaPRO. Visita: https://navegador-tesla.vercel.app`,
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

    const htmlContent = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 40px; border-radius: 20px;"><h1 style="color: #3b82f6; font-style: italic; font-weight: 900; letter-spacing: -2px;">NavegaPRO</h1><p style="font-size: 18px; line-height: 1.6;">Hola,</p><p style="font-size: 18px; line-height: 1.6;">Tu amigo <strong>${senderName}</strong> te ha invitado a unirte a la red social de <strong>NavegaPRO</strong> para Tesla.</p><div style="background-color: #111; border: 1px solid #333; padding: 20px; border-radius: 15px; margin: 25px 0;"><h2 style="font-size: 16px; color: #666; text-transform: uppercase; margin-top: 0;">Que es NavegaPRO?</h2><ul style="padding-left: 20px; color: #ccc;"><li>Navegacion social en tiempo real con tus amigos.</li><li>Alertas de radares y helicopteros Pegasus actualizadas por la comunidad.</li><li>Localizacion de Superchargers y gasolineras con precios en vivo.</li><li>Diseno premium optimizado para la pantalla de tu Tesla.</li></ul></div><p style="font-size: 16px; color: #888;">Registrate ahora con este email para ver la solicitud de tu amigo esperandote en el panel social.</p><a href="https://navegador-tesla.vercel.app" style="display: inline-block; background-color: #3b82f6; color: #fff; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 20px;">ENTRAR EN NAVEGAPRO</a><p style="margin-top: 40px; font-size: 12px; color: #444;">Mensaje automatico enviado por NavegaPRO. Disfruta del viaje.</p></div>`

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
