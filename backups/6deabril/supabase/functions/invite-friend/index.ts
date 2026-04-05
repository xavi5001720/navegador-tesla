import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { senderName, receiverEmail } = await req.json()

    console.log(`Sending invite from ${senderName} to ${receiverEmail}`);

    // Si no hay API KEY, simulamos el envío para no romper el flujo
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sin RESEND_API_KEY detectada. El email se ha logueado en la consola (Simulación).',
          preview: `Hola! Tu amigo ${senderName} te ha invitado a NavegaPRO Tesla.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'NavegaPRO <social@navegapro.tesla>',
        to: [receiverEmail],
        subject: `${senderName} te invita a unirte a NavegaPRO`,
        html: `
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
            
            <p style="margin-top: 40px; font-size: 12px; color: #444;">Este es un mensaje automático enviado por NavegaPRO. Disfruta del viaje.</p>
          </div>
        `,
      }),
    })

    const data = await res.json()

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
