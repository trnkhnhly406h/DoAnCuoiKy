import { Component, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthModal, AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  /** Cửa sổ đăng nhập / đăng ký đang mở (nếu có). */
  readonly authModal$: Observable<AuthModal>;

  /** Đang ở khu quản trị (/admin/**): ẩn header/footer/chat của cửa hàng. */
  readonly isAdmin = signal(typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));

  constructor(auth: AuthService, router: Router) {
    this.authModal$ = auth.showAuthModal$;
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.isAdmin.set(e.urlAfterRedirects.startsWith('/admin')));
  }
}
