import { z } from 'zod'

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
