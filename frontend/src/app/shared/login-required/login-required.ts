import { Component, Input } from '@angular/core';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login-required',
  templateUrl: './login-required.html',
  styleUrls: ['./login-required.css'],
  standalone: false
})
export class LoginRequiredComponent {
  @Input() message = 'Bạn cần đăng nhập tài khoản STEAL để sử dụng tính năng này.';

  constructor(private auth: AuthService) {}

  login(): void {
    this.auth.requestLogin();
  }
}
