/**
 * Baixa fotos livres do Wikimedia Commons (para o "Real ou IA" e afins).
 *
 *   node agente/commons.mjs "<busca>" <arquivo-destino.jpg> [--n 1]
 *
 * Procura arquivos de imagem, prefere fotos grandes (>= 900 px), baixa a versão de
 * 1280 px e grava a licença e o autor ao lado (<arquivo>.txt). Só aceita licença livre
 * (CC0, domínio público, CC BY, CC BY-SA).
 */
import { writeFileSync } from 'node:fs';

const [busca, destino] = process.argv.slice(2);
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'MelhoresFimes/1.0 (canal de video; contato via YouTube @ianautomacoes)' };

const url = `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(busca + ' filetype:bitmap')}` +
  '&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=1280';
const j = await (await fetch(url, { headers: UA })).json();
const paginas = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
const livre = /cc0|public domain|cc by|cc-by|pd/i;
const escolhida = paginas.find((p) => {
  const ii = p.imageinfo?.[0];
  const lic = ii?.extmetadata?.LicenseShortName?.value ?? '';
  return ii && /jpe?g|png/.test(ii.mime) && ii.width >= 900 && ii.height >= 600 && livre.test(lic);
});
if (!escolhida) {
  console.error(`nada livre para "${busca}"`);
  process.exit(1);
}
const ii = escolhida.imageinfo[0];
const img = Buffer.from(await (await fetch(ii.thumburl ?? ii.url, { headers: UA })).arrayBuffer());
writeFileSync(destino, img);
const autor = (ii.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim();
writeFileSync(destino.replace(/\.\w+$/, '.txt'), `${escolhida.title}\n${ii.descriptionurl}\nLicença: ${ii.extmetadata?.LicenseShortName?.value}\nAutor: ${autor}\n`);
console.log(`ok ${destino} ← ${escolhida.title} (${ii.extmetadata?.LicenseShortName?.value})`);
