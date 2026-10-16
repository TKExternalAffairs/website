import QRCode from "qrcode";
import path from "node:path";
import { atomicWrite } from "./state-store.mjs";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export async function exportStaffQR(catalog, origin, directory) {
  const cards = [];
  for (const game of catalog.games) {
    const url = new URL("/staff/congestion/", origin);
    url.searchParams.set("game", game.id);
    const svg = await QRCode.toString(url.href, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      width: 240,
    });
    cards.push(
      `<article><h2>${escape(game.name)}</h2>${svg}<p>${escape(game.id)}</p><a href="${escape(url.href)}">${escape(url.href)}</a></article>`,
    );
  }
  const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>縁日スタッフ用QR</title><style>body{font-family:sans-serif;margin:32px;color:#111}h1{font-size:24px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article{break-inside:avoid;border:1px solid #999;text-align:center;padding:16px}svg{width:220px;max-width:100%;height:auto}h2{font-size:20px;margin:8px}p,a{font-size:12px;overflow-wrap:anywhere}a{display:block;color:#111}@page{size:A4;margin:12mm}@media print{body{margin:0}}@media(max-width:500px){.cards{grid-template-columns:1fr}}</style><h1>縁日班・混雑更新 スタッフ用QR</h1><p>${catalog.demo ? "デモ用です。このPCでの操作体験専用URLです。会場用として配布しないでください。" : "会場Wi-Fiに接続して読み取ってください。ゲームIDは操作対象の指定です。権限を制限するものではありません。"}</p><p>イベント: ${escape(catalog.event_id)} ／ ${escape(catalog.environment)} ／ PC: ${escape(origin)}</p><div class="cards">${cards.join("")}</div></html>`;
  const filename = path.join(directory, "staff-qr.html");
  await atomicWrite(filename, html);
  return filename;
}
