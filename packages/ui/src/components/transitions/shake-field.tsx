"use client";

import type * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";

import { forceReflow, prefersReducedMotion } from "./motion-utils.js";

export interface ShakeFieldHandle {
  shake: () => void;
}

export interface ShakeFieldProps {
  isError?: boolean;
  errorMessage?: string | null;
  children: React.ReactNode;
  className?: string;
  /** Ref to the bordered element that should shake (defaults to wrap). */
  inputClassName?: string;
  ref?: React.Ref<ShakeFieldHandle>;
}

/**
 * Error-state shake wrapper. Toggle `isError` for border/message; call `shake()` to replay.
 */
export function ShakeField({
  isError = false,
  errorMessage,
  children,
  className,
  inputClassName,
  ref,
}: ShakeFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    shake() {
      const el = inputRef.current;
      if (!el || prefersReducedMotion()) return;
      el.classList.remove("is-shaking");
      forceReflow(el);
      el.classList.add("is-shaking");
    },
  }));

  useEffect(() => {
    if (!isError) return;
    const el = inputRef.current;
    if (!el || prefersReducedMotion()) return;
    el.classList.remove("is-shaking");
    forceReflow(el);
    el.classList.add("is-shaking");
  }, [isError, errorMessage]);

  return (
    <div
      ref={wrapRef}
      className={`t-input-wrap${isError ? " is-error" : ""}${className ? ` ${className}` : ""}`}
    >
      <div
        ref={inputRef}
        className={`t-input${isError ? " is-error" : ""}${inputClassName ? ` ${inputClassName}` : ""}`}
      >
        {children}
      </div>
      {errorMessage ? <p className="t-error-msg text-sm text-[var(--color-danger)]">{errorMessage}</p> : null}
    </div>
  );
}
