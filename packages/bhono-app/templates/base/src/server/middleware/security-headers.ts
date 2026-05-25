import { NONCE, secureHeaders } from 'hono/secure-headers'
import type { Env } from '../env'

const PRODUCTION_HSTS = 'max-age=31536000; includeSubDomains'

export function securityHeaders(env: Env) {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      scriptSrc: ["'self'", NONCE, 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      // CSP3 split: keep <style> elements strict, but allow style="..."
      // attributes — Radix UI primitives (Dialog overlay, Popover positioning)
      // emit inline style attributes that browsers block under style-src 'self'
      // alone, which silently breaks modals and dropdowns. Element-level
      // injection (the actual XSS vector) is still rejected because
      // styleSrcElem falls back to styleSrc.
      styleSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      ...(env.ENVIRONMENT === 'production' ? { upgradeInsecureRequests: [] } : {}),
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: env.ENVIRONMENT === 'production' ? PRODUCTION_HSTS : false,
    xFrameOptions: 'DENY',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
    },
  })
}
