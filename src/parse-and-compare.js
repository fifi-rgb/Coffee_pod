const state = $getWorkflowStaticData('global');
state.products = state.products || {};

function toNumber(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  let normalized = String(value).trim()
    .replace(/^£\s*/, '')
    .replace(/\s*GBP$/i, '')
    .replace(/\s+/g, '');
  if (!/^\d[\d,.]*$/.test(normalized)) return null;

  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');

  if (comma !== -1 && dot !== -1) {
    if (comma > dot) {
      if (!/^\d{1,3}(?:\.\d{3})+,\d+$/.test(normalized)) return null;
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      if (!/^\d{1,3}(?:,\d{3})+\.\d+$/.test(normalized)) return null;
      normalized = normalized.replace(/,/g, '');
    }
  } else if (comma !== -1) {
    const commas = (normalized.match(/,/g) || []).length;
    const digitsAfterComma = normalized.length - comma - 1;
    if (commas > 1) {
      if (!/^\d{1,3}(?:,\d{3})+$/.test(normalized)) return null;
      normalized = normalized.replace(/,/g, '');
    } else if (digitsAfterComma > 0 && digitsAfterComma <= 2) {
      normalized = normalized.replace(',', '.');
    } else if (digitsAfterComma === 3 && /^\d{1,3},\d{3}$/.test(normalized)) {
      normalized = normalized.replace(',', '');
    } else {
      return null;
    }
  } else if ((normalized.match(/\./g) || []).length > 1) {
    if (!/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) return null;
    normalized = normalized.replace(/\./g, '');
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function priceFromJsonLd(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const price = priceFromJsonLd(entry);
      if (price !== null) return price;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;

  if (value.priceSpecification && typeof value.priceSpecification === 'object') {
    const specificationPrice = toNumber(value.priceSpecification.price);
    if (specificationPrice !== null) return specificationPrice;
  }

  const offers = value.offers;
  if (offers) {
    const offerPrice = priceFromJsonLd(offers);
    if (offerPrice !== null) return offerPrice;
  }

  for (const key of ['price', 'lowPrice']) {
    const price = toNumber(value[key]);
    if (price !== null) return price;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'offers' || key === 'priceSpecification') continue;
    const price = priceFromJsonLd(child);
    if (price !== null) return price;
  }

  return null;
}

function getAttribute(tag, attributeName) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function extractPrice(html, customRegex) {
  if (typeof html !== 'string') return null;

  if (customRegex) {
    try {
      const match = html.match(new RegExp(customRegex, 'i'));
      const customPrice = match && match[1] ? toNumber(match[1]) : null;
      if (customPrice !== null) return customPrice;
    } catch (error) {
      console.log(`Invalid priceRegex: ${error.message}`);
    }
  }

  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    const type = getAttribute(scriptMatch[1], 'type');
    if (!type || type.toLowerCase() !== 'application/ld+json') continue;
    try {
      const parsed = JSON.parse(scriptMatch[2]);
      const jsonLdPrice = priceFromJsonLd(parsed);
      if (jsonLdPrice !== null) return jsonLdPrice;
    } catch (error) {
      console.log(`Could not parse JSON-LD price data: ${error.message}`);
    }
  }

  const metaPattern = /<meta\b[^>]*>/gi;
  let metaMatch;
  while ((metaMatch = metaPattern.exec(html)) !== null) {
    const tag = metaMatch[0];
    const itemprop = getAttribute(tag, 'itemprop');
    const property = getAttribute(tag, 'property');
    const isPriceMeta = (itemprop && itemprop.toLowerCase() === 'price')
      || (property && ['product:price:amount', 'og:price:amount'].includes(property.toLowerCase()));
    if (!isPriceMeta) continue;

    const metaPrice = toNumber(getAttribute(tag, 'content'));
    if (metaPrice !== null) return metaPrice;
  }

  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const alerts = [];

for (let i = 0; i < items.length; i++) {
  const product = $('Product List').itemMatching(i).json;
  const html = items[i] && items[i].json ? items[i].json.html : null;
  const price = extractPrice(html, product.priceRegex);

  if (price === null) {
    console.log(`Warning: no valid price found for ${product.name} (${product.url}); skipping product.`);
    continue;
  }

  const productState = state.products[product.url] || {
    lowest: null,
    last: null,
    lastAlerted: null,
    checkedAt: null,
  };
  const lowestBefore = toNumber(productState.lowest);
  const lastBefore = toNumber(productState.last);
  const lastAlerted = toNumber(productState.lastAlerted);
  const belowTarget = price <= product.targetPrice;
  const newLow = lowestBefore !== null && price < lowestBefore;
  const dropped = lastBefore !== null && price < lastBefore;

  if (lastAlerted !== null && price > lastAlerted) {
    productState.lastAlerted = null;
  }
  const alreadyAlerted = productState.lastAlerted !== null
    && productState.lastAlerted !== undefined
    && price >= productState.lastAlerted;

  if ((belowTarget || newLow) && !alreadyAlerted) {
    const messageLines = [
      `☕ <b>${escapeHtml(product.name)}</b> / 🏪 ${escapeHtml(product.retailer)}`,
      '',
      `💰 Now: <b>£${price.toFixed(2)}</b>${dropped ? ` (was £${lastBefore.toFixed(2)})` : ''}`,
      `🥤 Per drink: £${(price / product.drinksPerPack).toFixed(2)}`,
      `🎯 Your target: £${Number(product.targetPrice).toFixed(2)}`,
      lowestBefore !== null ? `📉 Lowest seen before: £${lowestBefore.toFixed(2)}` : null,
      newLow ? '🔥 <b>New lowest price!</b>' : null,
      '',
      `<a href="${escapeHtmlAttribute(product.url)}">👉 Buy now</a>`,
    ].filter(line => line !== null);

    alerts.push({
      json: {
        message: messageLines.join('\n'),
        product,
        price,
      },
    });
    productState.lastAlerted = price;
  }

  productState.last = price;
  productState.lowest = lowestBefore === null ? price : Math.min(lowestBefore, price);
  productState.checkedAt = new Date().toISOString();
  state.products[product.url] = productState;
}

return alerts;
