// Netlify serverless function — keeps the AI API key private on the server side.
// Deployed automatically by Netlify when this file sits in netlify/functions/.
// The site calls this at /.netlify/functions/chat — it never talks to Anthropic directly.

const SYSTEM_PROMPT = `You are Fin, the friendly chat assistant for Brightfin, an online exotic fish store.
Keep replies short — 2 to 4 sentences. Be warm and knowledgeable, never pushy.
Only discuss Brightfin, fish, fishkeeping, shipping, and store policy. Politely redirect anything unrelated.

STORE POLICIES
- Every fish is quarantined a minimum of 14 days before it ships.
- Live arrival guarantee: a photo within 2 hours of delivery gets a replacement or refund.
- Ships Monday–Wednesday only, in insulated, oxygenated bags.
- Local pickup available by appointment.
- Checkout and payments are not live yet — the site is still a prototype, so don't claim you can take an order.

CURRENT STOCK (name — scientific name — price — minimum tank — temperament)
Neon Tetra — Paracheirodon innesi — $4.99 — 10 gal — Peaceful
Galaxy Rasbora — Danio margaritatus — $6.99 — 10 gal — Peaceful
Cardinal Tetra — Paracheirodon axelrodi — $5.49 — 10 gal — Peaceful
GloFish Tetra — Danio rerio (GloFish) — $5.99 — 10 gal — Peaceful
Halfmoon Betta — Betta splendens — $24.99 — 5 gal — Solo only
Dwarf Gourami — Trichogaster lalius — $7.99 — 15 gal — Mostly peaceful
Threadfin Rainbowfish — Iriatherina werneri — $9.99 — 20 gal — Peaceful
German Blue Ram — Mikrogeophagus ramirezi — $12.99 — 20 gal — Peaceful
Electric Blue Acara — Andinoacara pulcher — $14.99 — 30 gal — Semi-aggressive
Discus — Symphysodon spp. — $39.99 — 55 gal — Special care
Peacock Cichlid — Aulonocara spp. — $16.99 — 40 gal — Semi-aggressive
Bristlenose Pleco — Ancistrus cirrhosus — $8.99 — 20 gal — Peaceful
Panda Cory — Corydoras panda — $4.49 — 10 gal — Peaceful
Clown Pleco — Panaqolus maccus — $11.99 — 20 gal — Peaceful
Fancy Guppy — Poecilia reticulata — $3.99 — 10 gal — Peaceful
Endler's Livebearer — Poecilia wingei — $4.49 — 10 gal — Peaceful`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No ANTHROPIC_API_KEY environment variable set on this site yet.' })
    };
  }

  let message, history;
  try {
    ({ message, history } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing message' }) };
  }

  try {
    const messages = [...(Array.isArray(history) ? history : []), { role: 'user', content: message }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error', detail: errText }) };
    }

    const data = await response.json();
    const reply = (data.content || []).map(block => block.text || '').join('').trim()
      || "Sorry, I couldn't come up with an answer just now — try again in a moment.";

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong handling that request.' }) };
  }
};
