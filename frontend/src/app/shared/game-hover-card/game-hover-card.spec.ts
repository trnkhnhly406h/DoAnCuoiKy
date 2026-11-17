import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameCatalogService } from '../../services/game-catalog';
import { GameHoverCardComponent } from './game-hover-card';

describe('GameHoverCardComponent', () => {
  let fixture: ComponentFixture<GameHoverCardComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      declarations: [GameHoverCardComponent],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(GameHoverCardComponent);
    const game = TestBed.inject(GameCatalogService).getById('gta-v');
    if (!game) throw new Error('Thiếu game mẫu gta-v');
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();
  });

  it('shows the game title', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Grand Theft Auto V');
  });
});
