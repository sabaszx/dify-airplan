"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MenuItem } from "@/editor/context-menu";
import { clampMenuPosition } from "@/editor/context-menu";

/**
 * Keyboard-accessible, viewport-clamped context menu. Arrow keys navigate,
 * Enter activates, Escape closes and returns focus. Destructive items are
 * visually separated. Submenus open on hover/Enter. See override §8/§10.
 */
export function ContextMenu({
  items,
  x,
  y,
  onAction,
  onClose,
}: {
  items: MenuItem[];
  x: number;
  y: number;
  onAction: (actionId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [active, setActive] = useState(0);
  const [openSub, setOpenSub] = useState<number | null>(null);

  const focusable = items.filter((i) => i.actionId !== "__sep" && !i.disabled);

  // Clamp after mount when we know the real size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(
      clampMenuPosition(
        { x, y },
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [x, y]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [onClose]);

  function activate(item: MenuItem) {
    if (item.disabled || item.actionId === "__sep") return;
    if (item.submenu && item.submenu.length) {
      const idx = items.indexOf(item);
      setOpenSub(openSub === idx ? null : idx);
      return;
    }
    onAction(item.actionId);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(focusable.length - 1, a + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = focusable[active];
      if (item) activate(item);
    }
  }

  let focusIndex = -1;

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-label="Context menu"
      onKeyDown={onKeyDown}
      data-testid="context-menu"
      className="fixed z-50 min-w-[200px] rounded-md border border-base-border bg-base-panel py-1 text-sm shadow-lg outline-none"
      style={{ left: pos.x, top: pos.y, boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
    >
      {items.map((item, i) => {
        if (item.actionId === "__sep") {
          return <div key={`sep${i}`} className="my-1 h-px bg-base-border" />;
        }
        const isFocusable = !item.disabled;
        if (isFocusable) focusIndex++;
        const isActive = isFocusable && focusIndex === active;
        return (
          <div key={item.actionId} className="relative">
            {item.separatorBefore && i > 0 && <div className="my-1 h-px bg-base-border" />}
            <button
              role="menuitem"
              disabled={item.disabled}
              data-action={item.actionId}
              onMouseEnter={() => {
                if (isFocusable) setActive(focusIndex);
                if (item.submenu) setOpenSub(i);
                else setOpenSub(null);
              }}
              onClick={() => activate(item)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                item.destructive ? "text-red-300" : ""
              } ${isActive ? "bg-accent/25" : "hover:bg-base-border"} ${
                item.disabled ? "cursor-not-allowed opacity-40" : ""
              }`}
            >
              <span>{item.label}</span>
              {item.submenu && <span aria-hidden>▸</span>}
            </button>
            {item.submenu && openSub === i && (
              <div
                role="menu"
                className="absolute left-full top-0 ml-1 min-w-[160px] rounded-md border border-base-border bg-base-panel py-1"
                style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
              >
                {item.submenu.map((sub) => (
                  <button
                    key={sub.actionId}
                    role="menuitem"
                    data-action={sub.actionId}
                    onClick={() => {
                      onAction(sub.actionId);
                      onClose();
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-base-border"
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
