import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.html',
  styleUrls: ['./not-found.css'],
  standalone: false
})
export class NotFoundComponent {
  constructor(private router: Router, private location: Location) {}

  veTrangChu(): void {
    this.router.navigate(['/']);
  }

  /** Quay lại trang trước; nếu không có lịch sử (mở thẳng URL lỗi) thì về trang chủ. */
  quayLai(): void {
    if (window.history.length > 1) this.location.back();
    else this.veTrangChu();
  }
}
