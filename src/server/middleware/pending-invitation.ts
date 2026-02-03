// src/server/middleware/pending-invitation.ts
// Middleware to automatically accept pending invitations after login
import type { MiddlewareHandler } from 'hono'
import { getCookie, deleteCookie } from 'hono/cookie'
import { getSession } from '../lib/session'
import { invitationsService } from '../services/invitations'
import type { HonoEnv } from '../types'

/**
 * Middleware that checks for pending invitation cookie and accepts it.
 * This handles the case where a user clicks an invite link, goes through OAuth,
 * and needs to be automatically added to the account.
 */
export const pendingInvitationMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const pendingInvitation = getCookie(c, 'pending_invitation')
  const session = getSession(c)

  if (pendingInvitation && session) {
    // Clear the cookie first to prevent multiple attempts
    deleteCookie(c, 'pending_invitation')

    const db = c.get('db')
    if (db) {
      try {
        const invitation = await invitationsService.getByToken(db, pendingInvitation)
        if (invitation) {
          await invitationsService.accept(db, invitation.id, session.userId, {
            transactionId: c.get('transactionId') ?? crypto.randomUUID(),
            ip: c.get('ip') ?? 'unknown',
            userAgent: c.get('userAgent') ?? 'unknown',
          })
          console.log('[INVITATION] Auto-accepted invitation for user:', session.email)
        }
      } catch (error) {
        // Don't block the request if invitation acceptance fails
        console.error('[INVITATION] Failed to auto-accept invitation:', error)
      }
    }
  }

  return next()
}
