import { useEffect, useRef } from "react";
import "./index.css";

const emojis = [
  "🚀", "✨", "🔥", "🎯", "🤖", "⚡", "📦", "🧠",
  "🎉", "🛠️", "💡", "🐛", "🔍", "⚙️", "📚", "✅",
  "🌟", "🧪", "🎨", "🚧", "🔮", "📈", "💎", "💻",
];

const cellSize = 24;

type Cell = { emojiIndex: number; nextChange: number };

function randomDelay() {
  return 1000 + Math.random() * 4000;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d");
    if (!context) return;

    const cells: Cell[] = [];
    let columns = 1;
    let cellWidth = cellSize;
    let cellHeight = cellSize;
    let frame: number;

    const paintCell = (index: number, cell: Cell) => {
      const left = (index % columns) * cellWidth;
      const top = Math.floor(index / columns) * cellHeight;
      context.clearRect(left, top, cellWidth, cellHeight);
      context.fillText(emojis[cell.emojiIndex]!, left + cellWidth / 2, top + cellHeight / 2);
    };

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const pixelRatio = window.devicePixelRatio;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      context.font = '16px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";

      columns = Math.max(1, Math.floor(width / cellSize));
      const rows = Math.max(1, Math.floor(height / cellSize));
      cellWidth = width / columns;
      cellHeight = height / rows;
      cells.length = rows * columns;
      const now = performance.now();
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index] ??= {
          emojiIndex: Math.floor(Math.random() * emojis.length),
          nextChange: now + randomDelay(),
        };
        paintCell(index, cell);
      }
    };

    const animate = (now: number) => {
      cells.forEach((cell, index) => {
        if (now < cell.nextChange) return;
        // A nonzero offset picks uniformly from every emoji except the current one.
        const offset = 1 + Math.floor(Math.random() * (emojis.length - 1));
        cell.emojiIndex = (cell.emojiIndex + offset) % emojis.length;
        cell.nextChange = now + randomDelay();
        paintCell(index, cell);
      });
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    const observer = new ResizeObserver(resize);
    const box = "devicePixelContentBoxSize" in ResizeObserverEntry.prototype
      ? "device-pixel-content-box"
      : "content-box";
    observer.observe(canvas, { box });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <main aria-label="Anti Slop Slop Club">
      <canvas ref={canvasRef} role="img" aria-label="A wall of random README emojis" />
    </main>
  );
}
