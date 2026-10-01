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
from datetime import datetime, date, timedelta
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
    "SCQ": {"name": "Santiago de Compostela", "city": "Santiago de Compostela", "flag": "🇪🇸"},
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

# Diccionario mundial de aeropuertos para sustituir CUALQUIER abreviatura IATA por Nombre Real + País
WORLD_AIRPORTS = {
    # España
    "MAD": {"city": "Madrid", "country": "España"},
    "BCN": {"city": "Barcelona", "country": "España"},
    "VLC": {"city": "Valencia", "country": "España"},
    "AGP": {"city": "Málaga", "country": "España"},
    "SVQ": {"city": "Sevilla", "country": "España"},
    "BIO": {"city": "Bilbao", "country": "España"},
    "ALC": {"city": "Alicante", "country": "España"},
    "SCQ": {"city": "Santiago de Compostela", "country": "España"},
    "PMI": {"city": "Palma de Mallorca", "country": "España"},
    "IBZ": {"city": "Ibiza", "country": "España"},
    "MAH": {"city": "Menorca", "country": "España"},
    "TFN": {"city": "Tenerife Norte", "country": "España"},
    "TFS": {"city": "Tenerife Sur", "country": "España"},
    "LPA": {"city": "Gran Canaria", "country": "España"},
    "ACE": {"city": "Lanzarote", "country": "España"},
    "FUE": {"city": "Fuerteventura", "country": "España"},
    "SPC": {"city": "La Palma", "country": "España"},
    "SDR": {"city": "Santander", "country": "España"},
    "VGO": {"city": "Vigo", "country": "España"},
    "OVD": {"city": "Asturias", "country": "España"},
    "ZAZ": {"city": "Zaragoza", "country": "España"},
    "GRX": {"city": "Granada", "country": "España"},
    "MJV": {"city": "Murcia", "country": "España"},
    "XRY": {"city": "Jerez de la Frontera", "country": "España"},
    "REU": {"city": "Reus", "country": "España"},
    "GRO": {"city": "Girona", "country": "España"},

    # Italia
    "MIL": {"city": "Milán", "country": "Italia"},
    "MXP": {"city": "Milán Malpensa", "country": "Italia"},
    "LIN": {"city": "Milán Linate", "country": "Italia"},
    "BGY": {"city": "Milán Bérgamo", "country": "Italia"},
    "ROM": {"city": "Roma", "country": "Italia"},
    "FCO": {"city": "Roma Fiumicino", "country": "Italia"},
    "CIA": {"city": "Roma Ciampino", "country": "Italia"},
    "NAP": {"city": "Nápoles", "country": "Italia"},
    "VCE": {"city": "Venecia", "country": "Italia"},
    "TSF": {"city": "Venecia Treviso", "country": "Italia"},
    "FLR": {"city": "Florencia", "country": "Italia"},
    "BLQ": {"city": "Bolonia", "country": "Italia"},
    "TRN": {"city": "Turín", "country": "Italia"},
    "BRI": {"city": "Bari (Puglia)", "country": "Italia"},
    "PMO": {"city": "Palermo (Sicilia)", "country": "Italia"},
    "CTA": {"city": "Catania (Sicilia)", "country": "Italia"},
    "OLB": {"city": "Olbia (Cerdeña)", "country": "Italia"},
    "CAG": {"city": "Cagliari (Cerdeña)", "country": "Italia"},
    "AHO": {"city": "Alguer (Cerdeña)", "country": "Italia"},
    "PSA": {"city": "Pisa (Toscana)", "country": "Italia"},

    # Francia
    "PAR": {"city": "París", "country": "Francia"},
    "CDG": {"city": "París Charles de Gaulle", "country": "Francia"},
    "ORY": {"city": "París Orly", "country": "Francia"},
    "BVA": {"city": "París Beauvais", "country": "Francia"},
    "NCE": {"city": "Niza", "country": "Francia"},
    "LYS": {"city": "Lyon", "country": "Francia"},
    "MRS": {"city": "Marsella", "country": "Francia"},
    "BOD": {"city": "Burdeos", "country": "Francia"},
    "TLS": {"city": "Toulouse", "country": "Francia"},
    "NTE": {"city": "Nantes", "country": "Francia"},
    "MPL": {"city": "Montpellier", "country": "Francia"},
    "BIQ": {"city": "Biarritz", "country": "Francia"},

    # Portugal & Países Bajos & Bélgica
    "LIS": {"city": "Lisboa", "country": "Portugal"},
    "OPO": {"city": "Oporto", "country": "Portugal"},
    "FAO": {"city": "Faro (Algarve)", "country": "Portugal"},
    "FNC": {"city": "Funchal (Madeira)", "country": "Portugal"},
    "AMS": {"city": "Ámsterdam", "country": "Países Bajos"},
    "EIN": {"city": "Eindhoven", "country": "Países Bajos"},
    "BRU": {"city": "Bruselas", "country": "Bélgica"},
    "CRL": {"city": "Bruselas Charleroi", "country": "Bélgica"},

    # Reino Unido & Irlanda
    "LON": {"city": "Londres", "country": "Reino Unido"},
    "STN": {"city": "Londres Stansted", "country": "Reino Unido"},
    "LTN": {"city": "Londres Luton", "country": "Reino Unido"},
    "LGW": {"city": "Londres Gatwick", "country": "Reino Unido"},
    "LHR": {"city": "Londres Heathrow", "country": "Reino Unido"},
    "EDI": {"city": "Edimburgo", "country": "Reino Unido"},
    "MAN": {"city": "Mánchester", "country": "Reino Unido"},
    "BRS": {"city": "Bristol", "country": "Reino Unido"},
    "DUB": {"city": "Dublín", "country": "Irlanda"},

    # Alemania, Austria & Suiza
    "BER": {"city": "Berlín", "country": "Alemania"},
    "MUC": {"city": "Múnich", "country": "Alemania"},
    "FRA": {"city": "Fráncfort", "country": "Alemania"},
    "HHN": {"city": "Fráncfort Hahn", "country": "Alemania"},
    "HAM": {"city": "Hamburgo", "country": "Alemania"},
    "CGN": {"city": "Colonia", "country": "Alemania"},
    "VIE": {"city": "Viena", "country": "Austria"},
    "ZRH": {"city": "Zúrich", "country": "Suiza"},
    "GVA": {"city": "Ginebra", "country": "Suiza"},
    "BSL": {"city": "Basilea", "country": "Suiza"},

    # Europa Central, Balcanes & Grecia
    "PRG": {"city": "Praga", "country": "Rep. Checa"},
    "BUD": {"city": "Budapest", "country": "Hungría"},
    "WAW": {"city": "Varsovia", "country": "Polonia"},
    "KRK": {"city": "Cracovia", "country": "Polonia"},
    "ATH": {"city": "Atenas", "country": "Grecia"},
    "JTR": {"city": "Santorini", "country": "Grecia"},
    "JMK": {"city": "Mikonos", "country": "Grecia"},
    "HER": {"city": "Heraclión (Creta)", "country": "Grecia"},
    "CFU": {"city": "Corfú", "country": "Grecia"},
    "CPH": {"city": "Copenhague", "country": "Dinamarca"},
    "OSL": {"city": "Oslo", "country": "Noruega"},
    "STO": {"city": "Estocolmo", "country": "Suecia"},
    "HEL": {"city": "Helsinki", "country": "Finlandia"},
    "KEF": {"city": "Reikiavik", "country": "Islandia"},
    "IST": {"city": "Estambul", "country": "Turquía"},
    "DBV": {"city": "Dubrovnik", "country": "Croacia"},
    "SPU": {"city": "Split", "country": "Croacia"},

    # Marruecos & América
    "RAK": {"city": "Marrakech", "country": "Marruecos"},
    "CMN": {"city": "Casablanca", "country": "Marruecos"},
    "TNG": {"city": "Tánger", "country": "Marruecos"},
    "FEZ": {"city": "Fez", "country": "Marruecos"},
    "JFK": {"city": "Nueva York (JFK)", "country": "EE.UU."},
    "EWR": {"city": "Nueva York (Newark)", "country": "EE.UU."},
    "MIA": {"city": "Miami", "country": "EE.UU."},
    "LAX": {"city": "Los Ángeles", "country": "EE.UU."},
    "CUN": {"city": "Cancún", "country": "México"},
    "MEX": {"city": "Ciudad de México", "country": "México"},
    "BOG": {"city": "Bogotá", "country": "Colombia"},
    "LIM": {"city": "Lima", "country": "Perú"},
    "EZE": {"city": "Buenos Aires", "country": "Argentina"},
    "SCL": {"city": "Santiago de Chile", "country": "Chile"},
    "GRU": {"city": "São Paulo", "country": "Brasil"},
    "PUJ": {"city": "Punta Cana", "country": "Rep. Dominicana"},
    "HAV": {"city": "La Habana", "country": "Cuba"},
}

MONTH_NAMES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

def get_destination_label(code: str) -> str:
    """
    Devuelve el nombre completo de la ciudad y el país sin abreviaturas raras.
    Ejemplo: 'PMO' -> 'Palermo (Sicilia), Italia'
    """
    c = code.upper()
    info = WORLD_AIRPORTS.get(c)
    if info:
        city = info["city"]
        country = info.get("country", "")
        return f"{city}, {country}" if country else city
    return c

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

def fetch_flights_for_origin(origin: str, duration_min: int = 1, duration_max: int = 2, limit: int = 60, adults: int = 2, children: int = 0, when_filter: str = "year"):
    url = f"https://api.travelpayouts.com/v2/prices/latest?origin={origin}&currency=eur&period_type=year&page=1&limit={limit}&sorting=price&token={TRAVELPAYOUTS_TOKEN}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return []

        data = resp.json().get("data", [])
        valid_deals = []
        today = date.today()

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

                match_when = False
                if dep_d >= today:
                    if when_filter == "week":
                        match_when = (dep_d <= today + timedelta(days=7))
                    elif when_filter == "month":
                        match_when = (dep_d <= today + timedelta(days=30))
                    elif when_filter == "year":
                        match_when = True
                    elif when_filter.startswith("custom_"):
                        target_m = when_filter.replace("custom_", "")
                        match_when = dep_d.strftime("%Y-%m") == target_m
                    else:
                        match_when = True

                if match_when and (duration_min <= duration <= duration_max):
                    dest_code = item.get("destination", "").upper()
                    total_passengers = adults + children
                    price_total = price * total_passengers

                    valid_deals.append({
                        "origin": origin,
                        "origin_name": SPAIN_AIRPORTS.get(origin, {}).get("city", origin),
                        "destination": dest_code,
                        "destination_name": get_destination_label(dest_code),
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
    Formato limpio sin abreviaturas raras ni (IATA) duplicados.
    """
    logging.info("Iniciando escaneo diario en los 26 aeropuertos de España (1-2 días, 2 personas)...")

    all_deals = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_flights_for_origin, code, 1, 2, 60, 2, 0, "year"): code for code in SPAIN_AIRPORTS.keys()}
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

        html += f"{m} <b>{deal['origin_name']} ➔ {deal['destination_name']}</b>\n"
        html += f"📅 <b>{dep_fmt} ➔ {ret_fmt}</b> ({deal['duration']} {'día' if deal['duration'] == 1 else 'días'}) · ⚡ <i>{trans}</i>\n"
        html += f"💰 <b>{deal['price_total']} € TOTAL</b> (2 x {deal['price_per_person']} € por persona)\n"
        html += f"👉 <a href='{deal['skyscanner_url']}'>Ver vuelo en Skyscanner</a>\n\n"

    bot_private_url = "https://t.me/VuelosEV_Bot?start=buscar"

    keyboard = [
        [{"text": "💬 BUSCADOR EN PRIVADO CON EL BOT", "url": bot_private_url}],
        [{"text": "🌐 Abrir Web de Vuelos", "url": "https://www.viajandoentesla.es/vuelos"}]
    ]

    reply_markup = {"inline_keyboard": keyboard}
    send_telegram_message(html, reply_markup=reply_markup, thread_id=TELEGRAM_TOPIC_ID, chat_id=TELEGRAM_CHAT_ID)

# --- BOT CONVERSACIONAL EN PRIVADO LIMPIO ---

def send_step_1_origin_private(chat_id):
    html = "✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += "<b>Paso 1 de 5:</b> Elige tu aeropuerto de salida:"

    keyboard = []
    items = list(SPAIN_AIRPORTS.items())
    for i in range(0, len(items), 2):
        row = []
        code1, info1 = items[i]
        row.append({"text": f"✈️ {info1['city']}", "callback_data": f"step1_{code1}"})
        if i + 1 < len(items):
            code2, info2 = items[i + 1]
            row.append({"text": f"✈️ {info2['city']}", "callback_data": f"step1_{code2}"})
        keyboard.append(row)

    keyboard.append([{"text": "🌟 Buscar en TODOS los Aeropuertos", "callback_data": "step1_ALL"}])
    return send_telegram_message(html, reply_markup={"inline_keyboard": keyboard}, chat_id=chat_id)

def send_step_2_when(chat_id, message_id, origin_code):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b>\n\n"
    html += "<b>Paso 2 de 5:</b> ¿Cuándo quieres viajar?"

    keyboard = [
        [{"text": "⚡ Esta semana (próximos 7 días)", "callback_data": f"step2_{origin_code}_week"}],
        [{"text": "📆 Este mes (próximos 30 días)", "callback_data": f"step2_{origin_code}_month"}],
        [{"text": "✈️ En 1 año vista (cualquier fecha)", "callback_data": f"step2_{origin_code}_year"}],
        [{"text": "📌 En un mes concreto", "callback_data": f"step2_{origin_code}_showmonths"}],
        [{"text": "🔄 Cambiar origen", "callback_data": "reset_flow"}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def send_step_2_months(chat_id, message_id, origin_code):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b>\n\n"
    html += "📅 <b>Selecciona el mes concreto para viajar:</b>"

    keyboard = []
    today = date.today()
    month_buttons = []

    for i in range(12):
        m_date = today.replace(day=1) + timedelta(days=i*32)
        m_date = m_date.replace(day=1)
        m_str = m_date.strftime("%Y-%m")
        m_label = f"{MONTH_NAMES_ES[m_date.month]} {m_date.year}"
        month_buttons.append({"text": f"📅 {m_label}", "callback_data": f"step2_{origin_code}_custom_{m_str}"})

    for i in range(0, len(month_buttons), 2):
        row = [month_buttons[i]]
        if i + 1 < len(month_buttons):
            row.append(month_buttons[i+1])
        keyboard.append(row)

    keyboard.append([{"text": "🔙 Volver a opciones de fecha", "callback_data": f"step1_{origin_code}"}])
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def send_step_3_duration(chat_id, message_id, origin_code, when_str):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    
    when_title = "Cualquier fecha"
    if when_str == "week": when_title = "Esta semana"
    elif when_str == "month": when_title = "Este mes"
    elif when_str == "year": when_title = "1 año vista"
    elif when_str.startswith("custom_"):
        parts = when_str.replace("custom_", "").split("-")
        y, m = int(parts[0]), int(parts[1])
        when_title = f"{MONTH_NAMES_ES[m]} {y}"

    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b>\n"
    html += f"📅 Fecha: <b>{when_title}</b>\n\n"
    html += "<b>Paso 3 de 5:</b> ¿De qué duración quieres el viaje?"

    keyboard = [
        [{"text": "⚡ 1 a 2 Días (Escapada Exprés)", "callback_data": f"step3_{origin_code}_{when_str}_1-2"}],
        [{"text": "📅 3 a 4 Días (Fin de semana largo)", "callback_data": f"step3_{origin_code}_{when_str}_3-4"}],
        [{"text": "🌴 5 a 7 Días (Semana completa)", "callback_data": f"step3_{origin_code}_{when_str}_5-7"}],
        [{"text": "✈️ Cualquier duración (1 a 14 días)", "callback_data": f"step3_{origin_code}_{when_str}_1-14"}],
        [{"text": "🔄 Cambiar fecha", "callback_data": f"step1_{origin_code}"}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def send_step_4_adults(chat_id, message_id, origin_code, when_str, dur_str):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    
    when_title = "Cualquier fecha"
    if when_str == "week": when_title = "Esta semana"
    elif when_str == "month": when_title = "Este mes"
    elif when_str == "year": when_title = "1 año vista"
    elif when_str.startswith("custom_"):
        parts = when_str.replace("custom_", "").split("-")
        y, m = int(parts[0]), int(parts[1])
        when_title = f"{MONTH_NAMES_ES[m]} {y}"

    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b>\n"
    html += f"📅 Fecha: <b>{when_title}</b>\n"
    html += f"⏱️ Duración: <b>{dur_str} días</b>\n\n"
    html += "<b>Paso 4 de 5:</b> ¿Cuántos ADULTOS van a viajar?"

    keyboard = [
        [{"text": "👤 1 Adulto", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_1a"}, {"text": "👥 2 Adultos", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_2a"}],
        [{"text": "👨‍👦‍👦 3 Adultos", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_3a"}, {"text": "👨‍👩‍👧‍👦 4 Adultos", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_4a"}],
        [{"text": "🔄 Reiniciar búsqueda", "callback_data": "reset_flow"}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def send_step_5_children(chat_id, message_id, origin_code, when_str, dur_str, adults_str):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    adults = int(adults_str.replace("a", ""))

    when_title = "Cualquier fecha"
    if when_str == "week": when_title = "Esta semana"
    elif when_str == "month": when_title = "Este mes"
    elif when_str == "year": when_title = "1 año vista"
    elif when_str.startswith("custom_"):
        parts = when_str.replace("custom_", "").split("-")
        y, m = int(parts[0]), int(parts[1])
        when_title = f"{MONTH_NAMES_ES[m]} {y}"

    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b>\n"
    html += f"📅 Fecha: <b>{when_title}</b> | ⏱️ Duración: <b>{dur_str} días</b>\n"
    html += f"👥 Adultos: <b>{adults}</b>\n\n"
    html += "<b>Paso 5 de 5:</b> ¿Cuántos NIÑOS viajan?"

    keyboard = [
        [{"text": "🚫 0 Niños", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_0c"}, {"text": "👶 1 Niño", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_1c"}],
        [{"text": "👶👶 2 Niños", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_2c"}, {"text": "👶👶👶 3 Niños", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_3c"}],
        [{"text": "🔄 Reiniciar búsqueda", "callback_data": "reset_flow"}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def execute_bot_search(chat_id, message_id, origin_code, when_str, dur_str, adults_str, children_str):
    dur_parts = dur_str.split("-")
    dur_min = int(dur_parts[0])
    dur_max = int(dur_parts[1])
    adults = int(adults_str.replace("a", ""))
    children = int(children_str.replace("c", ""))

    orig_title = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)

    when_title = "Cualquier fecha"
    if when_str == "week": when_title = "Esta semana"
    elif when_str == "month": when_title = "Este mes"
    elif when_str == "year": when_title = "1 año vista"
    elif when_str.startswith("custom_"):
        parts = when_str.replace("custom_", "").split("-")
        y, m = int(parts[0]), int(parts[1])
        when_title = f"{MONTH_NAMES_ES[m]} {y}"

    pax_desc = f"{adults} Adulto(s)" if children == 0 else f"{adults} Adulto(s) + {children} Niño(s)"

    loading_html = f"🔍 <b>Buscando los mejores chollos en tiempo real...</b>\n\n"
    loading_html += f"📍 Origen: <b>{orig_title}</b>\n📅 Fecha: <b>{when_title}</b>\n⏱️ Duración: <b>{dur_str} días</b> | 👥 <b>{pax_desc}</b>"
    edit_telegram_message(chat_id, message_id, loading_html)

    if origin_code == "ALL":
        all_deals = []
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(fetch_flights_for_origin, o, dur_min, dur_max, 30, adults, children, when_str): o for o in SPAIN_AIRPORTS.keys()}
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
        top_deals = fetch_flights_for_origin(origin_code, duration_min=dur_min, duration_max=dur_max, limit=50, adults=adults, children=children, when_filter=when_str)[:5]

    if not top_deals:
        fail_html = f"⚠️ No se han encontrado vuelos directos para <b>{orig_title}</b> ({when_title}, {dur_str} días) en este momento.\n\nPrueba otra combinación o busca directamente en nuestra web."
        kb = [[{"text": "🔄 Nueva búsqueda", "callback_data": "reset_flow"}, {"text": "🌐 Ir a la Web", "url": "https://www.viajandoentesla.es/vuelos"}]]
        edit_telegram_message(chat_id, message_id, fail_html, reply_markup={"inline_keyboard": kb})
        return

    res_html = f"🔥 <b>TOP CHOLLOS ENCONTRADOS EN TIEMPO REAL</b>\n"
    res_html += f"📍 <b>{orig_title}</b> · 📅 <b>{when_title}</b>\n⏱️ <b>{dur_str} días</b> · 👥 <b>{pax_desc}</b>\n\n"

    inline_kb = []
    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

    for idx, deal in enumerate(top_deals):
        m = medals[idx] if idx < len(medals) else "✈️"
        dep_fmt = datetime.strptime(deal["depart_date"], "%Y-%m-%d").strftime("%d %b")
        ret_fmt = datetime.strptime(deal["return_date"], "%Y-%m-%d").strftime("%d %b")

        res_html += f"{m} <b>{deal['origin_name']} ➔ {deal['destination_name']}</b>\n"
        res_html += f"📅 <b>{dep_fmt} ➔ {ret_fmt}</b> ({deal['duration']} {'día' if deal['duration'] == 1 else 'días'})\n"
        res_html += f"💰 <b>{deal['price_total']} € TOTAL</b> ({pax_desc} · {deal['price_per_person']} € por persona)\n"
        res_html += f"👉 <a href='{deal['skyscanner_url']}'>Ver vuelo en Skyscanner</a>\n\n"

        inline_kb.append([
            {"text": f"{m} Ver {deal['origin_name']} ➔ {deal['destination_name']} ({deal['price_total']}€ total)", "url": deal["skyscanner_url"]}
        ])

    inline_kb.append([{"text": "🔄 Nueva Búsqueda", "callback_data": "reset_flow"}, {"text": "🌐 Abrir Web", "url": "https://www.viajandoentesla.es/vuelos"}])

    edit_telegram_message(chat_id, message_id, res_html, reply_markup={"inline_keyboard": inline_kb})

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
    if not TELEGRAM_BOT_TOKEN:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN no configurado.")
        sys.exit(1)

    print(f"🤖 Bot Conversacional Vuelos EV activo (Nombres Reales de Ciudades)...")
    offset = None
    user_menu_messages = {}

    while True:
        try:
            updates = bot_get_updates(offset)
            for u in updates:
                offset = u["update_id"] + 1

                # 1. Manejar mensajes de texto
                if "message" in u:
                    msg = u["message"]
                    chat_id = msg["chat"]["id"]
                    chat_type = msg["chat"].get("type")
                    msg_id = msg["message_id"]
                    text = msg.get("text", "").strip()

                    if chat_type == "private":
                        delete_telegram_message(chat_id, msg_id)

                        if chat_id in user_menu_messages:
                            delete_telegram_message(chat_id, user_menu_messages[chat_id])

                        new_msg_id = send_step_1_origin_private(chat_id)
                        if new_msg_id:
                            user_menu_messages[chat_id] = new_msg_id

                    elif str(chat_id) == TELEGRAM_CHAT_ID or chat_id == TELEGRAM_CHAT_ID:
                        thread_id = msg.get("message_thread_id", TELEGRAM_TOPIC_ID)
                        if text.startswith("/vuelos") or text.startswith("/start") or text.lower() in ["vuelos", "escapadas"]:
                            reply_html = (
                                "✈️ <b>Buscador de Escapadas Vuelos EV</b>\n\n"
                                "👉 Para realizar una búsqueda personalizada interactiva sin llenar el grupo de mensajes, "
                                '<a href="https://t.me/VuelosEV_Bot?start=buscar">haz clic aquí para abrir la conversación privada con el Bot</a>.'
                            )
                            kb = [[{"text": "💬 Abrir Buscador en Privado", "url": "https://t.me/VuelosEV_Bot?start=buscar"}]]
                            send_telegram_message(reply_html, reply_markup={"inline_keyboard": kb}, thread_id=thread_id, chat_id=chat_id)

                # 2. Manejar clics en botones inline
                elif "callback_query" in u:
                    cb = u["callback_query"]
                    cb_id = cb["id"]
                    data = cb.get("data", "")
                    msg = cb.get("message", {})
                    chat_id = msg.get("chat", {}).get("id")
                    chat_type = msg.get("chat", {}).get("type")
                    message_id = msg.get("message_id")

                    bot_answer_callback(cb_id)

                    if chat_type == "private":
                        if data == "reset_flow":
                            delete_telegram_message(chat_id, message_id)
                            new_msg_id = send_step_1_origin_private(chat_id)
                            if new_msg_id:
                                user_menu_messages[chat_id] = new_msg_id

                        elif data.startswith("step1_"):
                            orig_code = data.replace("step1_", "")
                            send_step_2_when(chat_id, message_id, orig_code)

                        elif data.startswith("step2_"):
                            parts = data.split("_")
                            orig_code = parts[1]
                            when_type = parts[2]
                            if when_type == "showmonths":
                                send_step_2_months(chat_id, message_id, orig_code)
                            else:
                                when_str = when_type if len(parts) == 3 else f"{parts[2]}_{parts[3]}"
                                send_step_3_duration(chat_id, message_id, orig_code, when_str)

                        elif data.startswith("step3_"):
                            parts = data.split("_")
                            orig_code = parts[1]
                            when_str = parts[2] if len(parts) == 4 else f"{parts[2]}_{parts[3]}"
                            dur_str = parts[-1]
                            send_step_4_adults(chat_id, message_id, orig_code, when_str, dur_str)

                        elif data.startswith("step4_"):
                            parts = data.split("_")
                            orig_code = parts[1]
                            when_str = parts[2] if len(parts) == 5 else f"{parts[2]}_{parts[3]}"
                            dur_str = parts[-2]
                            adults_str = parts[-1]
                            send_step_5_children(chat_id, message_id, orig_code, when_str, dur_str, adults_str)

                        elif data.startswith("step5_"):
                            parts = data.split("_")
                            orig_code = parts[1]
                            when_str = parts[2] if len(parts) == 6 else f"{parts[2]}_{parts[3]}"
                            dur_str = parts[-3]
                            adults_str = parts[-2]
                            children_str = parts[-1]
                            execute_bot_search(chat_id, message_id, orig_code, when_str, dur_str, adults_str, children_str)

                    else:
                        reply_html = '👉 <a href="https://t.me/VuelosEV_Bot?start=buscar">Haz clic aquí para abrir el buscador en privado</a>.'
                        kb = [[{"text": "💬 Abrir en Privado", "url": "https://t.me/VuelosEV_Bot?start=buscar"}]]
                        send_telegram_message(reply_html, reply_markup={"inline_keyboard": kb}, thread_id=msg.get("message_thread_id"), chat_id=chat_id)

        except Exception as e:
            logging.error(f"Error en bucle bot: {e}")
            time.sleep(3)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ["--bot", "bot"]:
        run_interactive_bot()
    else:
        publish_daily_getaways()
