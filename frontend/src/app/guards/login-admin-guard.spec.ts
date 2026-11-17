import { TestBed } from '@angular/core/testing';
import { LoginAdminGuard } from './login-admin-guard';

describe('LoginAdminGuard', () => {
  let service: LoginAdminGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoginAdminGuard);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
