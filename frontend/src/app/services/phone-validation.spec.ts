import { TestBed } from '@angular/core/testing';
import { PhoneValidationService } from './phone-validation';

describe('PhoneValidationService', () => {
  const service = () => TestBed.inject(PhoneValidationService);

  it('validates Vietnamese numbers', () => {
    expect(service().validate('0912345678', 'Việt Nam')).toBeTrue();
    expect(service().validate('0212345678', 'Việt Nam')).toBeFalse();
    expect(service().validate('0|12345678', 'Việt Nam')).toBeFalse();
  });

  it('uses country specific rules and falls back to Vietnam', () => {
    expect(service().validate('07700900123', 'Anh')).toBeTrue();
    expect(service().validate('0912345678', 'Quốc gia lạ')).toBeTrue();
  });
});
