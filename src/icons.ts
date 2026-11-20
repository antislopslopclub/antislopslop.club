export class Icons {
  readonly glyph: string[] = [];
  readonly x: number[] = [];
  readonly y: number[] = [];

  add(glyph: string, x: number, y: number) {
    this.glyph.push(glyph);
    this.x.push(x);
    this.y.push(y);
  }

  clear() {
    this.glyph.length = this.x.length = this.y.length = 0;
  }
}
