import { z } from 'zod'

export const CreateWebhookSchema = z.object({
  url: z
    .url('Digite uma URL válida')
    .refine((url) => url.startsWith('https://'), 'URL deve usar HTTPS'),
  events: z
    .array(z.string())
    .min(1, 'Selecione pelo menos um evento'),
})

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>
