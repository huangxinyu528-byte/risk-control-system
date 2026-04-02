"use client";

import { useEffect, useState } from "react";

type FontScale = "small" | "default" | "large";

const STORAGE_KEY = "zc-font-scale";

const OPTIONS: Array<{ value: FontScale; label: string }> = [
  { value: "small", label: "小" },
  { value: "default", label: "默认" },
  { value: "large", label: "大" },
];

function applyFontScale(scale: FontScale) {
  document.documentElement.dataset.fontScale = scale;
}

export function FontSizeSwitcher() {
  const [scale, setScale] = useState<FontScale>("default");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as FontScale | null;
    const next = stored && OPTIONS.some((item) => item.value === stored) ? stored : "default";
    setScale(next);
    applyFontScale(next);
  }, []);

  function updateScale(next: FontScale) {
    setScale(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyFontScale(next);
  }

  return (
    <div className="font-size-switcher" aria-label="网页字体大小">
      <span className="font-size-switcher-label">字体</span>
      <div className="font-size-switcher-options">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            className={
              option.value === scale
                ? "font-size-switcher-button font-size-switcher-button-active"
                : "font-size-switcher-button"
            }
            type="button"
            onClick={() => updateScale(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
