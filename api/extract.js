export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { b64, mediaType, isPDF } = req.body;
  if (!b64) return res.status(400).json({ error: 'No file data' });

  const prompt = `Du bist ein Experte fuer Immobilien-Exposees. Analysiere dieses Dokument und extrahiere ALLE Informationen. Antworte NUR mit einem validen JSON-Objekt ohne Markdown.

JSON-Format:
{
  "typ": "Objektart (Wohnung/Einfamilienhaus/Mehrfamilienhaus etc.)",
  "ref": "Referenznummer falls vorhanden",
  "titel": "Haupttitel / Ueberschrift des Objekts",
  "sub": "Untertitel oder kurze Beschreibung",
  "adr": "Vollstaendige Adresse",
  "fl": "Wohnflaeche in m2 (nur Zahl)",
  "gr": "Grundstuecksflaeche in m2 (nur Zahl)",
  "zi": "Anzahl Zimmer oder Einheiten",
  "bj": "Baujahr",
  "hz": "Heizungsart",
  "vf": "Verfuegbarkeit",
  "zustand": "Zustand des Objekts",
  "au": "Aussenanlage und Besonderheiten",
  "empf": "Name des Eigentuemers / Empfaengers",
  "footref": "Kurzer Objektname fuer Footer (z.B. MFH Falkenhagen)",
  "letter": "Text des Anschreibens falls vorhanden",
  "quote": "Zitat oder Kernsatz falls vorhanden",
  "descTitle": "Titel der Beschreibungsseite",
  "desc": "Vollstaendiger Beschreibungstext",
  "lageTitle": "Titel der Lageseite",
  "lage": "Vollstaendiger Lagetext",
  "lageTags": "Lage-Tags getrennt durch | (z.B. Lage ruhig|Berlin 70km)",
  "ep": "Empfohlener Kaufpreis / Angebotspreis",
  "ko": "Preis-Korridor falls vorhanden",
  "fakt": "Faktor / Multiplikator falls vorhanden",
  "strat": "Verkaufsstrategie",
  "kz1": "Erste Kennzahl (z.B. 832 EUR)",
  "kz1l": "Label der ersten Kennzahl",
  "kz2": "Zweite Kennzahl",
  "kz2l": "Label der zweiten Kennzahl",
  "kz3": "Dritte Kennzahl",
  "kz3l": "Label der dritten Kennzahl",
  "wert": "Wertbetreiber-Text",
  "disc": "Disclaimer/Hinweis-Text",
  "hl": [
    {"t": "Highlight Titel", "d": "Highlight Detail"},
    {"t": "Highlight Titel", "d": "Highlight Detail"}
  ],
  "trows": [
    {"p": "Kaufpreis", "f": "Faktor", "r": "Rendite"}
  ]
}

Wenn eine Information nicht vorhanden ist, lasse das Feld leer (""). Extrahiere so viel wie moeglich.`;

  try {
    const content = isPDF
      ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }, { type: 'text', text: prompt }]
      : [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } }, { type: 'text', text: prompt }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
