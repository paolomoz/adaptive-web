/**
 * Imagen 3 API Integration (via Vertex AI)
 * Generates images for AdaptiveWeb pages using Google's Imagen 3 model
 */

const VERTEX_AI_REGION = 'us-central1';

/**
 * Generate OAuth2 access token from service account credentials
 * @param {string} serviceAccountJson - JSON string of service account key
 * @returns {Promise<string>} Access token
 */
async function getAccessToken(serviceAccountJson) {
  // The service account JSON from Cloudflare secrets may have literal newlines
  // in the private_key field that need special handling
  let sa;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch (e) {
    // If direct parsing fails, try to fix common issues with private key newlines
    // Replace literal newline characters within the private_key value
    const fixedJson = serviceAccountJson
      .replace(/\n/g, '\\n')  // Escape actual newlines
      .replace(/\\\\n/g, '\\n');  // But don't double-escape
    sa = JSON.parse(fixedJson);
  }

  // Ensure private_key has actual newlines (not escaped)
  if (sa.private_key) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  // Create JWT header and claim
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Base64url encode
  const base64url = (obj) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const unsignedToken = `${base64url(header)}.${base64url(claim)}`;

  // Import private key and sign
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${unsignedToken}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Enhance prompt for Vitamix food photography
 * @param {string} prompt - Original prompt
 * @param {string} type - Image type ('hero' or 'feature')
 * @returns {string} Enhanced prompt
 */
function enhancePrompt(prompt, type) {
  const promptLower = prompt.toLowerCase();
  const isBlenderRelated = promptLower.includes('blender')
    || promptLower.includes('vitamix')
    || promptLower.includes('machine')
    || promptLower.includes('appliance');

  if (type === 'hero' || isBlenderRelated) {
    return `Professional food photography: ${prompt}. Modern Vitamix blender prominently featured in frame. High-quality, well-lit modern kitchen setting, clean composition, shallow depth of field. Appetizing and aspirational.`;
  }
  return `Professional food photography: ${prompt}. High-quality, appetizing composition with beautiful lighting. Fresh ingredients, vibrant colors, clean modern presentation. Shallow depth of field.`;
}

/**
 * Upload image to R2 and return public URL
 * @param {R2Bucket} r2Bucket - Cloudflare R2 bucket binding
 * @param {string} imageData - Base64-encoded image data
 * @param {string} mimeType - Image MIME type
 * @param {string} pageId - Page ID for organizing images
 * @param {string} imageType - Type of image ('hero' or 'feature')
 * @param {number} index - Optional index for feature images
 * @returns {Promise<string>} Public URL of the uploaded image
 */
async function uploadToR2(r2Bucket, imageData, mimeType, pageId, imageType, index) {
  const extension = mimeType === 'image/png' ? 'png' : 'jpeg';
  const filename = `${pageId}/${imageType}${index !== undefined ? `-${index}` : ''}.${extension}`;

  // Decode base64 to binary
  const binaryString = atob(imageData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await r2Bucket.put(filename, bytes, {
    httpMetadata: { contentType: mimeType },
  });

  // Return public URL (R2 public access must be enabled)
  return `https://pub-c0f8ca67ffd34c6d9a09360b16e75261.r2.dev/${filename}`;
}

/**
 * Generate an image using Imagen 3 via Vertex AI
 * @param {string} prompt - Image generation prompt
 * @param {string} accessToken - OAuth2 access token
 * @param {string} projectId - Google Cloud project ID
 * @param {R2Bucket} r2Bucket - Cloudflare R2 bucket binding
 * @param {string} pageId - Page ID for organizing images
 * @param {object} options - Generation options
 * @returns {Promise<{type: string, index?: number, url: string}>} Generated image info
 */
async function generateImage(prompt, accessToken, projectId, r2Bucket, pageId, options = {}) {
  const { type = 'feature', index } = options;
  const enhancedPrompt = enhancePrompt(prompt, type);
  const aspectRatio = type === 'hero' ? '16:9' : '4:3';

  const endpoint = `https://${VERTEX_AI_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_AI_REGION}/publishers/google/models/imagen-3.0-generate-002:predict`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt: enhancedPrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
        personGeneration: 'dont_allow',
        safetySetting: 'block_medium_and_above',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Imagen 3 API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const prediction = data.predictions?.[0];

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No image in Imagen 3 response');
  }

  // Upload to R2 and get public URL
  const url = await uploadToR2(
    r2Bucket,
    prediction.bytesBase64Encoded,
    prediction.mimeType || 'image/png',
    pageId,
    type,
    index,
  );

  return { type, index, url };
}

/**
 * Generate multiple images in parallel using Imagen 3
 * @param {Array<{type: string, prompt: string, index?: number}>} prompts - Image prompts
 * @param {string} serviceAccountJson - Service account JSON key
 * @param {string} projectId - Google Cloud project ID
 * @param {R2Bucket} r2Bucket - Cloudflare R2 bucket binding
 * @param {string} pageId - Page ID for organizing images
 * @returns {Promise<Array<{type: string, index?: number, url: string}>>} Generated images
 */
export async function generateImages(prompts, serviceAccountJson, projectId, r2Bucket, pageId) {
  console.log(`Generating ${prompts.length} images with Imagen 3 for page ${pageId}`);

  // Get access token once for all images
  const accessToken = await getAccessToken(serviceAccountJson);

  // Generate all images in parallel
  const results = await Promise.allSettled(
    prompts.map((item) => generateImage(
      item.prompt,
      accessToken,
      projectId,
      r2Bucket,
      pageId,
      { type: item.type, index: item.index },
    )),
  );

  // Log any failures
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Image ${i} failed:`, result.reason?.message || result.reason);
    }
  });

  // Filter successful results
  const successful = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  console.log(`Successfully generated ${successful.length}/${prompts.length} images`);
  return successful;
}
