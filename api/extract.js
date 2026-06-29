export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { b64, mediaType, isPDF } = req.body;
  if (!b64) return res.status(400).json({ error: 'No file data' });

  const prompt = `Du bist ein Experte fuer Immobilien-Exposees. Analysiere dieses Dokument und extrahiere ALLE Informationen. Antworte NUR mit einem validen JSON-Objekt ohne Markdown oder Codeblock.

JSON-Format (leere Strings fuer fehlende Werte):
{
  "typ": "Objektart",
  "ref": "Referenznummer",
  "titel": "Haupttitel",
  "sub": "Untertitel",
  "adr": "Vollstaendige Adresse",
  "fl": "Wohnflaeche Zahl",
  "gr": "Grundstueck Zahl",
  "zi": "Zimmer/Einheiten",
  "bj": "Baujahr",
  "hz": "Heizung",
  "vf": "Verfuegbarkeit",
  "zustand": "Zustand",
  "au": "Aussenanlage Besonderheiten",
  "empf": "Name Eigentuemer",
  "footref": "Kurzer Objektname",
  "letter": "Anschreiben Text",
  "quote": "Zitat Kernsatz",
  "descTitle": "Titel Beschreibungsseite",
  "desc": "Beschreibungstext",
  "lageTitle": "Titel Lageseite",
  "lage": "Lagetext",
  "lageTags": "Tags getrennt durch Pipe",
  "ep": "Kaufpreis",
  "ko": "Preis-Korridor",
  "fakt": "Faktor",
  "strat": "Strategie",
  "kz1": "", "kz1l": "",
  "kz2": "", "kz2l": "",
  "kz3": "", "kz3l": "",
  "wert": "Wertbetreiber Text",
  "disc": "Disclaimer",
  "hl": [{"t": "Titel", "d": "Detail"}],
  "trows": [{"p": "Preis", "f": "Faktor", "r": "Rendite"}]
}`;

  try {
    let messageContent;
    
    if (isPDF) {
      messageContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
        { type: 'text', text: prompt }
      ];
    } else {
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: b64 } },
        { type: 'text', text: prompt }
      ];
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
      throw new Error('Anthropic API: ' + err.slice(0, 200));
    }

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(e) {
      // Try to extract JSON from response
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Kein valides JSON in Antwort');
    }
    
    res.status(200).json(parsed);
  } catch (error) {
    console.error('Extract error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
