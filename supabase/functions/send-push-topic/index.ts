// Supabase Edge Function: send-push-topic
// Sends push notifications to an FCM topic using FCM HTTP v1.

const base64UrlEncode = (input: Uint8Array) => {
  let str = "";
  for (let i = 0; i < input.length; i += 1) str += String.fromCharCode(input[i]);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlEncodeString = (input: string) => base64UrlEncode(new TextEncoder().encode(input));

const pemToArrayBuffer = (pem: string) => {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const signJwtRs256 = async (privateKeyPem: string, header: any, payload: any) => {
  const headerB64 = base64UrlEncodeString(JSON.stringify(header));
  const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));
  const toSign = `${headerB64}.${payloadB64}`;

  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(toSign));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${toSign}.${sigB64}`;
};

type SendPushBody = {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
  const gotSecret = req.headers.get("x-push-secret") ?? "";
  if (!expectedSecret || gotSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const serviceAccountRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ?? "";
  if (!serviceAccountRaw) {
    return new Response("Missing GOOGLE_SERVICE_ACCOUNT_JSON", { status: 500 });
  }

  let payload: SendPushBody;
  try {
    payload = (await req.json()) as SendPushBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!payload?.topic || !payload?.title || !payload?.body) {
    return new Response("Missing fields: topic/title/body", { status: 400 });
  }

  let sa: any;
  try {
    sa = JSON.parse(serviceAccountRaw);
  } catch {
    return new Response("Invalid GOOGLE_SERVICE_ACCOUNT_JSON", { status: 500 });
  }

  const projectId = String(sa.project_id ?? "");
  const clientEmail = String(sa.client_email ?? "");
  const privateKey = String(sa.private_key ?? "");
  if (!projectId || !clientEmail || !privateKey) {
    return new Response("Service account missing project_id/client_email/private_key", { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtPayload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 60 * 60,
  };

  const assertion = await signJwtRs256(privateKey, jwtHeader, jwtPayload);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    return new Response(`OAuth token error: ${tokenRes.status} ${txt}`, { status: 502 });
  }

  const tokenJson = await tokenRes.json();
  const accessToken = String(tokenJson.access_token ?? "");
  if (!accessToken) {
    return new Response("No access_token in response", { status: 502 });
  }

  const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        topic: payload.topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ?? {},
      },
    }),
  });

  const fcmText = await fcmRes.text();
  if (!fcmRes.ok) {
    return new Response(`FCM error: ${fcmRes.status} ${fcmText}`, { status: 502 });
  }

  return new Response(fcmText, { status: 200, headers: { "content-type": "application/json" } });
});
