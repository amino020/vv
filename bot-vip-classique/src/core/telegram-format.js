function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function restorePairedTag(html, sourceTag, targetTag = sourceTag) {
  const open = `&lt;${sourceTag}&gt;`;
  const close = `&lt;/${sourceTag}&gt;`;
  return html.split(open).map((part, index) => {
    if (index === 0) return part;
    const closingIndex = part.indexOf(close);
    if (closingIndex < 0) return `${open}${part}`;
    return `<${targetTag}>${part.slice(0, closingIndex)}</${targetTag}>${part.slice(closingIndex + close.length)}`;
  }).join('');
}

export function telegramHtml(value, maxLength = 4_096) {
  let html = escapeHtml(String(value || '').slice(0, maxLength));
  const tags = [
    ['b', 'b'], ['strong', 'b'], ['i', 'i'], ['em', 'i'], ['u', 'u'], ['ins', 'u'],
    ['s', 's'], ['strike', 's'], ['del', 's'], ['tg-spoiler', 'tg-spoiler'],
  ];
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [source, target] of tags) html = restorePairedTag(html, source, target);
  }
  html = html.replace(
    /&lt;a href=&quot;([^"<>]+)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/gi,
    (match, encodedUrl, label) => {
      const decodedUrl = encodedUrl.replace(/&amp;/g, '&');
      try {
        const url = new URL(decodedUrl);
        if (!['https:', 'tg:'].includes(url.protocol)) return match;
        const safeUrl = escapeHtml(url.toString());
        return `<a href="${safeUrl}">${label}</a>`;
      } catch {
        return match;
      }
    },
  );
  html = html.replace(
    /&lt;tg-emoji emoji-id=&quot;(\d{5,30})&quot;&gt;([\s\S]*?)&lt;\/tg-emoji&gt;/gi,
    '<tg-emoji emoji-id="$1">$2</tg-emoji>',
  );
  return html;
}
