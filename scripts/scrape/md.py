"""In-page JS helpers: parse fetched HTML and serialize to the raw-file shapes.

Each constant is a COMPLETE function expression for page.evaluate(fn, arg):
arg is a list [html, baseUrl, ...extra]. fbref hides many stat tables inside
HTML comments, so every parse uncomments the document first.
"""

HELPERS_JS = r"""
const parseDoc = (html) => {
    // fbref wraps most stat tables in HTML comments; expose them all.
    html = html.replace(/<!--/g, '').replace(/-->/g, '');
    return new DOMParser().parseFromString(html, 'text/html');
};
const absUrl = (u, base) => {
    if (!u) return '';
    try { return new URL(u, base).href; } catch (e) { return u; }
};
const collapse = (s) => (s || '').replace(/\s+/g, ' ').trim();
const escCell = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const inlineMd = (node, base) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (['script','style','noscript','template','iframe','svg','form','button','select'].includes(tag)) return '';
    if (tag === 'br') return '\n';
    const kids = Array.from(node.childNodes).map(k => inlineMd(k, base)).join('');
    if (tag === 'a') {
        const href = node.getAttribute('href');
        const text = kids.trim();
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return text;
        if (!text) return '';
        return '[' + text + '](' + absUrl(href, base) + ')';
    }
    if (tag === 'img') {
        const src = node.getAttribute('src');
        if (!src) return '';
        return '![' + (node.getAttribute('alt') || '') + '](' + absUrl(src, base) + ')';
    }
    if (tag === 'b' || tag === 'strong') {
        const t = kids.trim();
        return t ? '**' + t + '**' : '';
    }
    if (tag === 'i' || tag === 'em') {
        const t = kids.trim();
        return t ? '_' + t + '_' : '';
    }
    return kids;
};

const tableMd = (table, base) => {
    const lines = [];
    const headRows = table.tHead ? Array.from(table.tHead.rows) : [];
    let bodyRows = [];
    for (const tb of table.tBodies) bodyRows = bodyRows.concat(Array.from(tb.rows));
    let header = headRows.length ? headRows[headRows.length - 1] : null;
    if (!header && bodyRows.length && bodyRows[0].querySelector('th')) header = bodyRows.shift();
    const rowToCells = (tr) => Array.from(tr.cells).map(td => escCell(collapse(inlineMd(td, base))));
    if (header) {
        const cells = rowToCells(header);
        lines.push('| ' + cells.join(' | ') + ' |');
        lines.push('|' + cells.map(() => ' --- ').join('|') + '|');
    }
    for (const tr of bodyRows) {
        const cells = rowToCells(tr);
        if (!cells.length) continue;
        lines.push('| ' + cells.join(' | ') + ' |');
    }
    return lines.join('\n');
};

const blockMd = (node, base, out) => {
    if (node.nodeType === 3) {
        const t = collapse(node.textContent);
        if (t) out.push(t);
        return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (['script','style','noscript','template','iframe','svg'].includes(tag)) return;
    if (/^h[1-6]$/.test(tag)) {
        const t = collapse(inlineMd(node, base));
        if (t) out.push('#'.repeat(+tag[1]) + ' ' + t);
        return;
    }
    if (tag === 'table') { out.push(tableMd(node, base)); return; }
    if (tag === 'ul' || tag === 'ol') {
        for (const li of node.children) {
            if (li.tagName.toLowerCase() !== 'li') continue;
            const t = collapse(inlineMd(li, base));
            if (t) out.push('- ' + t);
        }
        return;
    }
    if (['p','section','article','header','footer','nav','aside','hr','pre','blockquote','form'].includes(tag)) {
        const t = tag === 'hr' ? '---' : collapse(inlineMd(node, base));
        if (t) out.push(t);
        return;
    }
    let inlineOnly = true;
    for (const k of node.children) {
        const kt = k.tagName.toLowerCase();
        if (/^(div|p|table|ul|ol|section|article|h[1-6]|header|footer|nav|aside|pre|blockquote)$/.test(kt)) { inlineOnly = false; break; }
    }
    if (inlineOnly) {
        const t = collapse(inlineMd(node, base));
        if (t) out.push(t);
    } else {
        for (const k of node.childNodes) blockMd(k, base, out);
    }
};

const toMarkdown = (root, base) => {
    const out = [];
    for (const k of root.childNodes) blockMd(k, base, out);
    return out.join('\n\n') + '\n';
};
"""

# Serialize a region (selector) or whole body to markdown.
# arg = [html, base, selectorOrNull]
EXTRACT_MD_JS = "(arg) => {\n" + HELPERS_JS + r"""
    const [html, base, selector] = arg;
    const doc = parseDoc(html);
    const root = selector ? doc.querySelector(selector) : doc.body;
    if (!root) return null;
    return toMarkdown(root, base);
}
"""

# Serialize several tables by selector -> {key: markdown}
# arg = [html, base, {key: selector}]
EXTRACT_TABLES_MD_JS = "(arg) => {\n" + HELPERS_JS + r"""
    const [html, base, idMap] = arg;
    const doc = parseDoc(html);
    const out = {};
    for (const [key, sel] of Object.entries(idMap)) {
        const t = doc.querySelector(sel);
        out[key] = t ? tableMd(t, base) + '\n' : null;
    }
    return out;
}
"""

# Structured matchlog tables -> [{label, columns, rows}]
# arg = [html, base]
EXTRACT_MATCHLOG_JS = "(arg) => {\n" + HELPERS_JS + r"""
    const [html, base] = arg;
    const doc = parseDoc(html);
    const out = [];
    for (const id of ['matchlogs_for', 'matchlogs_against']) {
        const t = doc.querySelector('table#' + id);
        if (!t) continue;
        // label: the section heading just above the table container, else
        // derive "For {Club}"/"Against {Club}" from the page <h1>.
        let label = '';
        let box = t.closest('.table_container') || t.parentElement;
        if (box) {
            let e = box.previousElementSibling;
            while (e) {
                const h = e.matches && e.matches('h2') ? e : (e.querySelector && e.querySelector('h2'));
                if (h) { label = collapse(h.textContent); break; }
                e = e.previousElementSibling;
            }
            if (!label) {
                const h = box.querySelector('h2');
                if (h) label = collapse(h.textContent);
            }
        }
        if (!label || !/^(For|Against)\b/.test(label)) {
            let club = '';
            const h1 = doc.querySelector('#meta h1, h1');
            if (h1) {
                const m = collapse(h1.textContent).match(/^\d{4}-\d{4}\s+(.+?)\s+(Match Logs|Scores)/);
                club = m ? m[1] : collapse(h1.textContent);
            }
            label = (id === 'matchlogs_for' ? 'For ' : 'Against ') + club;
        }
        const headTr = t.tHead && t.tHead.rows.length ? t.tHead.rows[t.tHead.rows.length - 1] : null;
        const columns = headTr ? Array.from(headTr.cells).map(c => collapse(c.textContent)) : [];
        const rows = [];
        for (const tb of t.tBodies) {
            for (const tr of tb.rows) {
                const cells = Array.from(tr.cells).map(c => collapse(c.textContent));
                if (cells.length === columns.length && cells.join('')) rows.push(cells);
            }
        }
        out.push({label, columns, rows});
    }
    return out;
}
"""

# Squads listed inside the league standings table -> [{name, id, url}]
# arg = html string
EXTRACT_SQUADS_JS = "(arg) => {\n" + HELPERS_JS + r"""
    const html = arg;
    const doc = parseDoc(html);
    let table = null;
    for (const t of doc.querySelectorAll('table')) {
        const h = t.tHead ? collapse(t.tHead.textContent) : '';
        if (h.includes('Squad') && (h.includes('Pts') || h.includes('MP'))) { table = t; break; }
    }
    if (!table) return [];
    const out = [];
    const seen = new Set();
    for (const a of table.querySelectorAll('a[href*="/en/squads/"]')) {
        const m = (a.getAttribute('href') || '').match(/\/en\/squads\/([0-9a-f]+)\//);
        if (!m || seen.has(m[1])) continue;
        seen.add(m[1]);
        const href = a.getAttribute('href');
        out.push({name: collapse(a.textContent), id: m[1],
            url: 'https://fbref.com' + (href.startsWith('/') ? href : '/' + href)});
    }
    return out;
}
"""

# keepersadv league page -> {markdown_squads, markdown_players}
# two tables; pick by header signature. arg = [html, base]
KEEPERADV_JS = "(arg) => {\n" + HELPERS_JS + r"""
    const [html, base] = arg;
    const doc = parseDoc(html);
    let squads = null, players = null;
    for (const t of doc.querySelectorAll('table')) {
        const first = (t.tHead && t.tHead.rows.length
            ? collapse(t.tHead.rows[t.tHead.rows.length - 1].cells[0].textContent) : '');
        const hdr = (t.tHead ? collapse(t.tHead.textContent) : '');
        if (first === 'Squad' && !squads) squads = tableMd(t, base) + '\n';
        else if ((first === 'Rk' || first === 'Player') && !players && hdr.includes('Squad')) players = tableMd(t, base) + '\n';
    }
    return {markdown_squads: squads, markdown_players: players};
}
"""
