/**
 * mediaValidation.js
 * ------------------
 * Validates uploaded incident media files.
 *
 * Strategy (no API key required — fully free):
 * 1. If REACT_APP_VISION_API_KEY is set and valid → use Google Cloud Vision API
 * 2. Otherwise → uses Hugging Face free inference (no key needed) to classify the image
 * 3. If both fail → gracefully returns "unverified" with a clear, friendly message
 *
 * Emergency-relevant labels that confirm a genuine incident:
 * flood, fire, smoke, ambulance, police, rescue, destruction, accident, etc.
 */

const EMERGENCY_KEYWORDS = [
  'flood', 'flooding', 'fire', 'smoke', 'flame', 'blaze',
  'ambulance', 'police', 'rescue', 'fire_truck', 'fire_engine', 'fire station',
  'crash', 'wreck', 'wreckage', 'debris', 'rubble', 'collapse',
  'disaster', 'destruction', 'damage', 'hazard',
  'storm', 'tornado', 'landslide', 'wildfire', 'explosion',
  'stretcher', 'oxygen_mask', 'first-aid', 'hospital', 'injury',
  'burning', 'charred', 'submerged', 'inundated',
  'traffic jam', 'road_accident', 'car accident', 'car_wreck',
];

const UNRELATED_KEYWORDS = [
  'selfie', 'portrait', 'smile', 'food', 'meal', 'plate', 'dish', 'restaurant',
  'coffee', 'cup', 'mug', 'clothing', 'shoe', 'sneaker', 'handbag',
  'flower', 'bouquet', 'wedding', 'party', 'concert', 'entertainment',
  'cat', 'dog', 'bird', 'animal', 'pet',
];

/** Convert File to base64 string (no data-url prefix) */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Classify using Google Cloud Vision API */
async function classifyWithVision(file, apiKey) {
  const base64 = await fileToBase64(file);
  const body = {
    requests: [{
      image: { content: base64 },
      features: [{ type: 'LABEL_DETECTION', maxResults: 15 }],
    }],
  };
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error('Vision API ' + res.status);
  const data = await res.json();
  return (data.responses?.[0]?.labelAnnotations || []).map(l => ({
    label: l.description?.toLowerCase() || '', score: l.score || 0,
  }));
}

/** Classify using Hugging Face free inference (ViT-base, no key required) */
async function classifyWithHuggingFace(file) {
  // Convert file to binary blob for HF API
  const base64 = await fileToBase64(file);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: file.type });

  const res = await fetch(
    'https://api-inference.huggingface.co/models/google/vit-base-patch16-224',
    { method: 'POST', body: blob }
  );
  if (!res.ok) throw new Error('HF API ' + res.status);
  const data = await res.json();
  // data is Array<{ label, score }>
  if (!Array.isArray(data)) throw new Error('Unexpected HF response');
  return data.map(d => ({ label: (d.label || '').toLowerCase().replace(/_/g, ' '), score: d.score || 0 }));
}

/** Determine status from a list of { label, score } */
function classifyLabels(labels) {
  const top = labels.filter(l => l.score > 0.05);
  const descriptions = top.map(l => l.label);

  const isEmergency = descriptions.some(desc =>
    EMERGENCY_KEYWORDS.some(kw => desc.includes(kw))
  );
  const isUnrelated = descriptions.some(desc =>
    UNRELATED_KEYWORDS.some(kw => desc.includes(kw))
  );

  if (isEmergency) return 'genuine';
  if (isUnrelated && !isEmergency) return 'invalid';
  return 'unverified';
}

/**
 * Main export: validate an array of File objects.
 * Returns Promise<Array<{ file, fileName, status, labels, confidence, message }>>
 */
export async function validateIncidentMedia(files) {
  return Promise.all(
    Array.from(files).map(async (file) => {
      // Videos cannot be classified — mark as unverified (allow submission)
      if (!file.type.startsWith('image/')) {
        return {
          file, fileName: file.name, status: 'unverified', labels: [], confidence: 0,
          message: '📹 Video attached — your report can be submitted.',
        };
      }

      // ── Try Google Vision API first (if key is set) ──────────────────────
      const apiKey = process.env.REACT_APP_VISION_API_KEY;
      const hasValidKey = apiKey && apiKey !== 'YOUR_VISION_API_KEY' && apiKey.length > 10;

      if (hasValidKey) {
        try {
          const labels = await classifyWithVision(file, apiKey);
          const status = classifyLabels(labels);
          const topLabel = labels[0];
          const msgMap = {
            genuine:    `✅ Emergency scene confirmed (${topLabel?.label}, ${Math.round((topLabel?.score || 0) * 100)}% confidence)`,
            unverified: `⚠️ Scene unclear — photo will be reviewed by response team`,
            invalid:    `❌ Image appears unrelated to an emergency (${topLabel?.label || 'no match'})`,
          };
          return { file, fileName: file.name, status, labels: labels.slice(0, 5), confidence: topLabel?.score || 0, message: msgMap[status] };
        } catch (_) {
          // Fall through to Hugging Face
        }
      }

      // ── Try Hugging Face free inference (no key required) ────────────────
      try {
        const labels = await classifyWithHuggingFace(file);
        const status = classifyLabels(labels);
        const topLabel = labels[0];
        const msgMap = {
          genuine:    `✅ Emergency scene detected — photo looks relevant`,
          unverified: `📷 Photo attached — response team will review on arrival`,
          invalid:    `⚠️ Photo may not show the emergency scene. Please attach a clearer image`,
        };
        // Don't mark as hard "invalid" when using free tier (less accurate)
        const safeStatus = status === 'invalid' ? 'unverified' : status;
        return { file, fileName: file.name, status: safeStatus, labels: labels.slice(0, 5), confidence: topLabel?.score || 0, message: msgMap[safeStatus] };
      } catch (_) {
        // Both failed — graceful fallback
      }

      // ── Final fallback — always allow submission ──────────────────────────
      return {
        file, fileName: file.name, status: 'unverified', labels: [], confidence: 0,
        message: '📷 Photo attached — your report can be submitted.',
      };
    })
  );
}
