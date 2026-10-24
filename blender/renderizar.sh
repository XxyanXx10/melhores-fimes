#!/usr/bin/env bash
# Renderiza as tomadas de uma cena 3D, uma de cada vez, e transforma cada uma em MP4.
#
#   bash blender/renderizar.sh lojinha abertura missao barato ...
#
# Os quadros PNG vão para C:/Users/yaned/Videos/Melhores Fimes/3d/<cena>/<tomada>/ (o D: vive cheio);
# o MP4 vai para public/midia/banco/videos/3d-<cena>-<tomada>.mp4, pronto para o plano de cenas.
# Roda solto: inicie com Start-Process bash.exe -WindowStyle Hidden e acompanhe o log.
cd "/d/Edição de video simplificado" || exit 1
CENA="$1"; shift
B="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("server/config.json","utf8")).blender)')"
FF="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("server/config.json","utf8")).ffmpeg)')"
QUADROS="C:/Users/yaned/Videos/Melhores Fimes/3d/$CENA"
LOG="render/.tmp/3d-$CENA.log"
mkdir -p render/.tmp
echo "início $(date +%H:%M:%S)" > "$LOG"
for t in "$@"; do
  t0=$(date +%s)
  echo "rodando $t" >> "$LOG"
  rm -f "$QUADROS/$t"/f*.png
  "$B" -b --factory-startup --python "blender/$CENA.py" -- "$t" > "render/.tmp/3d-$CENA-$t.txt" 2>&1
  "$FF" -y -loglevel error -framerate 30 -i "$QUADROS/$t/f%04d.png" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
    "public/midia/banco/videos/3d-$CENA-$t.mp4"
  echo "$t: saiu $? em $(( $(date +%s) - t0 ))s" >> "$LOG"
done
echo "fim $(date +%H:%M:%S)" >> "$LOG"
