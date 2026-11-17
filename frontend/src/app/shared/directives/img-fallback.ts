import { Directive, ElementRef, HostListener } from '@angular/core';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">' +
    '<rect width="100%" height="100%" fill="#3d2657"/>' +
    '<text x="50%" y="50%" fill="#9589a2" font-family="sans-serif" font-size="28" font-weight="700" ' +
    'text-anchor="middle" dominant-baseline="middle">STEAL</text></svg>'
  );

/** Thay ảnh lỗi/không tải được bằng ảnh dự phòng (không bao giờ lặp vô hạn). */
@Directive({
  selector: 'img[appImgFallback]',
  standalone: false
})
export class ImgFallbackDirective {
  constructor(private el: ElementRef<HTMLImageElement>) {}

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;
    if (img.src !== PLACEHOLDER) {
      img.src = PLACEHOLDER;
    }
  }
}
