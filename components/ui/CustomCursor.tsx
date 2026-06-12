"use client";

import React, { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";

// Global set for registering clickable elements by their action id
const actionRegistry = new Map<
  string,
  { element: HTMLElement; label: string }
>();

export function registerAction(
  id: string,
  element: HTMLElement,
  label: string,
) {
  actionRegistry.set(id, { element, label });
}

export function unregisterAction(id: string) {
  actionRegistry.delete(id);
}

export type CursorAction = {
  id: string;
  label: string;
};

/**
 * Find the best matching action by voice text.
 * Returns the action id and the element.
 */
export function findActionByVoice(text: string): CursorAction | null {
  const lower = text.toLowerCase();
  let bestMatch: CursorAction | null = null;
  let bestScore = 0;

  for (const [id, { label }] of actionRegistry) {
    const labelLower = label.toLowerCase();
    // Score: exact match > partial match
    if (labelLower === lower) {
      bestMatch = { id, label };
      bestScore = 3;
      break;
    }
    if (lower.includes(labelLower) || labelLower.includes(lower)) {
      const score = Math.max(
        lower.includes(labelLower) ? 2 : 0,
        labelLower.includes(lower) ? 1 : 0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { id, label };
      }
    }
  }

  return bestMatch;
}

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });

  // Track mouse
  useEffect(() => {
    const move = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (cursorRef.current) {
        gsap.to(cursorRef.current, {
          x: e.clientX,
          y: e.clientY,
          duration: 0.15,
          ease: "power2.out",
        });
      }
    };

    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  // Expose a global function to animate cursor to an element
  const animateToElement = useCallback(
    (selector: string, onClick?: () => void) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el || !cursorRef.current) {
        onClick?.();
        return;
      }

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Animate cursor to element center
      gsap.to(cursorRef.current, {
        x: cx,
        y: cy,
        duration: 0.5,
        ease: "back.out(1.7)",
        onComplete: () => {
          // Click flash effect
          if (cursorRef.current) {
            gsap.fromTo(
              cursorRef.current,
              { scale: 1.4, opacity: 0.9 },
              {
                scale: 0.8,
                opacity: 0.5,
                duration: 0.2,
                ease: "power2.out",
                onComplete: () => {
                  gsap.to(cursorRef.current, {
                    scale: 1,
                    opacity: 0.7,
                    duration: 0.15,
                  });
                  onClick?.();
                },
              },
            );
          } else {
            onClick?.();
          }
        },
      });
    },
    [],
  );

  // Expose the animateToElement globally so voice commands can use it
  useEffect(() => {
    (window as any).__voiceCursorAnimate = animateToElement;

    return () => {
      delete (window as any).__voiceCursorAnimate;
    };
  }, [animateToElement]);

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-[9999]"
      style={{ transform: "translate(-50%, -50%)" }}
      aria-hidden="true"
    >
      {/* Outer ring */}
      <div className="w-8 h-8 rounded-full border-2 border-sakura bg-sakura/20 backdrop-blur-xs" />
      {/* Inner dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sakura shadow-[0_0_6px_#FFB7C5]" />
    </div>
  );
}
