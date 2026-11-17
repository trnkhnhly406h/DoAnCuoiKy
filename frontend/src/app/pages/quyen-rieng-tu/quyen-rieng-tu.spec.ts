import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { QuyenRiengTuComponent } from './quyen-rieng-tu';

describe('QuyenRiengTuComponent', () => {
  let component: QuyenRiengTuComponent;
  let fixture: ComponentFixture<QuyenRiengTuComponent>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      declarations: [QuyenRiengTuComponent],
      imports: [FormsModule],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(QuyenRiengTuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
