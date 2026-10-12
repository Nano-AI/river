import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile } from 'node:fs/promises';
export async function generateIcons() {
  const svg = await readFile('public/icon.svg', 'utf8');
  for (const size of [192, 512]) {
    await writeFile(`public/icon-${size}.png`, new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
  }
  const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '');
  const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#17634e"/><g transform="translate(51.2 51.2) scale(.8)">${inner}</g></svg>`;
  await writeFile('public/icon-maskable.png', new Resvg(maskable).render().asPng());
}
