#!/usr/bin/env python3
"""
vuelos.py - Bot y Publicador Diario de Escapadas Baratas para Telegram
Grupo: @mgchuches | Topic ID: 390
Web: https://www.viajandoentesla.es/vuelos
"""

import os
import sys
import time
import json
import logging
from datetime import datetime, date
import requests

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Cargar variables de entorno desde .env.local si existe
def load_env_local():
    env_path = os.path.join(os.path.dirname(__file__), '.env.local')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    v = v.strip('"\'')
                    if k not in os.environ:
                        os.environ[k] = v

load_env_local()

# Configuración principal
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "@mgchuches").strip()
TELEGRAM_TOPIC_ID = int(os.environ.get("TELEGRAM_TOPIC_ID", "390"))

TRAVELPAYOUTS_TOKEN = os.environ.get("TRAVELPAYOUTS_TOKEN", "596d62e5f9f6d2f1574865feeb424c75").strip()
TRAVELPAYOUTS_MARKER = os.environ.get("TRAVELPAYOUTS_MARKER", "778425").strip()

# Diccionario de aeropuertos españoles principales
SPAIN_AIRPORTS = {
    "MAD": {"name": "Madrid-Barajas", "city": "Madrid", "flag": "🇪🇸"},
    "BCN": {"name": "Barcelona-El Prat", "city": "Barcelona", "flag": "🇪🇸"},
    "VLC": {"name": "Valencia", "city": "Valencia", "flag": "🇪🇸"},
    "AGP": {"name": "Málaga-Costa del Sol", "city": "Málaga", "flag": "🇪🇸"},
    "ALC": {"name": "Alicante-Elche", "city": "Alicante", "flag": "🇪🇸"},
    "SVQ": {"name": "Sevilla", "city": "Sevilla", "flag": "🇪🇸"},
    "BIO": {"name": "Bilbao", "city": "Bilbao", "flag": "🇪🇸"},
    "PMI": {"name": "Palma de Mallorca", "city": "Mallorca", "flag": "🇪🇸"},
}

# Ciudades/Destinos mapeados para amigabilidad
CITY_NAMES = {
    "PMI": "Palma de Mallorca", "BCN": "Barcelona", "MAD": "Madrid", "IBZ": "Ibiza",
    "MAH": "Menorca", "ALC": "Alicante", "AGP": "Málaga", "SVQ": "Sevilla", "VLC": "Valencia",
    "BIO": "Bilbao", "TFN": "Tenerife Norte", "TFS": "Tenerife Sur", "LPA": "Gran Canaria",
    "ACE": "Lanzarote", "FUE": "Fuerteventura", "LIS": "Lisboa", "OPO": "Oporto",
    "ROM": "Roma", "FCO": "Roma Fiumicino", "CIA": "Roma Ciampino", "MIL": "Milán",
    "MXP": "Milán Malpensa", "BGY": "Milán Bérgamo", "NAP": "Nápoles", "PSA": "Pisa (Toscana)",
    "BLQ": "Boloña", "VCE": "Venecia", "PAR": "París", "ORY": "París Orly", "BVA": "París Beauvais",
    "LON": "Londres", "STN": "Londres Stansted", "LTN": "Londres Luton", "BER": "Berlín",
    "BRU": "Bruselas", "CRL": "Bruselas Charleroi", "AMS": "Ámsterdam", "VIE": "Viena",
    "PRG": "Praga", "BUD": "Budapest", "ATH": "Atenas", "DUB": "Dublín", "CPH": "Copenhague"
}

def get_city_name(code):
    return CITY_NAMES.get(code.upper(), code.upper())

def build_skyscanner_url(origin: str, destination: str, depart_date: str, return_date: str, adults: int = 2) -> str:
    """
    Genera un enlace profundo directo y válido para Skyscanner en tiempo real.
    """
    try:
        dep_dt = datetime.strptime(depart_date, "%Y-%m-%d")
        ret_dt = datetime.strptime(return_date, "%Y-%m-%d") if return_date else None
    except Exception:
        dep_dt = datetime.now()
        ret_dt = None

    dep_code = dep_dt.strftime("%y%m%d")
    ret_code = ret_dt.strftime("%y%m%d") if ret_dt else ""

    url = f"https://www.skyscanner.es/transport/vuelos/{origin.lower()}/{destination.lower()}/{dep_code}/{ret_code}/"
    url += f"?adults={adults}&children=0&cabinclass=economy&rtn=1&preferdirects=false&outboundaltsenabled=false&inboundaltsenabled=false&marker={TRAVELPAYOUTS_MARKER}"
    return url

def fetch_flights_for_origin(origin: str, duration_min: int = 1, duration_max: int = 2, limit: int = 50):
    """
    Consulta la API de Travelpayouts para obtener vuelos baratos desde un origen específico
    filtrando estrictamente por duración de viaje (en días).
    """
    url = f"https://api.travelpayouts.com/v2/prices/latest?origin={origin}&currency=eur&period_type=year&page=1&limit={limit}&sorting=price&token={TRAVELPAYOUTS_TOKEN}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            logging.error(f"Error {resp.status_code} consultando origen {origin}")
            return []

        data = resp.json().get("data", [])
        valid_deals = []

        for item in data:
            dep_str = item.get("depart_date")
            ret_str = item.get("return_date")
            price = item.get("value", 0)

            if not dep_str or not ret_str or price <= 0:
                continue

            try:
                dep_d = datetime.strptime(dep_str, "%Y-%m-%d").date()
                ret_d = datetime.strptime(ret_str, "%Y-%m-%d").date()
                duration = (ret_d - dep_d).days

                # Filtrar solo por duración de escapada deseada (ej. 1 a 2 días)
                if duration_min <= duration <= duration_max and dep_d >= date.today():
                    dest_code = item.get("destination", "").upper()
                    valid_deals.append({
                        "origin": origin,
                        "origin_name": SPAIN_AIRPORTS.get(origin, {}).get("city", origin),
                        "destination": dest_code,
                        "destination_name": get_city_name(dest_code),
                        "depart_date": dep_str,
                        "return_date": ret_str,
                        "duration": duration,
                        "price_per_person": price,
                        "price_total_2p": price * 2,
                        "changes": item.get("number_of_changes", 0),
                        "found_at": item.get("found_at", ""),
                        "skyscanner_url": build_skyscanner_url(origin, dest_code, dep_str, ret_str, adults=2)
                    })
            except Exception as e:
                continue

        # Ordenar por precio por persona
        valid_deals.sort(key=lambda x: x["price_per_person"])
        return valid_deals

    except Exception as e:
        logging.error(f"Excepción consultando {origin}: {e}")
        return []

def send_telegram_message(text: str, reply_markup=None, thread_id: int = TELEGRAM_TOPIC_ID, chat_id: str = TELEGRAM_CHAT_ID):
    """
    Envía un mensaje formateado en HTML al chat y topic especificado de Telegram.
    """
    if not TELEGRAM_BOT_TOKEN:
        logging.error("ERROR: No se ha configurado TELEGRAM_BOT_TOKEN en las variables de entorno o en .env.local")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False
    }

    if thread_id:
        payload["message_thread_id"] = thread_id

    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)

    try:
        resp = requests.post(url, json=payload, timeout=10)
        res_data = resp.json()
        if res_data.get("ok"):
            logging.info(f"Mensaje enviado con éxito al Topic {thread_id} en {chat_id}")
            return True
        else:
            logging.error(f"Error Telegram API: {res_data.get('description')}")
            return False
    except Exception as e:
        logging.error(f"Error de red enviando mensaje a Telegram: {e}")
        return False

def publish_daily_getaways():
    """
    Escanéia todos los aeropuertos principales de España buscando escapadas de 1-2 días para 2 personas
    y publica el resumen diario en el topic de Telegram.
    """
    logging.info("Iniciando escaneo diario de escapadas (1-2 días, 2 personas)...")

    all_deals = []
    for origin in SPAIN_AIRPORTS.keys():
        deals = fetch_flights_for_origin(origin, duration_min=1, duration_max=2, limit=60)
        all_deals.extend(deals)
        time.sleep(0.3)

    if not all_deals:
        logging.warning("No se encontraron chollos para 1-2 días en este momento.")
        return

    # Eliminar duplicados idénticos y ordenar por precio total
    all_deals.sort(key=lambda x: (x["price_per_person"], x["duration"]))

    # Tomar los 5 mejores chollos
    top_deals = all_deals[:5]

    today_str = datetime.now().strftime("%d/%m/%Y")

    html = f"✈️ <b>TOP ESCAPADAS EXPRÉS (1-2 DÍAS) — {today_str}</b>\n"
    html += f"<i>Las mejores ofertas encontradas HOY para <b>2 Adultos</b> saliendo desde España:</i>\n\n"

    inline_keyboard = []

    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

    for idx, deal in enumerate(top_deals):
        m = medals[idx] if idx < len(medals) else "✈️"
        dep_fmt = datetime.strptime(deal["depart_date"], "%Y-%m-%d").strftime("%d %b")
        ret_fmt = datetime.strptime(deal["return_date"], "%Y-%m-%d").strftime("%d %b")
        trans = "Directo" if deal["changes"] == 0 else f"{deal['changes']} escala(s)"

        html += f"{m} <b>{deal['origin_name']} ➔ {deal['destination_name']}</b> ({deal['destination']})\n"
        html += f"📅 <b>{dep_fmt} ➔ {ret_fmt}</b> ({deal['duration']} {'día' if deal['duration'] == 1 else 'días'})\n"
        html += f"💰 <b>{deal['price_total_2p']} € TOTAL</b> (2 x {deal['price_per_person']} €/persona)\n"
        html += f"⚡ <i>{trans}</i> · <a href='{deal['skyscanner_url']}'>Ver Vuelo en Skyscanner</a>\n\n"

        inline_keyboard.append([
            {"text": f"{m} {deal['origin']}➔{deal['destination']} ({deal['price_total_2p']}€ 2p)", "url": deal["skyscanner_url"]}
        ])

    inline_keyboard.append([
        {"text": "🌐 Buscar más escapadas en la Web", "url": "https://www.viajandoentesla.es/vuelos"}
    ])

    reply_markup = {"inline_keyboard": inline_keyboard}

    send_telegram_message(html, reply_markup=reply_markup, thread_id=TELEGRAM_TOPIC_ID, chat_id=TELEGRAM_CHAT_ID)

# --- BOT INTERACTIVO CON TELEGAM ---

def bot_get_updates(offset=None):
    if not TELEGRAM_BOT_TOKEN:
        return []
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    params = {"timeout": 20, "allowed_updates": ["message", "callback_query"]}
    if offset:
        params["offset"] = offset
    try:
        resp = requests.get(url, params=params, timeout=25)
        if resp.status_code == 200:
            return resp.json().get("result", [])
    except Exception as e:
        logging.error(f"Error en bot getUpdates: {e}")
    return []

def bot_answer_callback(callback_query_id, text=None):
    if not TELEGRAM_BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery"
    payload = {"callback_query_id": callback_query_id}
    if text:
        payload["text"] = text
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception:
        pass

def run_interactive_bot():
    """
    Servidor de Bot en bucle interactivo (Long Polling) para responder en el topic.
    """
    if not TELEGRAM_BOT_TOKEN:
        print("❌ ERROR: Para usar el Bot interactivo necesitas definir TELEGRAM_BOT_TOKEN en .env.local o en las variables de entorno.")
        sys.exit(1)

    print(f"🤖 Bot de Escapadas activo y escuchando en {TELEGRAM_CHAT_ID} (Topic ID: {TELEGRAM_TOPIC_ID})...")
    offset = None

    # Estado temporal por usuario {user_id: {origin: 'MAD', duration: 2}}
    user_sessions = {}

    while True:
        try:
            updates = bot_get_updates(offset)
            for u in updates:
                offset = u["update_id"] + 1

                # Manejar mensajes de texto
                if "message" in u:
                    msg = u["message"]
                    chat_id = msg["chat"]["id"]
                    thread_id = msg.get("message_thread_id")
                    text = msg.get("text", "").strip()

                    # Verificar si es en el topic especificado o en chat privado
                    if str(chat_id) == TELEGRAM_CHAT_ID or chat_id == TELEGRAM_CHAT_ID or msg["chat"].get("type") == "private":
                        if text.startswith("/vuelos") or text.startswith("/start") or text.lower() == "vuelos" or text.lower() == "escapadas":
                            # Enviar Menú Interactivo
                            menu_html = "✈️ <b>BUSCADOR DE ESCAPADAS BARATAS DE TELEGRAM</b>\n\n"
                            menu_html += "Selecciona tu aeropuerto de origen para buscar chollos de <b>1 a 2 días para 2 personas</b>:"

                            keyboard = [
                                [
                                    {"text": "✈️ Madrid (MAD)", "callback_data": "orig_MAD"},
                                    {"text": "✈️ Barcelona (BCN)", "callback_data": "orig_BCN"}
                                ],
                                [
                                    {"text": "✈️ Valencia (VLC)", "callback_data": "orig_VLC"},
                                    {"text": "✈️ Málaga (AGP)", "callback_data": "orig_AGP"}
                                ],
                                [
                                    {"text": "✈️ Sevilla (SVQ)", "callback_data": "orig_SVQ"},
                                    {"text": "✈️ Bilbao (BIO)", "callback_data": "orig_BIO"}
                                ],
                                [
                                    {"text": "✈️ Alicante (ALC)", "callback_data": "orig_ALC"},
                                    {"text": "✈️ Mallorca (PMI)", "callback_data": "orig_PMI"}
                                ],
                                [
                                    {"text": "🌟 Buscar en TODOS los Aeropuertos", "callback_data": "orig_ALL"}
                                ]
                            ]

                            send_telegram_message(
                                menu_html,
                                reply_markup={"inline_keyboard": keyboard},
                                thread_id=thread_id or TELEGRAM_TOPIC_ID,
                                chat_id=chat_id
                            )

                # Manejar clicks en botones (Callback Queries)
                elif "callback_query" in u:
                    cb = u["callback_query"]
                    cb_id = cb["id"]
                    data = cb.get("data", "")
                    msg = cb.get("message", {})
                    chat_id = msg.get("chat", {}).get("id")
                    thread_id = msg.get("message_thread_id", TELEGRAM_TOPIC_ID)

                    if data.startswith("orig_"):
                        orig_code = data.replace("orig_", "")
                        bot_answer_callback(cb_id, f"Buscando vuelos desde {orig_code}...")

                        # Realizar búsqueda
                        if orig_code == "ALL":
                            all_deals = []
                            for o in SPAIN_AIRPORTS.keys():
                                all_deals.extend(fetch_flights_for_origin(o, duration_min=1, duration_max=2, limit=30))
                            all_deals.sort(key=lambda x: x["price_per_person"])
                            top_deals = all_deals[:5]
                            orig_title = "Todos los aeropuertos de España"
                        else:
                            top_deals = fetch_flights_for_origin(orig_code, duration_min=1, duration_max=2, limit=50)[:5]
                            orig_title = SPAIN_AIRPORTS.get(orig_code, {}).get("city", orig_code)

                        if not top_deals:
                            send_telegram_message(
                                f"⚠️ No he encontrado escapadas exprés (1-2 días) disponibles en este momento desde <b>{orig_title}</b>. Prueba a consultar la web.",
                                reply_markup={"inline_keyboard": [[{"text": "🌐 Ver en la Web", "url": "https://www.viajandoentesla.es/vuelos"}]]},
                                thread_id=thread_id,
                                chat_id=chat_id
                            )
                        else:
                            res_html = f"🔍 <b>RESULTADOS PARA ESCAPADA EXPRÉS (1-2 DÍAS)</b>\n"
                            res_html += f"Origen: <b>{orig_title}</b> · 👥 <b>2 Adultos</b>\n\n"

                            inline_kb = []
                            medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
                            for idx, deal in enumerate(top_deals):
                                m = medals[idx] if idx < len(medals) else "✈️"
                                dep_fmt = datetime.strptime(deal["depart_date"], "%Y-%m-%d").strftime("%d %b")
                                ret_fmt = datetime.strptime(deal["return_date"], "%Y-%m-%d").strftime("%d %b")
                                res_html += f"{m} <b>{deal['origin_name']} ➔ {deal['destination_name']}</b> ({deal['destination']})\n"
                                res_html += f"📅 <b>{dep_fmt} ➔ {ret_fmt}</b> ({deal['duration']} {'día' if deal['duration'] == 1 else 'días'})\n"
                                res_html += f"💰 <b>{deal['price_total_2p']} € TOTAL</b> (2 x {deal['price_per_person']} €/p)\n"
                                res_html += f"⚡ <a href='{deal['skyscanner_url']}'>Confirmar vuelo en Skyscanner</a>\n\n"

                                inline_kb.append([
                                    {"text": f"{m} {deal['origin']}➔{deal['destination']} ({deal['price_total_2p']}€ 2p)", "url": deal["skyscanner_url"]}
                                ])

                            inline_kb.append([{"text": "🌐 Abrir en la Web", "url": "https://www.viajandoentesla.es/vuelos"}])

                            send_telegram_message(res_html, reply_markup={"inline_keyboard": inline_kb}, thread_id=thread_id, chat_id=chat_id)

        except Exception as e:
            logging.error(f"Error en bucle bot: {e}")
            time.sleep(3)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ["--bot", "bot"]:
        run_interactive_bot()
    else:
        publish_daily_getaways()
