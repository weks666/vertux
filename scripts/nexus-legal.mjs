import { readFile, writeFile } from 'node:fs/promises';

// Public legal documents of Vertux Nexus. Each document is authored once as a
// markdown template in nexus/legal/*-template.md; this module fills the
// placeholders, writes the filled markdown next to it and renders the reader
// page. Numbered clauses ("6.5. ...") become paragraphs with stable anchors,
// "- " blocks become lists and "## N." / "## Приложение № N." become sections.

export const LEGAL_DOCUMENTS = Object.freeze([
  {file: 'offer.html', md: 'offer.md', template: 'offer-template.md', label: 'Публичная оферта'},
  {file: 'payment.html', md: 'payment.md', template: 'payment-template.md', label: 'Условия оплаты и возврата'},
  {file: 'privacy.html', md: 'privacy.md', template: 'privacy-template.md', label: 'Политика конфиденциальности'},
  {file: 'consent.html', md: 'consent.md', template: 'consent-template.md', label: 'Согласие на обработку персональных данных'},
]);

const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const inline = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(https?:\/\/[^\s<]*[^\s<.,;)])/g, '<a href="$1">$1</a>')
  .replace(/support@vertux\.online/g, '<a href="mailto:support@vertux.online">support@vertux.online</a>');

function sectionId(title) {
  const section = title.match(/^(\d+)\./);
  if (section) return 'section-' + section[1];
  const appendix = title.match(/^Приложение № (\d+)/);
  if (appendix) return 'appendix-' + appendix[1];
  throw new Error('Legal section needs a number: ' + title);
}

export function renderLegal(md) {
  const blocks = md.trim().split(/\r?\n\r?\n/);
  const toc = [];
  let section = 'Документ';
  const html = blocks.map((block, index) => {
    if (block.startsWith('# ')) return '<h1>' + inline(block.slice(2)) + '</h1>';
    if (block.startsWith('## ')) {
      const title = block.slice(3), id = sectionId(title);
      if (toc.some(t => t.id === id)) throw new Error('Duplicate legal section ' + id);
      toc.push({id, title}); section = title.replace(/^\d+\.\s*/, '');
      return '<h2 id="' + id + '">' + inline(title) + '</h2>';
    }
    if (block.startsWith('### ')) return '<h3>' + inline(block.slice(4)) + '</h3>';
    if (block.startsWith('| ')) {
      const rows = block.split('\n').filter((_, i) => i !== 1).map(row => row.split('|').slice(1, -1).map(s => s.trim()));
      if (rows.some(row => row.length !== rows[0].length)) throw new Error('Uneven legal table in ' + section);
      return '<div class="legal-table" role="region" aria-label="' + esc(section) + '" tabindex="0"><table><caption class="nx-visually-hidden">' + esc(section) + '</caption><thead><tr>'
        + rows[0].map(c => '<th scope="col">' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'
        + rows.slice(1).map(row => '<tr>' + row.map((c, i) => i === 0 ? '<th scope="row">' + inline(c) + '</th>' : '<td>' + inline(c) + '</td>').join('') + '</tr>').join('')
        + '</tbody></table></div>';
    }
    const lines = block.split(/\r?\n/);
    if (lines.every(line => line.startsWith('- '))) return '<ul class="legal-list">' + lines.map(line => '<li>' + inline(line.slice(2)) + '</li>').join('') + '</ul>';
    if (lines.length > 1) throw new Error('Legal paragraph must be a single line: ' + lines[0].slice(0, 60));
    if (index === 1) return '<p class="legal-revision">' + inline(block) + '</p>';
    const clause = block.match(/^(\d+)\.(\d+)\.\s/);
    return '<p' + (clause ? ' id="p-' + clause[1] + '-' + clause[2] + '"' : '') + '>' + inline(block) + '</p>';
  }).join('\n');
  const title = (blocks[0] || '').replace(/^# /, '');
  return {html, toc, title};
}

function related(current) {
  return '<nav class="legal-related" aria-label="Юридические документы">' + LEGAL_DOCUMENTS
    .map(doc => doc.file === current ? '<span aria-current="page">' + doc.label + '</span>' : '<a href="' + doc.file + '">' + doc.label + '</a>').join('') + '</nav>';
}

// values: placeholder name -> text. Every placeholder in a template must be filled.
export async function buildLegalDocuments(values, {root = new URL('../nexus/', import.meta.url)} = {}) {
  for (const doc of LEGAL_DOCUMENTS) {
    let md = await readFile(new URL('legal/' + doc.template, root), 'utf8');
    for (const [key, value] of Object.entries(values)) md = md.replaceAll('{{' + key + '}}', value);
    const left = md.match(/\{\{[A-Z_]+\}\}/);
    if (left) throw new Error(doc.template + ' has an unfilled placeholder ' + left[0]);
    const {html, toc, title} = renderLegal(md);
    const nav = '<nav class="legal-toc" aria-label="На этой странице"><strong>На этой странице</strong><ol>' + toc.map(t => '<li><a href="#' + t.id + '">' + esc(t.title) + '</a></li>').join('') + '</ol></nav>';
    // The table of contents goes right before the first section, after any preamble.
    const content = html.replace('<h2 ', () => nav + '\n<h2 ') + '\n' + related(doc.file);
    const htmlPath = new URL(doc.file, root);
    let page = await readFile(htmlPath, 'utf8');
    if (!/<main class="legal-document"[\s\S]*?<\/main>/.test(page)) throw new Error(doc.file + ': legal reader not found');
    page = page.replace(/<main class="legal-document"[\s\S]*?<\/main>/, () => '<main class="legal-document" id="content" lang="ru">' + content + '</main>')
      .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + ' — Vertux Nexus</title>');
    await writeFile(htmlPath, page);
    await writeFile(new URL('legal/' + doc.md, root), md);
  }
}
