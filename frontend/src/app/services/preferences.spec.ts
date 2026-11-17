import { TestBed } from '@angular/core/testing';
import { PreferencesService } from './preferences';

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(PreferencesService);
  });

  it('censors custom words as whole words only', () => {
    service.save({ ...service.prefs, profanityMode: 'custom_only', customWords: ['vl'] });
    expect(service.censor('game vl quá')).toContain('♥');
    expect(service.censor('vlog hôm nay')).toBe('vlog hôm nay');
  });

  it('does nothing when filtering is disabled', () => {
    service.save({ ...service.prefs, profanityMode: 'none', customWords: ['vl'] });
    expect(service.censor('game vl quá')).toBe('game vl quá');
  });
});
