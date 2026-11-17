import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';

/**
 * Nạp Bootstrap + giao diện nền riêng của khu quản trị.
 * Chỉ tồn tại khi đang ở /admin/**: rời khỏi admin thì CSS bị gỡ, giao diện khách hàng không bị ảnh hưởng.
 */
@Component({
  selector: 'app-admin-styles',
  standalone: true,
  template: '',
  styleUrl: './admin-styles.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminStylesComponent implements OnInit, OnDestroy {
  ngOnInit(): void {
    document.body.classList.add('admin-mode');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('admin-mode');
  }
}
