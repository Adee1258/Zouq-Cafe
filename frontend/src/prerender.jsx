/**
 * prerender.jsx
 *
 * Called by vite-prerender-plugin at build time.
 * Injects static SEO HTML + per-route head tags so Google
 * indexes real content instead of an empty <div id="root">.
 *
 * NOTE: We do NOT use renderToString / StaticRouter here because
 * react-router-dom v7's /server export is Node-only and
 * vite-prerender-plugin builds under browser conditions.
 * Instead we inject SEO-rich static HTML + let the React app
 * hydrate normally on the client.
 */

// ── Per-route SEO ─────────────────────────────────────────────────────────────
const ROUTE_SEO = {
  '/': {
    title: 'Zouq Cafe Buch Villas Multan | BBQ, Tikka, Seekh Kabab & Food Delivery',
    description:
      'Zouq Cafe – Multan ka best BBQ restaurant in Buch Villas. Fresh tikka, seekh kabab, BBQ platter, chicken BBQ, burgers, shawarma aur drinks. Online order karo, fast delivery!',
    keywords:
      'Zouq Cafe, BBQ Buch Villas Multan, tikka Multan, seekh kabab Multan, best BBQ restaurant Multan, Buch Villas restaurant, food delivery Multan, BBQ delivery Buch Villas',
  },
  '/menu': {
    title: 'Menu | Zouq Cafe Buch Villas — BBQ Tikka, Seekh Kabab, Burgers & Drinks',
    description:
      'Full menu at Zouq Cafe Buch Villas Multan. Chicken tikka, beef tikka, seekh kabab, BBQ platter, chapli kabab, boti kabab, burgers, shawarma & drinks. Order online!',
    keywords:
      'Zouq Cafe menu, BBQ menu Multan, tikka menu Buch Villas, seekh kabab Multan, BBQ platter Multan, chicken tikka Multan, chapli kabab Multan, burger menu, shawarma Multan',
  },
  '/deals': {
    title: 'Hot Deals | Zouq Cafe Buch Villas — BBQ Combos & Tikka Bundles Multan',
    description:
      'Best BBQ deals in Buch Villas Multan! Tikka combo, seekh kabab bundle, BBQ family platter at unbeatable prices. Order online from Zouq Cafe!',
    keywords:
      'BBQ deals Multan, tikka combo Buch Villas, seekh kabab bundle Multan, BBQ bundle Multan, food deals Buch Villas, combo offer Multan',
  },
  '/spin': {
    title: 'Spin & Win | Zouq Cafe Buch Villas Multan — Win Free BBQ & Prizes',
    description:
      'Spin the wheel at Zouq Cafe Buch Villas Multan and win free BBQ, tikka, discounts and exciting prizes every day! Login and spin to win.',
    keywords:
      'spin and win Multan, free BBQ Zouq Cafe, win tikka Buch Villas, daily spin Multan restaurant, Zouq Cafe prizes',
  },
  '/lucky-draw': {
    title: 'Lucky Draw | Zouq Cafe Buch Villas Multan — Win Big BBQ Prizes',
    description:
      'Join the Zouq Cafe Lucky Draw in Buch Villas Multan! Order BBQ, tikka or any food, qualify and win amazing prizes.',
    keywords:
      'lucky draw Multan, BBQ prize lucky draw, Zouq Cafe lucky draw Buch Villas, win prizes Multan restaurant',
  },
  '/login': {
    title: 'Login | Zouq Cafe Buch Villas Multan',
    description:
      'Login to Zouq Cafe and order fresh BBQ tikka, seekh kabab and more from Buch Villas Multan. Fast delivery at your doorstep.',
    keywords: 'Zouq Cafe login, order BBQ Multan, food delivery Buch Villas',
  },
  '/signup': {
    title: 'Sign Up | Zouq Cafe Buch Villas Multan — Free Account',
    description:
      'Create a free account at Zouq Cafe Buch Villas Multan. Get daily spin rewards, lucky draw entries and order the best BBQ and fast food online.',
    keywords: 'Zouq Cafe signup, BBQ order account Multan, Buch Villas food delivery account',
  },
};

// ── Static visible content per route (Google indexes this) ────────────────────
const STATIC_CONTENT = {
  '/': `<div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" aria-hidden="true">
<h1>Zouq Cafe — Best BBQ Restaurant in Buch Villas, Multan</h1>
<p>Zouq Cafe Multan ka sabse behtareen BBQ restaurant hai, Manik Block, Buch Executive Villas, Bosan Road mein located. Hum serve karte hain fresh charcoal-grilled tikka, seekh kabab, BBQ platters, chicken BBQ, boti kabab, chapli kabab, burgers, shawarma aur drinks. Online order karo, fast delivery ghar tak.</p>
<h2>Our BBQ Specialties</h2>
<ul>
<li>Chicken Tikka — Fresh marinated charcoal-grilled chicken tikka</li>
<li>Beef Tikka — Tender beef tikka grilled on charcoal</li>
<li>Seekh Kabab — Juicy spiced seekh kabab</li>
<li>BBQ Platter — Full BBQ platter with tikka, seekh kabab and naan</li>
<li>Chapli Kabab — Crispy Peshwari-style chapli kabab</li>
<li>Boti Kabab — Juicy boti kabab in traditional spices</li>
<li>Chicken BBQ Half and Full</li>
</ul>
<h2>Fast Food</h2>
<ul><li>Zinger Burger</li><li>Beef Burger</li><li>Shawarma</li><li>Fries</li></ul>
<h2>Location</h2>
<p>Manik Block, Buch Executive Villas, Phase 2, Bosan Road, Multan, Punjab, Pakistan. Phone: 0300-8356059. Open 7 days: 6 AM to 2 AM.</p>
</div>`,

  '/menu': `<div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" aria-hidden="true">
<h1>Zouq Cafe Full Menu — BBQ, Tikka, Seekh Kabab in Buch Villas Multan</h1>
<h2>BBQ Menu — Zouq Cafe Multan</h2>
<ul>
<li>Chicken Tikka</li><li>Beef Tikka</li><li>Seekh Kabab</li>
<li>BBQ Platter</li><li>Chapli Kabab</li><li>Boti Kabab</li>
<li>Chicken BBQ Half</li><li>Chicken BBQ Full</li>
</ul>
<h2>Fast Food Menu</h2>
<ul><li>Zinger Burger</li><li>Beef Burger</li><li>Shawarma</li><li>Fries</li><li>Wrap</li></ul>
<h2>Drinks Menu</h2>
<ul><li>Cold Drinks</li><li>Fresh Juices</li><li>Shakes</li><li>Lemonade</li></ul>
<p>Order online at zouqcafe.com for fast delivery in Buch Villas Multan.</p>
</div>`,

  '/deals': `<div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" aria-hidden="true">
<h1>Hot Deals — BBQ Combos and Tikka Bundles at Zouq Cafe Buch Villas Multan</h1>
<p>Best BBQ deals in Buch Villas Multan — tikka combos, seekh kabab bundles, family BBQ platters at unbeatable prices from Zouq Cafe.</p>
<h2>Popular Deals</h2>
<ul>
<li>BBQ Family Deal — Tikka + Seekh Kabab + Naan + Drink</li>
<li>Tikka Combo — Chicken Tikka + Fries + Drink</li>
<li>Burger + BBQ Bundle</li>
<li>Student Deal — Burger or Shawarma + Drink</li>
</ul>
</div>`,
};

// ── Main export ────────────────────────────────────────────────────────────────
export async function prerender(data) {
  const url = data.url || '/';
  const seo = ROUTE_SEO[url] || ROUTE_SEO['/'];
  const staticContent = STATIC_CONTENT[url] || '';

  return {
    // Static SEO HTML injected into #root before React hydrates
    html: staticContent,

    // Tell plugin which routes to prerender
    links: new Set(['/menu', '/deals', '/spin', '/lucky-draw', '/login', '/signup']),

    // Per-route <head> injection
    head: {
      lang: 'en',
      title: seo.title,
      elements: new Set([
        { type: 'meta', props: { name: 'description',         content: seo.description } },
        { type: 'meta', props: { name: 'keywords',            content: seo.keywords } },
        { type: 'meta', props: { property: 'og:title',        content: seo.title } },
        { type: 'meta', props: { property: 'og:description',  content: seo.description } },
        { type: 'meta', props: { property: 'og:url',          content: `https://zouqcafe.com${url}` } },
        { type: 'meta', props: { name: 'twitter:title',       content: seo.title } },
        { type: 'meta', props: { name: 'twitter:description', content: seo.description } },
        { type: 'link', props: { rel: 'canonical',            href: `https://zouqcafe.com${url}` } },
      ]),
    },
  };
}
