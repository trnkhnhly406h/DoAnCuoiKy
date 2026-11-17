import { Component, HostListener } from '@angular/core';
import { ConfirmService } from '../../services/confirm';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrls: ['./confirm-dialog.css'],
  standalone: false
})
export class ConfirmDialogComponent {
  constructor(public confirm: ConfirmService) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm.options) this.confirm.answer(false);
  }
}
