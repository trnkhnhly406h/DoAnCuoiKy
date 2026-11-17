import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [App],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  it('should host the router outlet, toast and confirm dialog', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('app-toast')).not.toBeNull();
    expect(el.querySelector('app-confirm-dialog')).not.toBeNull();
  });
});
