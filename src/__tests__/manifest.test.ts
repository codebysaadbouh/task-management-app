import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// Feature: task-management-app, manifest.json contains required PWA fields (Requirement 8.1)

const manifestPath = resolve(process.cwd(), 'public/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

describe('manifest.json', () => {
  it('has a non-empty name', () => {
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it('has a non-empty short_name', () => {
    expect(typeof manifest.short_name).toBe('string');
    expect(manifest.short_name.length).toBeGreaterThan(0);
  });

  it('has a non-empty theme_color', () => {
    expect(typeof manifest.theme_color).toBe('string');
    expect(manifest.theme_color.length).toBeGreaterThan(0);
  });

  it('has a non-empty background_color', () => {
    expect(typeof manifest.background_color).toBe('string');
    expect(manifest.background_color.length).toBeGreaterThan(0);
  });

  it('has display set to standalone', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('has icons array with at least 2 entries', () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  it('includes a 192x192 icon', () => {
    const icon192 = manifest.icons.find((icon: { sizes: string }) => icon.sizes === '192x192');
    expect(icon192).toBeDefined();
  });

  it('includes a 512x512 icon', () => {
    const icon512 = manifest.icons.find((icon: { sizes: string }) => icon.sizes === '512x512');
    expect(icon512).toBeDefined();
  });
});
