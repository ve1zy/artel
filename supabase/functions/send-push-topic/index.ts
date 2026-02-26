// Supabase Edge Function: send-push-topic
// Sends push notifications to an FCM topic using FCM HTTP v1.

// PASTE YOUR GOOGLE SERVICE ACCOUNT JSON HERE (from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key)
const serviceAccount = {
  "type": "service_account",
  "project_id": "artel-a904d",
  "private_key_id": "53fee2c16a9687e1b44cabe56f20e6d1803deea8",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC/Zdbs64mI/joU\naxBFUHcOaoo8GlKwBeLmxW8Pu+gf5vm/U6F5NtFFxMueFH7/W2MAzN0xSbQsKV96\nx9vc3DgdhJIvOLBLReq1cazZsiBHqsTFSnAbvR10hTN0XBrHQO6pqsGIT3h/N58/\n2dAeBAlzd7jrrrQvVAOapHOtiSMkhfXQVb+LlAsspemVus6TeHnci8BMnC14zg86\n+Wxl52kRDK2sFVEhuicsDAEWry7/gunqiCEwrM4sA8tXielwket9KGscppBMoZve\n27PN4/K3CCMa700P139hvgP7eoJQwFSkl8l0U590LxKvhMocWEdvkHijCT0r8PcP\nbpXtwYJ3AgMBAAECggEADvz+eeWEtY3UZjFE1Wtp3174KKEWakK+aZGlfbHFNEEG\nEXW5oUCUiSZSRwoA21DAmIPygGpuqb9VraDwC+7SQCbXvHXv1v0zK6FVcWN8bqWm\nAh3Zrfppz5b3bWchu7Ukhh82nPeS4+zVqOOO44Laa0iWr8d/GcO2V9+v+rN7ZTUr\nfzVb1XJhGdKMFaKkgFFieTPcQdk4WK6ntjzZD5dUldStf/uZE6Hn4G0M43Lj2512\ngYJyNANRzVxbn5Hho4c0HgwKTNn+HSEmNF6vK+ABjkfWtmhFDPByVvNftUEFpvHy\ncp4i1otzEvbUflDx/y/fGkLjgPt9WiedFOYx5XcnLQKBgQD2RHjvDBdoAoNCeqjR\n+Ck9Fsx+mvOM1FsLl/oyEJCf7cjW5uHnXwSOfgHIsxtupcFVunzGLI01medt7ZUS\nxK0TJ/BKEG1Qo3V7Im1dwvaqCzIEPE+b0QWqvjVxoWvKxtZZFI290sbocvxA9o39\nTfGDqIYxDYlf8yasEbZJ1/71NQKBgQDG9j3yvBUMPPdvYymfrfIpIaU2UaNUkdfp\nvslKhd7riAMvM7/549CdddGfU+aFzl8Qs5WMwh7saZlcPsrFDzt/n3F9+Vhzhe0i\nx741/aqLwX1/iTPiTTxMCQPWZn3OwpuOxrjGK5+0mRnFxMObJIUgzMCEQ02u7tWW\nbYg0fcsqewKBgQDmNQXTeDsdGFQ5Pc44UUHDgF9y7khDWnMteEkCqed4CODYuwVr\nsq/gv7vNMFixazM6f1SKMDVkaNUlNpVG8SFVKd1+brKxUcvNalZP8qOAO2zq9rH4\nV0Fz5dCxwxKvgIX4ybTiQHl965cQ5ym+IzFkQJIIor3LOtHowbnkd4w3DQKBgQCi\n5U7Y4sa0y2Gmb+DPXKJMrMBQVczM28+UD+FMQ4i8/BHnXo5KMQxHLwReV1oAqXNK\nAE5r/S9GTjsCvGJVrt/+4HMSOckCZF8/v5vrJnGwlM2EUrgJC0VX13Wt3yIX21tz\nLR5xGZxbR5JDSpL//YmFzj28zEHY/LAgxjLjDy786wKBgQCbrByaZxLQ2lcF9CJC\nHl9IczBhjVp0H0QZGlEZtzNC+P9Z20ARZUisc++quSdM9YyNsaIwJ3Bpeh8nkUUi\nxPApgX20DAmK3ZsrreQ0n5PkPlODs8FcjfYkHl3iXliRoahjKAQZLBi08WHvp7Az\neAWPtaOw+rNf8VamveIBxGcOuw==\n-----END PRIVATE KEY-----\n",
  "client_email": "aryel-625@artel-a904d.iam.gserviceaccount.com",
  "client_id": "104681019082645512842",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/aryel-625%40artel-a904d.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

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

  // const expectedSecret = "asd456asd45dfg125asd45fvd568df21";  // Your webhook secret
  // const gotSecret = req.headers.get("x-push-secret") ?? "";
  // console.log("Debug: gotSecret:", gotSecret, "expected:", expectedSecret);
  // if (gotSecret !== expectedSecret) {
  //   return new Response("Unauthorized", { status: 401 });
  // }

  let payload: SendPushBody;
  try {
    payload = (await req.json()) as SendPushBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log("Push called for topic:", payload.topic, "title:", payload.title, "body:", payload.body);

  if (!payload?.topic || !payload?.title || !payload?.body) {
    return new Response("Missing fields: topic/title/body", { status: 400 });
  }

  const sa = serviceAccount;

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
