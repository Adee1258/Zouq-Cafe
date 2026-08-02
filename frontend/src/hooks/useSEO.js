/**
 * useSEO — extreme-level SEO hook for Zouq Cafe
 *
 * Sets document.title + all critical <head> meta tags on every route change.
 * Works without any external library (no react-helmet needed).
 *
 * Usage:
 *   useSEO({ title, description, keywords, canonical, ogImage, schema })
 */
import { useEffect } from 'react';

// ── Defaults (fallback for every page) ───────────────────────────────────────
const DEFAULTS = {
  title:       'Zouq Cafe Buch Villas Multan | BBQ, Tikka, Seekh Kabab & Food Delivery',
  description: 'Zouq Cafe – Multan ka best BBQ restaurant in Buch Villas. Fresh tikka, seekh kabab, BBQ platter, chicken BBQ, burgers, shawarma & drinks. Online order karo, fast delivery!',
  keywords:    'BBQ Buch Villas Multan, tikka Multan, seekh kabab Multan, Zouq Cafe BBQ, best BBQ restaurant Multan, chicken tikka Multan, BBQ delivery Buch Villas, food delivery Multan',
  canonical:   'https://zouqcafe.com/',
  ogImage:     'https://zouqcafe.com/og-image.jpg',
  ogType:      'restaurant',
};

// ── Helper: upsert a <meta> tag by attribute selector ────────────────────────
function setMeta(selector, attrName, attrValue, contentValue) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contentValue);
}

// ── Helper: upsert <link rel="canonical"> ────────────────────────────────────
function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

// ── Helper: upsert a JSON-LD <script> tag by id ──────────────────────────────
function setJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('id', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data, null, 2);
}

function removeJsonLd(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── Main hook ─────────────────────────────────────────────────────────────────
const useSEO = ({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType,
  schema,        // optional: single JSON-LD object for the current page
  schemaId,      // id for the dynamic JSON-LD script tag (default: 'page-schema')
} = {}) => {
  const resolvedTitle       = title       || DEFAULTS.title;
  const resolvedDescription = description || DEFAULTS.description;
  const resolvedKeywords    = keywords    || DEFAULTS.keywords;
  const resolvedCanonical   = canonical   || DEFAULTS.canonical;
  const resolvedOgImage     = ogImage     || DEFAULTS.ogImage;
  const resolvedOgType      = ogType      || DEFAULTS.ogType;
  const resolvedSchemaId    = schemaId    || 'page-schema';

  useEffect(() => {
    // 1. Title
    document.title = resolvedTitle;

    // 2. Standard meta
    setMeta('meta[name="description"]',                'name', 'description',                resolvedDescription);
    setMeta('meta[name="keywords"]',                   'name', 'keywords',                   resolvedKeywords);
    setMeta('meta[name="robots"]',                     'name', 'robots',                     'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

    // 3. Canonical
    setCanonical(resolvedCanonical);

    // 4. Open Graph
    setMeta('meta[property="og:title"]',               'property', 'og:title',               resolvedTitle);
    setMeta('meta[property="og:description"]',         'property', 'og:description',         resolvedDescription);
    setMeta('meta[property="og:url"]',                 'property', 'og:url',                 resolvedCanonical);
    setMeta('meta[property="og:image"]',               'property', 'og:image',               resolvedOgImage);
    setMeta('meta[property="og:image:alt"]',           'property', 'og:image:alt',           resolvedTitle);
    setMeta('meta[property="og:type"]',                'property', 'og:type',                resolvedOgType);
    setMeta('meta[property="og:site_name"]',           'property', 'og:site_name',           'Zouq Cafe');

    // 5. Twitter Card
    setMeta('meta[name="twitter:title"]',              'name', 'twitter:title',              resolvedTitle);
    setMeta('meta[name="twitter:description"]',        'name', 'twitter:description',        resolvedDescription);
    setMeta('meta[name="twitter:image"]',              'name', 'twitter:image',              resolvedOgImage);
    setMeta('meta[name="twitter:image:alt"]',          'name', 'twitter:image:alt',          resolvedTitle);
    setMeta('meta[name="twitter:card"]',               'name', 'twitter:card',               'summary_large_image');

    // 6. Dynamic JSON-LD schema (per-page)
    if (schema) {
      setJsonLd(resolvedSchemaId, schema);
    } else {
      removeJsonLd(resolvedSchemaId);
    }

    // Cleanup: remove dynamic schema on unmount / page change
    return () => {
      removeJsonLd(resolvedSchemaId);
    };
  }, [
    resolvedTitle,
    resolvedDescription,
    resolvedKeywords,
    resolvedCanonical,
    resolvedOgImage,
    resolvedOgType,
    resolvedSchemaId,
    schema,
  ]);
};

export default useSEO;
