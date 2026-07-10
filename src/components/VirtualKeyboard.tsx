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
    <div className="bg-neutral-900 border-t border-neutral-800 p-1.5 gap-1 flex flex-col text-sm md:text-xs">
      {ROWS.map((row, idx) => (
        <div key={idx} className="flex gap-1 justify-center">
          {row.map((key) => (
            <button
              key={key}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKey(key);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKey(key);
              }}
              className="px-2 py-3 sm:py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded font-medium text-neutral-100 active:bg-blue-600 transition-colors flex-1 sm:flex-initial min-h-12 sm:min-h-8"
              style={{
                minWidth: "auto",
                flex: "1 1 auto",
              }}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1 justify-center">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleKey("SHIFT");
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleKey("SHIFT");
          }}
          className={`px-3 py-3 sm:py-2 border border-neutral-700 rounded font-medium transition-colors flex-1 min-h-12 sm:min-h-8 ${
            shift
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
          }`}
        >
          ⇧
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleKey("SPACE");
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleKey("SPACE");
          }}
          className="flex-[3] px-3 py-3 sm:py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded font-medium text-neutral-100 active:bg-blue-600 transition-colors min-h-12 sm:min-h-8"
        >
          Espacio
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleKey("BACKSPACE");
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleKey("BACKSPACE");
          }}
          className="flex-1 px-3 py-3 sm:py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded font-medium text-red-400 active:bg-red-600 transition-colors min-h-12 sm:min-h-8"
        >
          ←
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleKey("ENTER");
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleKey("ENTER");
          }}
          className="flex-1 px-3 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded font-medium text-white active:bg-blue-800 transition-colors min-h-12 sm:min-h-8"
        >
          ↵
        </button>
      </div>
    </div>
  );
}
