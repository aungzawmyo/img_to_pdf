"use client";

import { useEffect, useRef } from "react";
import { mountBookMaker } from "@/lib/bookMaker";
import { BOOK_MAKER_MARKUP } from "@/components/bookMakerTemplate";

export default function BookMakerApp() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.innerHTML = BOOK_MAKER_MARKUP;
    return mountBookMaker(el);
  }, []);

  return <div ref={root} className="book-maker-root" />;
}