import { InvalidPropertyTypeException } from '../domain/errors/property-type.errors.js';

export const normalizeCode = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) throw new InvalidPropertyTypeException('Code is required.');
  return normalized;
};

export const normalizeName = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new InvalidPropertyTypeException('Name is required.');
  return normalized;
};

export const normalizeSlug = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new InvalidPropertyTypeException('Slug is required.');
  return normalized;
};

export const normalizeDescription = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized || null;
};

export const normalizeIcon = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized || null;
};
