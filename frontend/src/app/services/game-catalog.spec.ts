import { TestBed } from '@angular/core/testing';
import { GameCatalogService } from './game-catalog';
import { PreferencesService } from './preferences';

describe('GameCatalogService', () => {
  let catalog: GameCatalogService;

  beforeEach(() => {
    localStorage.clear();
    catalog = TestBed.inject(GameCatalogService);
  });

  it('computes final price from original price and discount', () => {
    expect(catalog.getById('gta-v')?.finalPrice).toBe(225000);
    expect(catalog.getById('witcher-3')?.finalPrice).toBe(97500);
    expect(catalog.getById('cities-skylines-ii')?.finalPrice).toBe(1200000);
  });

  it('never gives free games a price', () => {
    catalog.getFree().forEach(g => {
      expect(g.finalPrice).toBe(0);
      expect(g.isFree).toBeTrue();
    });
    expect(catalog.getById('euro-truck-sim-2')?.isFree).toBeTrue();
  });

  it('resolves a game by id, code or slugified title', () => {
    expect(catalog.resolve('SIM02')?.id).toBe('cities-skylines-ii');
    expect(catalog.resolve('cities-skylines-ii')?.code).toBe('SIM02');
    expect(catalog.resolve('the-witcher-3-wild-hunt')?.id).toBe('witcher-3');
    expect(catalog.resolve('khong-ton-tai')).toBeUndefined();
  });

  it('every game has two screenshots, a cover and unique ids/codes', () => {
    const games = catalog.getAllGames();
    expect(new Set(games.map(g => g.id)).size).toBe(games.length);
    expect(new Set(games.map(g => g.code)).size).toBe(games.length);
    games.forEach(g => {
      expect(g.screenshots.length).toBe(2);
      expect(g.coverImage).toBeTruthy();
    });
  });

  it('searches ignoring Vietnamese accents', () => {
    expect(catalog.search('kinh di').some(g => g.id === 'outlast')).toBeTrue();
    expect(catalog.search('xyz-khong-ton-tai')).toEqual([]);
  });

  it('hides games flagged by the user content filter', () => {
    const prefs = TestBed.inject(PreferencesService);
    prefs.save({ ...prefs.prefs, hide: { ...prefs.prefs.hide, mature: true } });
    expect(catalog.getByGenre('kinh-di').some(g => g.id === 'outlast')).toBeFalse();
  });

  it('recommendations exclude the current game', () => {
    expect(catalog.getRecommended(50, 'gta-v').some(g => g.id === 'gta-v')).toBeFalse();
  });
});
