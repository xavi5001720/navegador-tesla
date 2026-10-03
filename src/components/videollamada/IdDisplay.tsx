"use client";

import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import styles from "./IdDisplay.module.css";

interface IdDisplayProps {
  myId: string;
  onRegenerate: () => void;
}

export function IdDisplay({ myId, onRegenerate }: IdDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(myId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para Tesla browser
      const ta = document.createElement("textarea");
      ta.value = myId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [myId]);

  const callUrl = typeof window !== "undefined"
    ? `${window.location.origin}/videollamada?call=${myId}`
    : `https://viajandoentesla.es/videollamada?call=${myId}`;

  return (
    <div className={styles.container}>
      <p className={styles.label}>Tu ID de llamada</p>

      <div className={styles.idBox}>
        <span className={styles.idText}>{myId}</span>
      </div>

      <div className={styles.actions}>
        <button
          id="btn-copy-id"
          className={styles.btnSecondary}
          onClick={handleCopy}
        >
          {copied ? "✓ Copiado" : "Copiar ID"}
        </button>
        <button
          id="btn-regenerate-id"
          className={styles.btnGhost}
          onClick={onRegenerate}
          title="Generar un ID nuevo"
        >
          ↺ Nuevo ID
        </button>
      </div>

      <div className={styles.qrWrapper}>
        <p className={styles.qrLabel}>
          Escanea desde la app Android para llamar directamente
        </p>
        <div className={styles.qrContainer}>
          <QRCodeSVG
            value={callUrl}
            size={160}
            bgColor="transparent"
            fgColor="#e8e8e8"
            level="M"
          />
        </div>
      </div>
    </div>
  );
}
