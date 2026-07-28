#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  sync_and_deploy.sh
#  Sincroniza el inventario local con la web y despliega
#  a Vercel. Programado para ejecutarse cada noche a la 1:30.
# ═══════════════════════════════════════════════════════════════

set -e

LOG_FILE="/home/xavi/proyectos-antigravity/2-navegador-tesla/scripts/sync_deploy.log"
SRC="/home/xavi/proyectos-antigravity/1-referidos/inventarios"
DST="/home/xavi/proyectos-antigravity/2-navegador-tesla/public/data"
IMG_SRC="/home/xavi/proyectos-antigravity/1-referidos/inventarios/img"
IMG_DST="/home/xavi/proyectos-antigravity/2-navegador-tesla/public/img"
WEB_DIR="/home/xavi/proyectos-antigravity/2-navegador-tesla"

echo "" >> "$LOG_FILE"
echo "══════════════════════════════════" >> "$LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') — Iniciando sync" >> "$LOG_FILE"

# 1. Copiar ficheros del inventario (JSON)
echo "📂 Copiando inventario JSON..." >> "$LOG_FILE"
cp "$SRC/inventario_global.json" "$DST/inventario_global.json"
cp "$SRC/comentarios.json"       "$DST/comentarios.json"
cp "$SRC/votos_globales.json"    "$DST/votos_globales.json"
echo "✅ Inventario JSON copiado" >> "$LOG_FILE"

# 2. Sincronizar imágenes nuevas (solo copia las que faltan, no borra nada)
echo "🖼️  Sincronizando imágenes..." >> "$LOG_FILE"
rsync -a --ignore-existing "$IMG_SRC/" "$IMG_DST/" >> "$LOG_FILE" 2>&1
echo "✅ Imágenes sincronizadas" >> "$LOG_FILE"

# 3. Desplegar a Vercel
echo "🚀 Desplegando a Vercel..." >> "$LOG_FILE"
cd "$WEB_DIR"
npx vercel --prod --yes >> "$LOG_FILE" 2>&1

echo "✅ Deploy completado a las $(date '+%H:%M:%S')" >> "$LOG_FILE"
