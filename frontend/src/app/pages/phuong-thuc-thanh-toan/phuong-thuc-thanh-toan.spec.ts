import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { PhuongThucThanhToanComponent } from './phuong-thuc-thanh-toan';

describe('PhuongThucThanhToanComponent', () => {
  let component: PhuongThucThanhToanComponent;
  let fixture: ComponentFixture<PhuongThucThanhToanComponent>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      declarations: [PhuongThucThanhToanComponent],
      imports: [FormsModule],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PhuongThucThanhToanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
