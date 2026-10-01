#!/usr/bin/env python3
"""
vuelos.py - Bot y Publicador Diario de Escapadas Baratas para Telegram
Grupo: @mgchuches | Topic ID: 390
Bot Privado: @VuelosEV_Bot (t.me/VuelosEV_Bot?start=buscar)
Web: https://www.viajandoentesla.es/vuelos
"""

import os
import sys
import time
import json
import logging
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

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

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "@mgchuches").strip()
TELEGRAM_TOPIC_ID = int(os.environ.get("TELEGRAM_TOPIC_ID", "390"))

TRAVELPAYOUTS_TOKEN = os.environ.get("TRAVELPAYOUTS_TOKEN", "596d62e5f9f6d2f1574865feeb424c75").strip()
TRAVELPAYOUTS_MARKER = os.environ.get("TRAVELPAYOUTS_MARKER", "778425").strip()

# Todos los 26 Aeropuertos de España según la web oficial
SPAIN_AIRPORTS = {
    "MAD": {"name": "Madrid-Barajas", "city": "Madrid", "flag": "🇪🇸"},
    "BCN": {"name": "Barcelona-El Prat", "city": "Barcelona", "flag": "🇪🇸"},
    "VLC": {"name": "Valencia", "city": "Valencia", "flag": "🇪🇸"},
    "AGP": {"name": "Málaga-Costa del Sol", "city": "Málaga", "flag": "🇪🇸"},
    "SVQ": {"name": "Sevilla", "city": "Sevilla", "flag": "🇪🇸"},
    "BIO": {"name": "Bilbao", "city": "Bilbao", "flag": "🇪🇸"},
    "ALC": {"name": "Alicante-Elche", "city": "Alicante", "flag": "🇪🇸"},
    "SCQ": {"name": "Santiago de Compostela", "city": "Santiago", "flag": "🇪🇸"},
    "PMI": {"name": "Palma de Mallorca", "city": "Palma de Mallorca", "flag": "🇪🇸"},
    "IBZ": {"name": "Ibiza", "city": "Ibiza", "flag": "🇪🇸"},
    "MAH": {"name": "Menorca", "city": "Menorca", "flag": "🇪🇸"},
    "TFN": {"name": "Tenerife Norte", "city": "Tenerife Norte", "flag": "🇪🇸"},
    "TFS": {"name": "Tenerife Sur", "city": "Tenerife Sur", "flag": "🇪🇸"},
    "LPA": {"name": "Gran Canaria", "city": "Gran Canaria", "flag": "🇪🇸"},
    "ACE": {"name": "Lanzarote", "city": "Lanzarote", "flag": "🇪🇸"},
    "FUE": {"name": "Fuerteventura", "city": "Fuerteventura", "flag": "🇪🇸"},
    "SPC": {"name": "La Palma", "city": "La Palma", "flag": "🇪🇸"},
    "SDR": {"name": "Santander", "city": "Santander", "flag": "🇪🇸"},
    "VGO": {"name": "Vigo", "city": "Vigo", "flag": "🇪🇸"},
    "OVD": {"name": "Asturias", "city": "Asturias", "flag": "🇪🇸"},
    "ZAZ": {"name": "Zaragoza", "city": "Zaragoza", "flag": "🇪🇸"},
    "GRX": {"name": "Granada", "city": "Granada", "flag": "🇪🇸"},
    "MJV": {"name": "Murcia", "city": "Murcia", "flag": "🇪🇸"},
    "XRY": {"name": "Jerez de la Frontera", "city": "Jerez", "flag": "🇪🇸"},
    "REU": {"name": "Reus (Tarragona)", "city": "Reus", "flag": "🇪🇸"},
    "GRO": {"name": "Girona", "city": "Girona", "flag": "🇪🇸"},
}

CITY_NAMES = {
    "PMI": "Palma de Mallorca", "BCN": "Barcelona", "MAD": "Madrid", "IBZ": "Ibiza",
    "MAH": "Menorca", "ALC": "Alicante", "AGP": "Málaga", "SVQ": "Sevilla", "VLC": "Valencia",
    "BIO": "Bilbao", "TFN": "Tenerife Norte", "TFS": "Tenerife Sur", "LPA": "Gran Canaria",
    "ACE": "Lanzarote", "FUE": "Fuerteventura", "SPC": "La Palma", "SDR": "Santander",
    "VGO": "Vigo", "OVD": "Asturias", "ZAZ": "Zaragoza", "GRX": "Granada", "MJV": "Murcia",
    "XRY": "Jerez", "REU": "Reus", "GRO": "Girona", "LIS": "Lisboa", "OPO": "Oporto",
    "ROM": "Roma", "FCO": "Roma Fiumicino", "CIA": "Roma Ciampino", "MIL": "Milán",
    "MXP": "Milán Malpensa", "BGY": "Milán Bérgamo", "NAP": "Nápoles", "PSA": "Pisa (Toscana)",
    "BLQ": "Bolonia", "VCE": "Venecia", "PAR": "París", "ORY": "París Orly", "BVA": "París Beauvais",
    "LON": "Londres", "STN": "Londres Stansted", "LTN": "Londres Luton", "BER": "Berlín",
    "BRU": "Bruselas", "CRL": "Bruselas Charleroi", "AMS": "Ámsterdam", "VIE": "Viena",
    "PRG": "Praga", "BUD": "Budapest", "ATH": "Atenas", "DUB": "Dublín", "CPH": "Copenhague"
}

def get_city_name(code):
    return CITY_NAMES.get(code.upper(), SPAIN_AIRPORTS.get(code.upper(), {}).get("city", code.upper()))

def build_skyscanner_url(origin: str, destination: str, depart_date: str, return_date: str, adults: int = 2, children: int = 0) -> str:
    try:
        dep_dt = datetime.strptime(depart_date, "%Y-%m-%d")
        ret_dt = datetime.strptime(return_date, "%Y-%m-%d") if return_date else None
    except Exception:
        dep_dt = datetime.now()
        ret_dt = None

    dep_code = dep_dt.strftime("%y%m%d")
    ret_code = ret_dt.strftime("%y%m%d") if ret_dt else ""

    url = f"https://www.skyscanner.es/transport/vuelos/{origin.lower()}/{destination.lower()}/{dep_code}/{ret_code}/"
    url += f"?adults={adults}&children={children}&cabinclass=economy&rtn=1&preferdirects=false&outboundaltsenabled=false&inboundaltsenabled=false&marker={TRAVELPAYOUTS_MARKER}"
    return url

def fetch_flights_for_origin(origin: str, duration_min: int = 1, duration_max: int = 2, limit: int = 60, adults: int = 2, children: int = 0):
    url = f"https://api.travelpayouts.com/v2/prices/latest?origin={origin}&currency=eur&period_type=year&page=1&limit={limit}&sorting=price&token={TRAVELPAYOUTS_TOKEN}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
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

                if duration_min <= duration <= duration_max and dep_d >= date.today():
                    dest_code = item.get("destination", "").upper()
                    total_passengers = adults + children
                    price_total = price * total_passengers

                    valid_deals.append({
                        "origin": origin,
                        "origin_name": SPAIN_AIRPORTS.get(origin, {}).get("city", origin),
                        "destination": dest_code,
                        "destination_name": get_city_name(dest_code),
                        "depart_date": dep_str,
                        "return_date": ret_str,
                        "duration": duration,
                        "price_per_person": price,
                        "price_total": price_total,
                        "adults": adults,
                        "children": children,
                        "changes": item.get("number_of_changes", 0),
                        "found_at": item.get("found_at", ""),
                        "skyscanner_url": build_skyscanner_url(origin, dest_code, dep_str, ret_str, adults=adults, children=children)
                    })
            except Exception:
                continue

        valid_deals.sort(key=lambda x: x["price_per_person"])
        return valid_deals

    except Exception as e:
        logging.error(f"Excepción consultando {origin}: {e}")
        return []

def send_telegram_message(text: str, reply_markup=None, thread_id: int = None, chat_id: str = TELEGRAM_CHAT_ID):
    if not TELEGRAM_BOT_TOKEN:
        logging.error("ERROR: TELEGRAM_BOT_TOKEN no configurado.")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }

    if thread_id:
        payload["message_thread_id"] = thread_id

    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)

    try:
        resp = requests.post(url, json=payload, timeout=10)
        res_data = resp.json()
        if res_data.get("ok"):
            return res_data.get("result", {}).get("message_id")
        else:
            logging.error(f"Error Telegram API: {res_data.get('description')}")
            return False
    except Exception as e:
        logging.error(f"Error enviando mensaje: {e}")
        return False

def edit_telegram_message(chat_id, message_id, text, reply_markup=None):
    if not TELEGRAM_BOT_TOKEN:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/editMessageText"
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)
    try:
        resp = requests.post(url, json=payload, timeout=10)
        return resp.json().get("ok", False)
    except Exception:
        return False

def delete_telegram_message(chat_id, message_id):
    if not TELEGRAM_BOT_TOKEN or not message_id:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "message_id": message_id}, timeout=5)
        return True
    except Exception:
        return False

def publish_daily_getaways():
    """
    Publicación diaria automática en el Topic 390 de Telegram.
    Boton único abre directamente el bot en privado: t.me/VuelosEV_Bot?start=buscar
    """
    logging.info("Iniciando escaneo diario en los 26 aeropuertos de España (1-2 días, 2 personas)...")

    all_deals = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_flights_for_origin, code, 1, 2, 60, 2, 0): code for code in SPAIN_AIRPORTS.keys()}
        for future in as_completed(futures):
            try:
                res = future.result()
                if res:
                    all_deals.extend(res)
            except Exception:
                pass

    if not all_deals:
        logging.warning("No se encontraron chollos en este momento.")
        return

    all_deals.sort(key=lambda x: (x["price_per_person"], x["duration"]))
    top_deals = all_deals[:5]
    today_str = datetime.now().strftime("%d/%m/%Y")

    html = f"✈️ <b>TOP ESCAPADAS EXPRÉS (1-2 DÍAS) — {today_str}</b>\n"
    html += f"<i>Las 5 mejores ofertas encontradas HOY para <b>2 Adultos</b> saliendo desde España:</i>\n\n"

    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

    for idx, deal in enumerate(top_deals):
        m = medals[idx] if idx < len(medals) else "✈️"
        dep_fmt = datetime.strptime(deal["depart_date"], "%Y-%m-%d").strftime("%d %b")
        ret_fmt = datetime.strptime(deal["return_date"], "%Y-%m-%d").strftime("%d %b")
        trans = "Directo" if deal["changes"] == 0 else f"{deal['changes']} escala(s)"

        html += f"{m} <b><a href='{deal['skyscanner_url']}'>{deal['origin_name']} ➔ {deal['destination_name']} ({deal['destination']})</a></b>\n"
        html += f"📅 <b>{dep_fmt} ➔ {ret_fmt}</b> ({deal['duration']} {'día' if deal['duration'] == 1 else 'días'}) · ⚡ <i>{trans}</i>\n"
        html += f"💰 <b>{deal['price_total']} € TOTAL</b> (2 x {deal['price_per_person']} €/persona)\n\n"

    # Enlace directo para abrir la conversación privada limpia con el bot
    bot_private_url = "https://t.me/VuelosEV_Bot?start=buscar"

    keyboard = [
        [{"text": "🔍 BUSCADOR EN PRIVADO CON EL BOT", "url": bot_private_url}],
        [{"text": "🌐 Abrir Web de Vuelos", "url": "https://www.viajandoentesla.es/vuelos"}]
    ]

    reply_markup = {"inline_keyboard": keyboard}
    send_telegram_message(html, reply_markup=reply_markup, thread_id=TELEGRAM_TOPIC_ID, chat_id=TELEGRAM_CHAT_ID)

# --- BOT CONVERSACIONAL EN PRIVADO LIMPIO (SIN REPETIR MENSAJES) ---

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

def send_step_1_origin_private(chat_id):
    html = "✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += "<b>Paso 1 de 3:</b> Elige tu aeropuerto de salida:"

    keyboard = []
    items = list(SPAIN_AIRPORTS.items())
    for i in range(0, len(items), 2):
        row = []
        code1, info1 = items[i]
        row.append({"text": f"✈️ {info1['city']} ({code1})", "callback_data": f"step1_{code1}"})
        if i + 1 < len(items):
            code2, info2 = items[i + 1]
            row.append({"text": f"✈️ {info2['city']} ({code2})", "callback_data": f"step1_{code2}"})
        keyboard.append(row)

    keyboard.append([{"text": "🌟 Buscar en TODOS los Aeropuertos", "callback_data": "step1_ALL"}])
    return send_telegram_message(html, reply_markup={"inline_keyboard": keyboard}, chat_id=chat_id)

def send_step_2_duration(chat_id, message_id, origin_code):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen seleccionado: <b>{orig_name}</b>\n\n"
    html += "<b>Paso 2 de 3:</b> ¿De qué duración quieres la escapada?"

    keyboard = [
        [{"text": "⚡ 1 a 2 Días (Escapada Exprés)", "callback_data": f"step2_{origin_code}_1-2"}],
        [{"text": "📅 3 a 4 Días (Fin de semana largo)", "callback_data": f"step2_{origin_code}_3-4"}],
        [{"text": "🌴 5 a 7 Días (Semana completa)", "callback_data": f"step2_{origin_code}_5-7"}],
        [{"text": "🔄 Volver a elegir origen", "callback_data": "reset_flow"}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def send_step_3_passengers(chat_id, message_id, origin_code, dur_str):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b>\n"
    html += f"⏱️ Duración: <b>{dur_str} días</b>\n\n"
    html += "<b>Paso 3 de 3:</b> ¿Cuántos viajeros vais?"

    keyboard = [
        [{"text": "👥 2 Adultos", "callback_data": f"step3_{origin_code}_{dur_str}_2a0c"}],
        [{"text": "👤 1 Adulto", "callback_data": f"step3_{origin_code}_{dur_str}_1a0c"}],
        [{"text": "👨‍👩‍👧 2 Adultos + 1 Niño", "callback_data": f"step3_{origin_code}_{dur_str}_2a1c"}],
        [{"text": "👨‍👩‍👧‍👦 2 Adultos + 2 Niños", "callback_data": f"step3_{origin_code}_{dur_str}_2a2c"}],
        [{"text": "🔄 Reiniciar búsqueda", "callback_data": "reset_flow"}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def execute_bot_search(chat_id, message_id, origin_code, dur_str, pax_code):
    dur_parts = dur_str.split("-")
    dur_min = int(dur_parts[0])
    dur_max = int(dur_parts[1])

    if pax_code == "2a0c":
        adults, children = 2, 0
        pax_title = "2 Adultos"
    elif pax_code == "1a0c":
        adults, children = 1, 0
        pax_title = "1 Adulto"
    elif pax_code == "2a1c":
        adults, children = 2, 1
        pax_title = "2 Adultos + 1 Niño"
    elif pax_code == "2a2c":
        adults, children = 2, 2
        pax_title = "2 Adultos + 2 Niños"
    else:
        adults, children = 2, 0
        pax_title = "2 Adultos"

    orig_title = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)

    loading_html = f"🔍 <b>Buscando los mejores chollos en tiempo real...</b>\n\n"
    loading_html += f"📍 Origen: <b>{orig_title}</b> | ⏱️ Duración: <b>{dur_str} días</b> | 👥 <b>{pax_title}</b>"
    edit_telegram_message(chat_id, message_id, loading_html)

    if origin_code == "ALL":
        all_deals = []
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(fetch_flights_for_origin, o, dur_min, dur_max, 30, adults, children): o for o in SPAIN_AIRPORTS.keys()}
            for future in as_completed(futures):
                try:
                    res = future.result()
                    if res:
                        all_deals.extend(res)
                except Exception:
                    pass
        all_deals.sort(key=lambda x: x["price_per_person"])
        top_deals = all_deals[:5]
    else:
        top_deals = fetch_flights_for_origin(origin_code, duration_min=dur_min, duration_max=dur_max, limit=50, adults=adults, children=children)[:5]

    if not top_deals:
        fail_html = f"⚠️ No se han encontrado vuelos directos para <b>{orig_title}</b> ({dur_str} días) en este momento.\n\nPrueba otra combinación o busca directamente en nuestra web."
        kb = [[{"text": "🔄 Nueva búsqueda", "callback_data": "reset_flow"}, {"text": "🌐 Ir a la Web", "url": "https://www.viajandoentesla.es/vuelos"}]]
        edit_telegram_message(chat_id, message_id, fail_html, reply_markup={"inline_keyboard": kb})
        return

    res_html = f"🔥 <b>TOP CHOLLOS ENCONTRADOS EN TIEMPO REAL</b>\n"
    res_html += f"📍 <b>{orig_title}</b> · ⏱️ <b>{dur_str} días</b> · 👥 <b>{pax_title}</b>\n\n"

    inline_kb = []
    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

    for idx, deal in enumerate(top_deals):
        m = medals[idx] if idx < len(medals) else "✈️"
        dep_fmt = datetime.strptime(deal["depart_date"], "%Y-%m-%d").strftime("%d %b")
        ret_fmt = datetime.strptime(deal["return_date"], "%Y-%m-%d").strftime("%d %b")
        pax_desc = f"{deal['adults']} Aud." if deal['children'] == 0 else f"{deal['adults']} Aud. + {deal['children']} Niño(s)"

        res_html += f"{m} <b>{deal['origin_name']} ➔ {deal['destination_name']}</b> ({deal['destination']})\n"
        res_html += f"📅 <b>{dep_fmt} ➔ {ret_fmt}</b> ({deal['duration']} {'día' if deal['duration'] == 1 else 'días'})\n"
        res_html += f"💰 <b>{deal['price_total']} € TOTAL</b> ({pax_desc} · {deal['price_per_person']} €/p)\n\n"

        inline_kb.append([
            {"text": f"{m} Ver {deal['origin']}➔{deal['destination']} ({deal['price_total']}€ total)", "url": deal["skyscanner_url"]}
        ])

    inline_kb.append([{"text": "🔄 Nueva Búsqueda", "callback_data": "reset_flow"}, {"text": "🌐 Abrir Web", "url": "https://www.viajandoentesla.es/vuelos"}])

    edit_telegram_message(chat_id, message_id, res_html, reply_markup={"inline_keyboard": inline_kb})

def run_interactive_bot():
    if not TELEGRAM_BOT_TOKEN:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN no configurado.")
        sys.exit(1)

    print(f"🤖 Bot Conversacional Privado Limpio (@VuelosEV_Bot) activo y listo...")
    offset = None

    # Guardar ID del último mensaje activo del menú por usuario para borrarlo si el usuario envía un nuevo comando
    user_menu_messages = {}

    while True:
        try:
            updates = bot_get_updates(offset)
            for u in updates:
                offset = u["update_id"] + 1

                # Manejar mensajes entrantes (privados)
                if "message" in u:
                    msg = u["message"]
                    chat_id = msg["chat"]["id"]
                    msg_id = msg["message_id"]

                    # Responder prioritariamente en chat privado
                    if msg["chat"].get("type") == "private":
                        # Borrar el comando introducido por el usuario para mantener el chat 100% limpio
                        delete_telegram_message(chat_id, msg_id)

                        # Borrar el menú anterior si existía
                        if chat_id in user_menu_messages:
                            delete_telegram_message(chat_id, user_menu_messages[chat_id])

                        # Enviar Paso 1 y guardar la ID del mensaje enviado
                        new_msg_id = send_step_1_origin_private(chat_id)
                        if new_msg_id:
                            user_menu_messages[chat_id] = new_msg_id

                # Manejar interacción con botones inline
                elif "callback_query" in u:
                    cb = u["callback_query"]
                    cb_id = cb["id"]
                    data = cb.get("data", "")
                    msg = cb.get("message", {})
                    chat_id = msg.get("chat", {}).get("id")
                    message_id = msg.get("message_id")

                    bot_answer_callback(cb_id)

                    if data == "reset_flow":
                        edit_telegram_message(chat_id, message_id, "⌛ Cargando menú de orígenes...")
                        delete_telegram_message(chat_id, message_id)
                        new_msg_id = send_step_1_origin_private(chat_id)
                        if new_msg_id:
                            user_menu_messages[chat_id] = new_msg_id

                    elif data.startswith("step1_"):
                        orig_code = data.replace("step1_", "")
                        send_step_2_duration(chat_id, message_id, orig_code)

                    elif data.startswith("step2_"):
                        parts = data.split("_")
                        orig_code = parts[1]
                        dur_str = parts[2]
                        send_step_3_passengers(chat_id, message_id, orig_code, dur_str)

                    elif data.startswith("step3_"):
                        parts = data.split("_")
                        orig_code = parts[1]
                        dur_str = parts[2]
                        pax_code = parts[3]
                        execute_bot_search(chat_id, message_id, orig_code, dur_str, pax_code)

        except Exception as e:
            logging.error(f"Error en bucle bot: {e}")
            time.sleep(3)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ["--bot", "bot"]:
        run_interactive_bot()
    else:
        publish_daily_getaways()
