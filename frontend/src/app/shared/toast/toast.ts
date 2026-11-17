import { Component } from '@angular/core';
import { ToastMessage, ToastService } from '../../services/toast';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.html',
  styleUrls: ['./toast.css'],
  standalone: false
})
export class ToastComponent {
  constructor(public toast: ToastService) {}

  trackById(_: number, item: ToastMessage): number {
    return item.id;
  }
}
