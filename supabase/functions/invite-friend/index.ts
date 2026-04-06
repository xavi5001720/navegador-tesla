import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import nodemailer from "npm:nodemailer@6.9.14"

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

    const transporter = nodemailer.createTransport({
      host: "smtp.ionos.es",
      port: 587,
      secure: false, // Use STARTTLS para el puerto 587
      auth: {
        user: "registros@viajandoentesla.es",
        pass: "5001720viajandoentesla@",
      },
    });

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
        
        <p style="margin-top: 40px; font-size: 12px; color: #444;">Este es un mensaje automático enviado por NavegaPRO. Disfruta del viaje.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: '"NavegaPRO" <registros@viajandoentesla.es>', // Debe coincidir con el usuario SMTP
      to: receiverEmail,
      subject: `${senderName} te invita a unirte a NavegaPRO`,
      html: htmlContent,
    });

    console.log("Message sent: %s", info.messageId);

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
