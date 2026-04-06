import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple manual SMTP implementation using Deno's native TLS
async function sendEmail(opts: {
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
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  async function readLine(): Promise<string> {
    const buf = new Uint8Array(1024)
    let result = ''
    while (true) {
      const n = await conn.read(buf)
      if (!n) break
      const chunk = decoder.decode(buf.subarray(0, n))
      result += chunk
      if (result.endsWith('\r\n')) break
    }
    return result.trim()
  }

  async function cmd(command: string): Promise<string> {
    await conn.write(encoder.encode(command + '\r\n'))
    return await readLine()
  }

  // Read greeting
  await readLine()

  // EHLO
  await cmd(`EHLO navegapro`)

  // Read all EHLO lines (multi-line response)
  // We'll just wait a bit and read what's available
  await new Promise(r => setTimeout(r, 100))

  // AUTH LOGIN
  await cmd('AUTH LOGIN')
  await cmd(btoa(opts.user))
  const authResp = await cmd(btoa(opts.pass))
  if (!authResp.startsWith('235')) throw new Error(`AUTH failed: ${authResp}`)

  await cmd(`MAIL FROM:<${opts.from}>`)
  await cmd(`RCPT TO:<${opts.to}>`)
  await cmd('DATA')

  const boundary = `boundary_${Date.now()}`
  const body = [
    `From: "NavegaPRO" <${opts.from}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    `Visita https://navegador-tesla.vercel.app para unirte a NavegaPRO.`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
    ``,
    `.`,
  ].join('\r\n')

  const quitResp = await cmd(body)
  if (!quitResp.startsWith('250')) throw new Error(`DATA failed: ${quitResp}`)

  await cmd('QUIT')
  conn.close()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { senderName, receiverEmail } = await req.json()
    console.log(`Sending invite from ${senderName} to ${receiverEmail}`)

    const smtpUser = Deno.env.get("SMTP_USER") ?? "registros@viajandoentesla.es"
    const smtpPass = Deno.env.get("SMTP_PASS") ?? ""

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 40px; border-radius: 20px;">
        <h1 style="color: #3b82f6; font-style: italic; font-weight: 900; letter-spacing: -2px;">NavegaPRO</h1>
        <p style="font-size: 18px; line-height: 1.6;">Hola,</p>
        <p style="font-size: 18px; line-height: 1.6;">Tu amigo <strong>${senderName}</strong> te ha invitado a unirte a la red social de <strong>NavegaPRO</strong> para Tesla.</p>
        <div style="background-color: #111; border: 1px solid #333; padding: 20px; border-radius: 15px; margin: 25px 0;">
          <h2 style="font-size: 16px; color: #666; text-transform: uppercase; margin-top: 0;">¿Qué es NavegaPRO?</h2>
          <ul style="padding-left: 20px; color: #ccc;">
            <li>Navegación social en tiempo real con tus amigos.</li>
            <li>Alertas de radares y helicópteros Pegasus actualizadas por la comunidad.</li>
            <li>Localización de Superchargers y gasolineras con precios en vivo.</li>
            <li>Diseño premium optimizado para la pantalla de tu Tesla.</li>
          </ul>
        </div>
        <p style="font-size: 16px; color: #888;">Regístrate ahora con este email para ver la solicitud de tu amigo esperándote en el panel social.</p>
        <a href="https://navegador-tesla.vercel.app" style="display: inline-block; background-color: #3b82f6; color: #fff; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 20px;">ENTRAR EN NAVEGAPRO</a>
        <p style="margin-top: 40px; font-size: 12px; color: #444;">Mensaje automático enviado por NavegaPRO. Disfruta del viaje.</p>
      </div>
    `

    await sendEmail({
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
    console.error("Error sending email:", error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
