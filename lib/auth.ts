// Utilidades de autenticación para proteger /xmlscan.
//
// La contraseña real vive SOLO en la variable de entorno XMLSCAN_PASSWORD
// (configurada en Vercel y en .env.local para desarrollo). Nunca en el código.
//
// El token de sesión que se guarda en la cookie es el hash SHA-256 de la
// contraseña: así no se almacena la contraseña en claro en la cookie, y tanto
// el middleware (edge runtime) como la API route (node) pueden recalcularlo y
// compararlo usando Web Crypto, disponible en ambos entornos.

export const AUTH_COOKIE = 'xmlscan_auth';

export async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Token esperado en la cookie para considerar la sesión válida.
// Devuelve '' si no hay contraseña configurada (en ese caso nadie entra).
export async function expectedToken(): Promise<string> {
  const pwd = process.env.XMLSCAN_PASSWORD;
  if (!pwd) return '';
  return sha256hex(pwd);
}
