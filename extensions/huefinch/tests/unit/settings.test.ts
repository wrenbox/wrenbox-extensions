import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  MIGRATIONS,
  SCHEMA_VERSION,
  amountOf,
  applyChanges,
  migrate,
  sanitize,
} from '../../src/shared/settings';

describe('settings migrations', () => {
  it('has one migration step per schema version', () => {
    expect(MIGRATIONS).toHaveLength(SCHEMA_VERSION);
  });

  it('fresh install: writes the defaults (Correct, Green-weak, 80%) and the schema version', () => {
    const { settings, write, remove } = migrate({});
    expect(settings).toEqual(DEFAULTS);
    expect(settings).toMatchObject({
      mode: 'correct',
      type: 'deutan',
      strength: 80,
      enabled: true,
    });
    expect(write).toEqual({ ...DEFAULTS, schemaVersion: SCHEMA_VERSION });
    expect(remove).toEqual([]);
  });

  it('current data: writes nothing', () => {
    const stored = { ...DEFAULTS, schemaVersion: SCHEMA_VERSION, type: 'protan', strength: 55 };
    const { settings, write, remove } = migrate(stored);
    expect(settings.type).toBe('protan');
    expect(write).toEqual({});
    expect(remove).toEqual([]);
  });

  it('repairs invalid values and keeps the valid ones', () => {
    const { settings, write } = migrate({
      schemaVersion: 1,
      enabled: 'yes',
      mode: 'invert',
      type: 'tritan',
      strength: 140,
      severity: -3.2,
      offSites: ['WWW.Example.com', 'example.com', 'bad host!', 42, 'news.example.org.'],
    });
    expect(settings).toEqual({
      enabled: true,
      mode: 'correct',
      type: 'tritan',
      strength: 100,
      severity: 0,
      offSites: ['example.com', 'news.example.org'],
    });
    expect(Object.keys(write).sort()).toEqual([
      'enabled',
      'mode',
      'offSites',
      'severity',
      'strength',
    ]);
  });

  it('rounds percentages to whole numbers', () => {
    expect(sanitize({ strength: 72.6 }).strength).toBe(73);
    expect(sanitize({ strength: Number.NaN }).strength).toBe(DEFAULTS.strength);
  });

  it('removes keys this version does not know about', () => {
    const { remove } = migrate({ ...DEFAULTS, schemaVersion: 1, legacyTheme: 'dark' });
    expect(remove).toEqual(['legacyTheme']);
  });

  it('after a downgrade, keeps the newer schema version and its extra keys', () => {
    const { settings, write, remove } = migrate({
      ...DEFAULTS,
      schemaVersion: SCHEMA_VERSION + 1,
      type: 'protan',
      profiles: { 'example.com': 'tritan' },
    });
    expect(settings.type).toBe('protan');
    expect(write).toEqual({});
    expect(remove).toEqual([]);
  });

  it('applies storage change events to settings in memory', () => {
    const next = applyChanges(DEFAULTS as typeof DEFAULTS & { offSites: string[] }, {
      strength: { oldValue: 80, newValue: 35 },
      offSites: { newValue: ['Example.com'] },
      unrelated: { newValue: 1 },
    });
    expect(next).toEqual({ ...DEFAULTS, strength: 35, offSites: ['example.com'] });
  });

  it('reads the amount that matters in each mode', () => {
    expect(amountOf({ ...DEFAULTS, mode: 'correct', strength: 40, severity: 90 })).toBe(40);
    expect(amountOf({ ...DEFAULTS, mode: 'simulate', strength: 40, severity: 90 })).toBe(90);
  });
});
