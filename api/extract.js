export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { textContent, b64, mediaType, isPDF } = req.body;

  const prompt = `Du bist ein Experte fuer Immobilien-Exposees. Extrahiere ALLE Informationen und antworte NUR mit validem JSON ohne Markdown.

JSON-Format (leere Strings fuer fehlende Werte):
{
  "typ": "Objektart",
  "ref": "Referenznummer",
  "titel": "Haupttitel",
  "sub": "Untertitel",
  "adr": "Vollstaendige Adresse",
  "fl": "Wohnflaeche Zahl",
  "gr": "Grundstueck Zahl",
  "zi": "Zimmer oder Einheiten",
  "bj": "Baujahr",
  "hz": "Heizung",
  "vf": "Verfuegbarkeit",
  "zustand": "Zustand",
  "au": "Aussenanlage Besonderheiten",
  "empf": "Name Eigentuemer Empfaenger",
  "footref": "Kurzer Objektname fuer Footer",
  "letter": "Vollstaendiger Anschreiben Text",
  "quote": "Zitat oder Kernsatz",
  "descTitle": "Titel Beschreibungsseite",
  "desc": "Vollstaendiger Beschreibungstext",
  "lageTitle": "Titel Lageseite",
  "lage": "Vollstaendiger Lagetext",
  "lageTags": "Tags getrennt durch Pipe-Zeichen",
  "lageHint": "Hinweis-Text Lage",
  "ep": "Empfohlener Kaufpreis",
  "ko": "Preis-Korridor",
  "fakt": "Faktor Multiplikator",
  "strat": "Verkaufsstrategie",
  "kz1": "Erste Kennzahl Wert",
  "kz1l": "Erste Kennzahl Label",
  "kz2": "Zweite Kennzahl Wert",
  "kz2l": "Zweite Kennzahl Label",
  "kz3": "Dritte Kennzahl Wert",
  "kz3l": "Dritte Kennzahl Label",
  "wert": "Wertbetreiber Text",
  "disc": "Disclaimer Hinweis",
  "hl": [{"t": "Highlight Titel", "d": "Highlight Detail"}],
  "trows": [{"p": "Kaufpreis", "f": "Faktor", "r": "Rendite Prozent"}]
}`;

  try {
    let messageContent;

    if (isPDF && textContent) {
      // Use extracted text - much smaller than sending PDF
      messageContent = [{
        type: 'text',
        text: prompt + '\n\nDokument-Text:\n' + textContent.slice(0, 15000)
      }];
    } else if (b64 && mediaType) {
      // Image
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: prompt }
      ];
    } else {
      return res.status(400).json({ error: 'Keine Daten empfangen' });
    }

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
        messages: [{ role: 'user', content: messageContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error('Anthropic: ' + err.slice(0, 300));
    }

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(e) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Kein JSON in Antwort');
    }

    res.status(200).json(parsed);
  } catch (error) {
    console.error('Extract error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
