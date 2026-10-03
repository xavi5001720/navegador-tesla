"use client";

import { useState, useCallback, useEffect } from "react";

export interface Contact {
  id: string;
  alias: string;
  code: string;
}

const STORAGE_KEY = "tesla-call-contacts";

function loadContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function useAgenda() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const saveContacts = (newList: Contact[]) => {
    setContacts(newList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
  };

  const addContact = useCallback((alias: string, code: string) => {
    const formattedCode = code.trim().toUpperCase();
    if (!alias.trim() || formattedCode.length !== 9) return;

    setContacts((prev) => {
      // Si ya existe el código, actualizar el alias
      const existingIdx = prev.findIndex((c) => c.code === formattedCode);
      let updated: Contact[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], alias: alias.trim() };
      } else {
        const newContact: Contact = {
          id: Date.now().toString(),
          alias: alias.trim(),
          code: formattedCode,
        };
        updated = [newContact, ...prev];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { contacts, addContact, removeContact };
}
