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
        [{"text": "💬 BUSCADOR EN PRIVADO CON EL BOT", "url": bot_private_url}]
    ]

    reply_markup = {"inline_keyboard": keyboard}
    send_telegram_message(html, reply_markup=reply_markup, thread_id=TELEGRAM_TOPIC_ID, chat_id=TELEGRAM_CHAT_ID)

# --- BOT CONVERSACIONAL EN PRIVADO LIMPIO ---

# Grupos y Zonas de Destinos idénticos a la página web (https://www.viajandoentesla.es/vuelos)
DESTINATION_GROUPS = [
    {
        "key": "REGION_ES_MAIN",
        "label": "🇪🇸 España (Península)",
        "items": [
            {"code": "REGION_ES_MAIN", "city": "✨ Toda España (Península)"},
            {"code": "MAD", "city": "Madrid"},
            {"code": "BCN", "city": "Barcelona"},
            {"code": "VLC", "city": "Valencia"},
            {"code": "AGP", "city": "Málaga"},
            {"code": "SVQ", "city": "Sevilla"},
            {"code": "BIO", "city": "Bilbao"},
            {"code": "ALC", "city": "Alicante"},
            {"code": "SCQ", "city": "Santiago de Compostela"},
            {"code": "SDR", "city": "Santander"},
            {"code": "VGO", "city": "Vigo"},
            {"code": "OVD", "city": "Asturias"},
            {"code": "ZAZ", "city": "Zaragoza"},
            {"code": "GRX", "city": "Granada"},
            {"code": "MJV", "city": "Murcia"},
            {"code": "XRY", "city": "Jerez"},
            {"code": "REU", "city": "Reus"},
            {"code": "GRO", "city": "Girona"},
        ]
    },
    {
        "key": "REGION_BALEARES",
        "label": "🏝️ Islas Baleares",
        "items": [
            {"code": "REGION_BALEARES", "city": "✨ Todas las Islas Baleares"},
            {"code": "PMI", "city": "Palma de Mallorca"},
            {"code": "IBZ", "city": "Ibiza"},
            {"code": "MAH", "city": "Menorca"},
        ]
    },
    {
        "key": "REGION_CANARIAS",
        "label": "🌴 Islas Canarias",
        "items": [
            {"code": "REGION_CANARIAS", "city": "✨ Todas las Islas Canarias"},
            {"code": "TFN", "city": "Tenerife Norte"},
            {"code": "TFS", "city": "Tenerife Sur"},
            {"code": "LPA", "city": "Gran Canaria"},
            {"code": "ACE", "city": "Lanzarote"},
            {"code": "FUE", "city": "Fuerteventura"},
            {"code": "SPC", "city": "La Palma"},
        ]
    },
    {
        "key": "REGION_PT",
        "label": "🇵🇹 Portugal",
        "items": [
            {"code": "REGION_PT", "city": "✨ Todo Portugal"},
            {"code": "LIS", "city": "Lisboa"},
            {"code": "OPO", "city": "Oporto"},
            {"code": "FAO", "city": "Faro (Algarve)"},
            {"code": "FNC", "city": "Funchal (Madeira)"},
        ]
    },
    {
        "key": "REGION_FR",
        "label": "🇫🇷 Francia",
        "items": [
            {"code": "REGION_FR", "city": "✨ Toda Francia"},
            {"code": "PAR", "city": "París"},
            {"code": "NCE", "city": "Niza"},
            {"code": "LYS", "city": "Lyon"},
            {"code": "MRS", "city": "Marsella"},
            {"code": "BOD", "city": "Burdeos"},
            {"code": "TLS", "city": "Toulouse"},
            {"code": "NTE", "city": "Nantes"},
            {"code": "MPL", "city": "Montpellier"},
            {"code": "BIQ", "city": "Biarritz"},
        ]
    },
    {
        "key": "REGION_IT",
        "label": "🇮🇹 Italia",
        "items": [
            {"code": "REGION_IT", "city": "✨ Toda Italia"},
            {"code": "MIL", "city": "Milán"},
            {"code": "ROM", "city": "Roma"},
            {"code": "NAP", "city": "Nápoles"},
            {"code": "VCE", "city": "Venecia"},
            {"code": "FLR", "city": "Florencia"},
            {"code": "BLQ", "city": "Bolonia"},
            {"code": "TRN", "city": "Turín"},
            {"code": "BRI", "city": "Bari"},
            {"code": "PMO", "city": "Palermo (Sicilia)"},
            {"code": "CTA", "city": "Catania (Sicilia)"},
            {"code": "OLB", "city": "Olbia (Cerdeña)"},
            {"code": "CAG", "city": "Cagliari (Cerdeña)"},
        ]
    },
    {
        "key": "REGION_UK_IE",
        "label": "🇬🇧 Reino Unido & Irlanda",
        "items": [
            {"code": "REGION_UK_IE", "city": "✨ Todo Reino Unido e Irlanda"},
            {"code": "LON", "city": "Londres"},
            {"code": "EDI", "city": "Edimburgo"},
            {"code": "MAN", "city": "Mánchester"},
            {"code": "BRS", "city": "Bristol"},
            {"code": "BHX", "city": "Birmingham"},
            {"code": "GLA", "city": "Glasgow"},
            {"code": "DUB", "city": "Dublín"},
        ]
    },
    {
        "key": "REGION_DE",
        "label": "🇩🇪 Alemania",
        "items": [
            {"code": "REGION_DE", "city": "✨ Toda Alemania"},
            {"code": "BER", "city": "Berlín"},
            {"code": "MUC", "city": "Múnich"},
            {"code": "FRA", "city": "Fráncfort"},
            {"code": "HAM", "city": "Hamburgo"},
            {"code": "CGN", "city": "Colonia"},
        ]
    },
    {
        "key": "REGION_NL_BE",
        "label": "🇳🇱 Países Bajos & Bélgica",
        "items": [
            {"code": "REGION_NL_BE", "city": "✨ Países Bajos y Bélgica"},
            {"code": "AMS", "city": "Ámsterdam"},
            {"code": "EIN", "city": "Eindhoven"},
            {"code": "BRU", "city": "Bruselas"},
            {"code": "CRL", "city": "Bruselas Charleroi"},
        ]
    },
    {
        "key": "REGION_AT_CH",
        "label": "🇦🇹 Austria & Suiza",
        "items": [
            {"code": "REGION_AT_CH", "city": "✨ Austria y Suiza"},
            {"code": "VIE", "city": "Viena"},
            {"code": "ZRH", "city": "Zúrich"},
            {"code": "GVA", "city": "Ginebra"},
            {"code": "BSL", "city": "Basilea"},
        ]
    },
    {
        "key": "REGION_CZ_HU_PL",
        "label": "🇨🇿 Rep. Checa, Hungría & Polonia",
        "items": [
            {"code": "REGION_CZ_HU_PL", "city": "✨ Rep. Checa, Hungría y Polonia"},
            {"code": "PRG", "city": "Praga"},
            {"code": "BUD", "city": "Budapest"},
            {"code": "WAW", "city": "Varsovia"},
            {"code": "KRK", "city": "Cracovia"},
        ]
    },
    {
        "key": "REGION_NORDIC",
        "label": "🇸🇪 Escandinavia & Bálticos",
        "items": [
            {"code": "REGION_NORDIC", "city": "✨ Escandinavia y Bálticos"},
            {"code": "OSL", "city": "Oslo"},
            {"code": "STO", "city": "Estocolmo"},
            {"code": "CPH", "city": "Copenhague"},
            {"code": "HEL", "city": "Helsinki"},
            {"code": "REK", "city": "Reikiavik"},
        ]
    },
    {
        "key": "REGION_GR_CY",
        "label": "🇬🇷 Grecia & Chipre",
        "items": [
            {"code": "REGION_GR_CY", "city": "✨ Grecia y Chipre"},
            {"code": "ATH", "city": "Atenas"},
            {"code": "HER", "city": "Creta"},
            {"code": "JTR", "city": "Santorini"},
            {"code": "JMK", "city": "Mikonos"},
            {"code": "CFU", "city": "Corfú"},
            {"code": "LCA", "city": "Chipre"},
        ]
    },
    {
        "key": "REGION_TR",
        "label": "🇹🇷 Turquía",
        "items": [
            {"code": "REGION_TR", "city": "✨ Toda Turquía"},
            {"code": "IST", "city": "Estambul"},
            {"code": "AYT", "city": "Antalya"},
        ]
    },
    {
        "key": "REGION_BALKANS",
        "label": "🇭🇷 Croacia & Balcanes",
        "items": [
            {"code": "REGION_BALKANS", "city": "✨ Croacia y Balcanes"},
            {"code": "SPU", "city": "Split"},
            {"code": "DBV", "city": "Dubrovnik"},
            {"code": "ZAG", "city": "Zagreb"},
            {"code": "BEG", "city": "Belgrado"},
        ]
    },
    {
        "key": "REGION_MA_NA",
        "label": "🇲🇦 Marruecos & Norte África",
        "items": [
            {"code": "REGION_MA_NA", "city": "✨ Marruecos y Norte África"},
            {"code": "RAK", "city": "Marrakech"},
            {"code": "CMN", "city": "Casablanca"},
            {"code": "TNG", "city": "Tánger"},
            {"code": "FEZ", "city": "Fez"},
        ]
    },
    {
        "key": "REGION_MALTA",
        "label": "🇲🇹 Malta & Mediterráneo",
        "items": [
            {"code": "REGION_MALTA", "city": "✨ Malta"},
            {"code": "MLA", "city": "Malta"},
        ]
    },
    {
        "key": "REGION_AMERICA",
        "label": "🇺🇸 América",
        "items": [
            {"code": "REGION_AMERICA", "city": "✨ Toda América"},
            {"code": "JFK", "city": "Nueva York"},
            {"code": "MIA", "city": "Miami"},
            {"code": "LAX", "city": "Los Ángeles"},
            {"code": "CUN", "city": "Cancún"},
            {"code": "MEX", "city": "Ciudad de México"},
            {"code": "BOG", "city": "Bogotá"},
            {"code": "LIM", "city": "Lima"},
            {"code": "EZE", "city": "Buenos Aires"},
        ]
    },
    {
        "key": "REGION_MIDDLE_EAST",
        "label": "🇦🇪 Oriente Medio",
        "items": [
            {"code": "REGION_MIDDLE_EAST", "city": "✨ Oriente Medio"},
            {"code": "DXB", "city": "Dubái"},
            {"code": "DOH", "city": "Doha"},
        ]
    },
    {
        "key": "REGION_ASIA",
        "label": "🌏 Asia",
        "items": [
            {"code": "REGION_ASIA", "city": "✨ Toda Asia"},
            {"code": "BKK", "city": "Bangkok"},
            {"code": "SIN", "city": "Singapur"},
            {"code": "NRT", "city": "Tokio"},
        ]
    },
]

REGION_DESTINATIONS = {
    "REGION_ES_MAIN": ["MAD", "BCN", "VLC", "AGP", "SVQ", "BIO", "ALC", "SCQ", "SDR", "VGO", "OVD", "ZAZ", "GRX", "MJV", "XRY", "REU", "GRO"],
    "REGION_BALEARES": ["PMI", "IBZ", "MAH"],
    "REGION_CANARIAS": ["TFN", "TFS", "LPA", "ACE", "FUE", "SPC"],
    "REGION_PT": ["LIS", "OPO", "FAO", "FNC"],
    "REGION_FR": ["PAR", "CDG", "ORY", "BVA", "NCE", "LYS", "MRS", "BOD", "TLS", "NTE", "MPL", "BIQ"],
    "REGION_IT": ["MIL", "MXP", "LIN", "BGY", "ROM", "FCO", "CIA", "NAP", "VCE", "TSF", "FLR", "BLQ", "TRN", "BRI", "PMO", "CTA", "OLB", "CAG", "AHO", "PSA", "TRS", "SUF", "VRN", "PEG", "PSR", "BZO"],
    "REGION_UK_IE": ["LON", "LHR", "LGW", "STN", "LTN", "SEN", "EDI", "MAN", "BRS", "BHX", "GLA", "PIK", "LPL", "NCL", "BOH", "EXT", "DUB", "BFS"],
    "REGION_DE": ["BER", "MUC", "FRA", "HHN", "DUS", "HAM", "CGN", "STR", "NUE"],
    "REGION_NL_BE": ["AMS", "EIN", "BRU", "CRL"],
    "REGION_AT_CH": ["VIE", "SZG", "INN", "ZRH", "GVA", "BSL"],
    "REGION_CZ_HU_PL": ["PRG", "BUD", "WAW", "WMI", "KRK", "WRO", "GDN"],
    "REGION_NORDIC": ["OSL", "STO", "GOT", "CPH", "HEL", "REK", "RIX", "TLL", "VNO"],
    "REGION_GR_CY": ["ATH", "SKG", "HER", "CHQ", "RHO", "JTR", "JMK", "CFU", "KGS", "ZTH", "LCA", "PFO"],
    "REGION_TR": ["IST", "SAW", "AYT", "DLM", "BJV", "ADB"],
    "REGION_BALKANS": ["ZAG", "SPU", "DBV", "ZAD", "BEG", "TIA", "SOF", "OTP"],
    "REGION_MA_NA": ["RAK", "CMN", "TNG", "FEZ", "AGA", "TUN", "CAI", "HRG", "SSH"],
    "REGION_MALTA": ["MLA", "SJJ"],
    "REGION_AMERICA": ["JFK", "MIA", "LAX", "ORD", "BOS", "CUN", "MEX", "BOG", "LIM", "EZE", "GRU", "GIG", "HAV", "SDQ"],
    "REGION_MIDDLE_EAST": ["DXB", "DOH", "AUH", "AMM", "TLV"],
    "REGION_ASIA": ["BKK", "HKT", "SIN", "KUL", "HKG", "NRT", "TYO"],
}

CITY_AIRPORT_GROUPS = {
    "ROM": ["ROM", "FCO", "CIA"],
    "MIL": ["MIL", "MXP", "LIN", "BGY"],
    "PAR": ["PAR", "CDG", "ORY", "BVA"],
    "LON": ["LON", "LHR", "LGW", "STN", "LTN", "SEN"],
    "BRU": ["BRU", "CRL"],
    "AMS": ["AMS", "EIN"],
    "TFS": ["TFS", "TFN", "LPA", "ACE", "FUE", "SPC"],
    "CAG": ["CAG", "OLB", "AHO"],
    "PMO": ["PMO", "CTA"],
    "FLR": ["FLR", "PSA"],
    "FRA": ["FRA", "HHN"],
    "VCE": ["VCE", "TSF"],
    "WAW": ["WAW", "KRK", "WMI"],
    "CPH": ["CPH", "OSL", "STO", "HEL"],
    "JFK": ["JFK", "EWR", "NYC"],
}

def is_destination_match(dest_code: str, target_dest: str) -> bool:
    if not target_dest or target_dest == "ANY":
        return True
    if target_dest in REGION_DESTINATIONS:
        return dest_code in REGION_DESTINATIONS[target_dest]
    if target_dest in CITY_AIRPORT_GROUPS:
        return dest_code in CITY_AIRPORT_GROUPS[target_dest]
    return dest_code == target_dest

def get_destination_title(target_dest: str) -> str:
    if not target_dest or target_dest == "ANY":
        return "Cualquier destino"
    for g in DESTINATION_GROUPS:
        if g["key"] == target_dest:
            return g["label"]
        for item in g["items"]:
            if item["code"] == target_dest:
                return item["city"]
    return WORLD_AIRPORTS.get(target_dest, {}).get("city", target_dest)

# --- BOT CONVERSACIONAL EN PRIVADO LIMPIO ---

def send_step_1_origin_private(chat_id, message_id=None):
    html = "✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += "<b>Paso 1 de 6:</b> Elige tu aeropuerto de salida:"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

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

    keyboard.append([{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}])

    if message_id:
        edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})
        return message_id
    else:
        return send_telegram_message(html, reply_markup={"inline_keyboard": keyboard}, chat_id=chat_id)

def send_step_2_when(chat_id, message_id, origin_code):
    orig_name = SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b>\n\n"
    html += "<b>Paso 2 de 6:</b> ¿Cuándo quieres viajar?"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

    keyboard = [
        [{"text": "⚡ Esta semana (próximos 7 días)", "callback_data": f"step2_{origin_code}_week"}],
        [{"text": "📆 Este mes (próximos 30 días)", "callback_data": f"step2_{origin_code}_month"}],
        [{"text": "✈️ En 1 año vista (cualquier fecha)", "callback_data": f"step2_{origin_code}_year"}],
        [{"text": "◀️ Volver atrás", "callback_data": "back_to_step1"}],
        [{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}]
    ]
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
    html += "<b>Paso 3 de 6:</b> ¿De qué duración quieres el viaje?"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

    keyboard = [
        [{"text": "⚡ 1 a 2 Días (Escapada Exprés)", "callback_data": f"step3_{origin_code}_{when_str}_1-2"}],
        [{"text": "📅 3 a 4 Días (Escapada)", "callback_data": f"step3_{origin_code}_{when_str}_3-4"}],
        [{"text": "🌴 5 a 7 Días (Escapada larga)", "callback_data": f"step3_{origin_code}_{when_str}_5-7"}],
        [{"text": "✈️ Cualquier duración (1 a 10 días)", "callback_data": f"step3_{origin_code}_{when_str}_1-10"}],
        [{"text": "◀️ Volver atrás", "callback_data": f"step1_{origin_code}"}],
        [{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}]
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
    html += "<b>Paso 4 de 6:</b> ¿Cuántos ADULTOS van a viajar?"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

    keyboard = [
        [{"text": "👤 1 Adulto", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_1a"}, {"text": "👥 2 Adultos", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_2a"}],
        [{"text": "👨‍👦‍👦 3 Adultos", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_3a"}, {"text": "👨‍👩‍👧‍👦 4 Adultos", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_4a"}],
        [{"text": "◀️ Volver atrás", "callback_data": f"step2_{origin_code}_{when_str}"}],
        [{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}]
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
    html += "<b>Paso 5 de 6:</b> ¿Cuántos NIÑOS viajan?"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

    keyboard = [
        [{"text": "🚫 0 Niños", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_0c"}, {"text": "👶 1 Niño", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_1c"}],
        [{"text": "👶👶 2 Niños", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_2c"}, {"text": "👶👶👶 3 Niños", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_3c"}],
        [{"text": "◀️ Volver atrás", "callback_data": f"step3_{origin_code}_{when_str}_{dur_str}"}],
        [{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

# --- PASO 6: SELECCIÓN DE DESTINO ---

def send_step_6_dest_type(chat_id, message_id, origin_code, when_str, dur_str, adults_str, children_str):
    orig_name = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    adults = int(adults_str.replace("a", ""))
    children = int(children_str.replace("c", ""))
    pax_desc = f"{adults} Adulto(s)" if children == 0 else f"{adults} Adultos + {children} Niños"

    when_title = "Cualquier fecha"
    if when_str == "week": when_title = "Esta semana"
    elif when_str == "month": when_title = "Este mes"
    elif when_str == "year": when_title = "1 año vista"

    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Origen: <b>{orig_name}</b> | 📅 Fecha: <b>{when_title}</b>\n"
    html += f"⏱️ Duración: <b>{dur_str} días</b> | 👥 <b>{pax_desc}</b>\n\n"
    html += "<b>Paso 6 de 6:</b> ¿A dónde quieres viajar?"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

    keyboard = [
        [{"text": "🌍 Cualquier destino (A cualquier parte)", "callback_data": f"search_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}_ANY"}],
        [{"text": "🗺️ Escoger por zona / grupo de destinos", "callback_data": f"st6zone_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}"}],
        [{"text": "◀️ Volver atrás", "callback_data": f"step4_{origin_code}_{when_str}_{dur_str}_{adults_str}"}],
        [{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}]
    ]
    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def send_step_6_zones(chat_id, message_id, origin_code, when_str, dur_str, adults_str, children_str):
    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += "<b>Paso 6 de 6:</b> Selecciona una zona o grupo de destinos:"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

    keyboard = []
    for i in range(0, len(DESTINATION_GROUPS), 2):
        row = []
        g1 = DESTINATION_GROUPS[i]
        row.append({"text": g1["label"], "callback_data": f"st6grp_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}_{g1['key']}"})
        if i + 1 < len(DESTINATION_GROUPS):
            g2 = DESTINATION_GROUPS[i + 1]
            row.append({"text": g2["label"], "callback_data": f"st6grp_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}_{g2['key']}"})
        keyboard.append(row)

    keyboard.append([{"text": "◀️ Volver atrás", "callback_data": f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}"}])
    keyboard.append([{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}])

    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def send_step_6_items(chat_id, message_id, origin_code, when_str, dur_str, adults_str, children_str, group_key):
    group_info = next((g for g in DESTINATION_GROUPS if g["key"] == group_key), None)
    group_label = group_info["label"] if group_info else group_key

    html = f"✈️ <b>BUSCADOR DE ESCAPADAS BARATAS</b>\n\n"
    html += f"📍 Zona seleccionada: <b>{group_label}</b>\n\n"
    html += f"<b>Paso 6 de 6:</b> Elige tu destino dentro de {group_label}:"

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"

    keyboard = []
    items = group_info["items"] if group_info else []

    for item in items:
        btn_text = item["city"]
        keyboard.append([{"text": btn_text, "callback_data": f"search_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}_{item['code']}"}])

    keyboard.append([{"text": "◀️ Volver a Zonas", "callback_data": f"st6zone_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}"}])
    keyboard.append([{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}])

    edit_telegram_message(chat_id, message_id, html, reply_markup={"inline_keyboard": keyboard})

def execute_bot_search(chat_id, message_id, origin_code, when_str, dur_str, adults_str, children_str, dest_str="ANY"):
    dur_parts = dur_str.split("-")
    dur_min = int(dur_parts[0])
    dur_max = int(dur_parts[1])
    adults = int(adults_str.replace("a", ""))
    children = int(children_str.replace("c", ""))

    orig_title = "Todos los aeropuertos" if origin_code == "ALL" else SPAIN_AIRPORTS.get(origin_code, {}).get("city", origin_code)
    dest_title = get_destination_title(dest_str)

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
    loading_html += f"📍 Origen: <b>{orig_title}</b>\n🗺️ Destino: <b>{dest_title}</b>\n📅 Fecha: <b>{when_title}</b>\n⏱️ Duración: <b>{dur_str} días</b> | 👥 <b>{pax_desc}</b>"
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
        if dest_str != "ANY":
            all_deals = [d for d in all_deals if is_destination_match(d["destination"], dest_str)]
        all_deals.sort(key=lambda x: x["price_per_person"])
        top_deals = all_deals[:5]
    else:
        deals = fetch_flights_for_origin(origin_code, duration_min=dur_min, duration_max=dur_max, limit=60, adults=adults, children=children, when_filter=when_str)
        if dest_str != "ANY":
            deals = [d for d in deals if is_destination_match(d["destination"], dest_str)]
        deals.sort(key=lambda x: x["price_per_person"])
        top_deals = deals[:5]

    group_topic_url = f"https://t.me/mgchuches/{TELEGRAM_TOPIC_ID}"
    back_data = f"step5_{origin_code}_{when_str}_{dur_str}_{adults_str}_{children_str}"

    if not top_deals:
        fail_html = f"⚠️ No se han encontrado vuelos directos para <b>{orig_title} ➔ {dest_title}</b> ({when_title}, {dur_str} días) en este momento.\n\nPrueba otra combinación o busca directamente en nuestra web."
        kb = [
            [{"text": "◀️ Volver atrás", "callback_data": back_data}],
            [{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}]
        ]
        edit_telegram_message(chat_id, message_id, fail_html, reply_markup={"inline_keyboard": kb})
        return

    res_html = f"🔥 <b>TOP CHOLLOS ENCONTRADOS EN TIEMPO REAL</b>\n"
    res_html += f"📍 <b>{orig_title} ➔ {dest_title}</b>\n📅 <b>{when_title}</b> · ⏱️ <b>{dur_str} días</b> · 👥 <b>{pax_desc}</b>\n\n"

    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

    for idx, deal in enumerate(top_deals):
        m = medals[idx] if idx < len(medals) else "✈️"
        dep_fmt = datetime.strptime(deal["depart_date"], "%Y-%m-%d").strftime("%d %b")
        ret_fmt = datetime.strptime(deal["return_date"], "%Y-%m-%d").strftime("%d %b")

        res_html += f"{m} <b>{deal['origin_name']} ➔ {deal['destination_name']}</b>\n"
        res_html += f"📅 <b>{dep_fmt} ➔ {ret_fmt}</b> ({deal['duration']} {'día' if deal['duration'] == 1 else 'días'})\n"
        res_html += f"💰 <b>{deal['price_total']} € TOTAL</b> ({pax_desc} · {deal['price_per_person']} € por persona)\n"
        res_html += f"👉 <a href='{deal['skyscanner_url']}'>Ver vuelo en Skyscanner</a>\n\n"

    inline_kb = [
        [{"text": "◀️ Volver atrás", "callback_data": back_data}],
        [{"text": "💬 Volver al Topic de Telegram", "url": group_topic_url}]
    ]

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

def parse_step6_callback(data, prefix):
    payload = data[len(prefix):]
    parts = payload.split("_")
    orig_code = parts[0]
    
    if len(parts) > 1 and parts[1] == "custom":
        when_str = f"{parts[1]}_{parts[2]}"
        rest = parts[3:]
    else:
        when_str = parts[1] if len(parts) > 1 else "year"
        rest = parts[2:] if len(parts) > 2 else []
    
    dur_str = rest[0] if len(rest) > 0 else "1-10"
    adults_str = rest[1] if len(rest) > 1 else "2a"
    children_str = rest[2] if len(rest) > 2 else "0c"
    key_or_dest = "_".join(rest[3:]) if len(rest) > 3 else ""
    
    return orig_code, when_str, dur_str, adults_str, children_str, key_or_dest

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
                        if data == "reset_flow" or data == "back_to_step1":
                            send_step_1_origin_private(chat_id, message_id)

                        elif data.startswith("step1_"):
                            orig_code = data.replace("step1_", "")
                            send_step_2_when(chat_id, message_id, orig_code)

                        elif data.startswith("step2_"):
                            parts = data.split("_")
                            orig_code = parts[1]
                            when_type = "_".join(parts[2:])
                            send_step_3_duration(chat_id, message_id, orig_code, when_type)

                        elif data.startswith("step3_"):
                            parts = data.split("_")
                            orig_code = parts[1]
                            dur_str = parts[-1]
                            when_str = "_".join(parts[2:-1])
                            send_step_4_adults(chat_id, message_id, orig_code, when_str, dur_str)

                        elif data.startswith("step4_"):
                            parts = data.split("_")
                            orig_code = parts[1]
                            adults_str = parts[-1]
                            dur_str = parts[-2]
                            when_str = "_".join(parts[2:-2])
                            send_step_5_children(chat_id, message_id, orig_code, when_str, dur_str, adults_str)

                        elif data.startswith("step5_"):
                            orig_code, when_str, dur_str, adults_str, children_str, _ = parse_step6_callback(data, "step5_")
                            send_step_6_dest_type(chat_id, message_id, orig_code, when_str, dur_str, adults_str, children_str)

                        elif data.startswith("st6zone_"):
                            orig_code, when_str, dur_str, adults_str, children_str, _ = parse_step6_callback(data, "st6zone_")
                            send_step_6_zones(chat_id, message_id, orig_code, when_str, dur_str, adults_str, children_str)

                        elif data.startswith("st6grp_"):
                            orig_code, when_str, dur_str, adults_str, children_str, group_key = parse_step6_callback(data, "st6grp_")
                            send_step_6_items(chat_id, message_id, orig_code, when_str, dur_str, adults_str, children_str, group_key)

                        elif data.startswith("search_"):
                            orig_code, when_str, dur_str, adults_str, children_str, dest_str = parse_step6_callback(data, "search_")
                            execute_bot_search(chat_id, message_id, orig_code, when_str, dur_str, adults_str, children_str, dest_str)

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
