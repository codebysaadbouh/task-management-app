import { z } from 'zod';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB in bytes

export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export const loginSchema = z.object({
  email: z.string().min(1, "L'email est requis"),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export const boardSchema = z.object({
  name: z.string().min(1, 'Le nom du tableau est requis').max(255),
});

export const columnSchema = z.object({
  name: z.string().min(1, 'Le nom de la colonne est requis').max(255),
});

export const cardSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(500),
  description: z.string().optional(),
});

export const attachmentSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(MAX_FILE_SIZE, 'Le fichier ne doit pas dépasser 20 Mo'),
  mimeType: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BoardInput = z.infer<typeof boardSchema>;
export type ColumnInput = z.infer<typeof columnSchema>;
export type CardInput = z.infer<typeof cardSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
