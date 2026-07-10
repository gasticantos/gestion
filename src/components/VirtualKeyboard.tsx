"use client";

import { useState } from "react";

const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

export default function VirtualKeyboard({ onInput }: { onInput: (char: string) => void }) {
  const [shift, setShift] = useState(false);

  const handleKey = (key: string) => {
    if (key === "SHIFT") {
      setShift(!shift);
      return;
    }
    if (key === "BACKSPACE") {
      onInput("\b");
      return;
    }
    if (key === "SPACE") {
      onInput(" ");
      return;
    }
    if (key === "ENTER") {
      onInput("\n");
      setShift(false);
      return;
    }
    onInput(shift ? key.toUpperCase() : key);
    setShift(false);
  };

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 p-2 gap-1 flex flex-col">
      {ROWS.map((row, idx) => (
        <div key={idx} className="flex gap-1 justify-center">
          {row.map((key) => (
            <button
              key={key}
              type="button"
              onMouseDown={() => handleKey(key)}
              className="px-2 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-xs font-medium text-neutral-100 active:bg-blue-600 transition-colors"
              style={{
                minWidth: key.length > 1 ? "auto" : "32px",
              }}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1 justify-center">
        <button
          key="SHIFT"
          type="button"
          onMouseDown={() => handleKey("SHIFT")}
          className={`px-3 py-2 border border-neutral-700 rounded text-xs font-medium transition-colors ${
            shift
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
          }`}
        >
          ⇧ Mayús
        </button>
        <button
          key="SPACE"
          type="button"
          onMouseDown={() => handleKey("SPACE")}
          className="flex-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-xs font-medium text-neutral-100 active:bg-blue-600 transition-colors"
        >
          Espacio
        </button>
        <button
          key="BACKSPACE"
          type="button"
          onMouseDown={() => handleKey("BACKSPACE")}
          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded text-xs font-medium text-red-400 active:bg-red-600 transition-colors"
        >
          ← Borrar
        </button>
        <button
          key="ENTER"
          type="button"
          onMouseDown={() => handleKey("ENTER")}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded text-xs font-medium text-white active:bg-blue-800 transition-colors"
        >
          ↵ Enter
        </button>
      </div>
    </div>
  );
}
