"use client";

import { useState, useCallback } from "react";

// Caracteres sin ambigüedad: sin O/0, I/1, L
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 8;
const STORAGE_KEY = "tesla-call-id";

function generateId(): string {
  const chars: string[] = [];
  for (let i = 0; i < ID_LENGTH; i++) {
    chars.push(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
  }
  // Insertar guion en posición 4: XXXX-XXXX
  chars.splice(4, 0, "-");
  return chars.join("");
}

function getOrCreateId(): string {
  if (typeof window === "undefined") return generateId();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.length === 9) return stored; // 8 chars + guion
  const newId = generateId();
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
}

export function useMyId() {
  const [myId, setMyId] = useState<string>(() => getOrCreateId());

  const regenerateId = useCallback(() => {
    const newId = generateId();
    localStorage.setItem(STORAGE_KEY, newId);
    setMyId(newId);
  }, []);

  return { myId, regenerateId };
}
