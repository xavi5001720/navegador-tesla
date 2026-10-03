"use client";

import { useState } from "react";
import { Contact } from "@/hooks/useAgenda";
import styles from "./ContactAgenda.module.css";

interface ContactAgendaProps {
  contacts: Contact[];
  onSelectContact: (code: string) => void;
  onAddContact: (alias: string, code: string) => void;
  onRemoveContact: (id: string) => void;
  currentCodeInput: string;
}

export function ContactAgenda({
  contacts,
  onSelectContact,
  onAddContact,
  onRemoveContact,
  currentCodeInput,
}: ContactAgendaProps) {
  const [aliasInput, setAliasInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSave = () => {
    if (!aliasInput.trim() || currentCodeInput.length !== 9) return;
    onAddContact(aliasInput.trim(), currentCodeInput);
    setAliasInput("");
    setShowAddForm(false);
  };

  return (
    <div className={styles.agendaContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span>📖</span> Agenda de contactos
        </h3>
        {currentCodeInput.length === 9 && (
          <button
            type="button"
            className={styles.btnAddToggle}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "Cancelar" : "＋ Guardar ID actual"}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className={styles.addForm}>
          <input
            type="text"
            className={styles.aliasInput}
            placeholder="Nombre (ej: Mi Tesla Model Y)"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            type="button"
            className={styles.btnSave}
            onClick={handleSave}
            disabled={!aliasInput.trim()}
          >
            Guardar
          </button>
        </div>
      )}

      {contacts.length === 0 ? (
        <p className={styles.emptyText}>
          No tienes contactos guardados. Introduce un ID y guárdalo para llamar rápido.
        </p>
      ) : (
        <ul className={styles.contactList}>
          {contacts.map((c) => (
            <li key={c.id} className={styles.contactCard}>
              <div className={styles.contactInfo}>
                <span className={styles.contactAlias}>{c.alias}</span>
                <span className={styles.contactCode}>{c.code}</span>
              </div>
              <div className={styles.contactActions}>
                <button
                  type="button"
                  className={styles.btnCallContact}
                  onClick={() => onSelectContact(c.code)}
                >
                  📞 Llamar
                </button>
                <button
                  type="button"
                  className={styles.btnDeleteContact}
                  onClick={() => onRemoveContact(c.id)}
                  title="Eliminar contacto"
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
