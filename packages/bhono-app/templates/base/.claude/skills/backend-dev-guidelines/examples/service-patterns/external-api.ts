/**
 * External API Integration Pattern
 *
 * Example of calling external APIs with error handling,
 * retry logic, and response mapping.
 */

import { HTTPException } from 'hono/http-exception'
import { InternalError } from '@server/lib/errors'
import type { ServiceContext } from '@server/types'

// ============================================================================
// Types
// ============================================================================

interface SendGridEnv {
  SENDGRID_API_KEY: string
}

interface EmailInput {
  to: string
  subject: string
  html: string
  from?: string
}

interface SendGridResponse {
  statusCode: number
  body?: string
}

// ============================================================================
// Email Service with External API
// ============================================================================

export const emailService = {
  /**
   * Send email via SendGrid API
   * Includes error handling and retry logic
   */
  async send(
    env: SendGridEnv,
    ctx: ServiceContext,
    input: EmailInput
  ): Promise<{ success: boolean; messageId?: string }> {
    const { to, subject, html, from = 'noreply@app.com' } = input

    // Build request
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
    }

    try {
      const response = await fetchWithRetry(
        'https://api.sendgrid.com/v3/mail/send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        { maxRetries: 3, retryDelay: 1000 }
      )

      // SendGrid returns 202 for accepted
      if (response.status === 202) {
        const messageId = response.headers.get('x-message-id')
        return { success: true, messageId: messageId ?? undefined }
      }

      // Log error response
      const errorBody = await response.text()
      console.log(JSON.stringify({
        _tag: 'SENDGRID_ERROR',
        status: response.status,
        body: errorBody,
        transactionId: ctx.transactionId,
      }))

      throw new InternalError('Failed to send email')
    } catch (error) {
      // Re-throw HTTPException
      if (error instanceof HTTPException) {
        throw error
      }

      // Log and wrap other errors
      console.log(JSON.stringify({
        _tag: 'EMAIL_SERVICE_ERROR',
        error: error instanceof Error ? error.message : String(error),
        transactionId: ctx.transactionId,
      }))

      throw new InternalError('Email service unavailable')
    }
  },
}

// ============================================================================
// Stripe Integration Pattern
// ============================================================================

interface StripeEnv {
  STRIPE_SECRET_KEY: string
}

interface CreatePaymentIntentInput {
  amount: number // in cents
  currency: string
  customerId?: string
  metadata?: Record<string, string>
}

interface PaymentIntent {
  id: string
  clientSecret: string
  status: string
  amount: number
}

export const paymentService = {
  /**
   * Create Stripe PaymentIntent
   */
  async createPaymentIntent(
    env: StripeEnv,
    ctx: ServiceContext,
    input: CreatePaymentIntentInput
  ): Promise<PaymentIntent> {
    const { amount, currency, customerId, metadata } = input

    // Build form-encoded body (Stripe API uses form data)
    const params = new URLSearchParams()
    params.append('amount', amount.toString())
    params.append('currency', currency)
    if (customerId) {
      params.append('customer', customerId)
    }
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        params.append(`metadata[${key}]`, value)
      })
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } }
        console.log(JSON.stringify({
          _tag: 'STRIPE_ERROR',
          status: response.status,
          message: error.error?.message,
          transactionId: ctx.transactionId,
        }))
        throw new InternalError('Payment processing failed')
      }

      const data = await response.json() as {
        id: string
        client_secret: string
        status: string
        amount: number
      }

      return {
        id: data.id,
        clientSecret: data.client_secret,
        status: data.status,
        amount: data.amount,
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }

      console.log(JSON.stringify({
        _tag: 'PAYMENT_SERVICE_ERROR',
        error: error instanceof Error ? error.message : String(error),
        transactionId: ctx.transactionId,
      }))

      throw new InternalError('Payment service unavailable')
    }
  },
}

// ============================================================================
// Retry Helper
// ============================================================================

interface RetryOptions {
  maxRetries: number
  retryDelay: number
  retryOn?: number[] // HTTP status codes to retry on
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions
): Promise<Response> {
  const { maxRetries, retryDelay, retryOn = [502, 503, 504] } = retryOptions

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Check if should retry based on status
      if (retryOn.includes(response.status) && attempt < maxRetries) {
        await sleep(retryDelay * (attempt + 1)) // Exponential backoff
        continue
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        await sleep(retryDelay * (attempt + 1))
        continue
      }
    }
  }

  throw lastError ?? new Error('Max retries exceeded')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
