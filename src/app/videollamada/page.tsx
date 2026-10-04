"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMyId } from "@/hooks/useMyId";
import { useAgenda } from "@/hooks/useAgenda";
import { IdDisplay } from "@/components/videollamada/IdDisplay";
import { PeerVideoCall, PeerVideoCallHandle } from "@/components/videollamada/VideoCall";
import { ContactAgenda } from "@/components/videollamada/ContactAgenda";
import { PromotionalBanners } from "@/components/videollamada/PromotionalBanners";
import styles from "./videollamada.module.css";

type CallState = "idle" | "calling" | "ringing" | "in-call";

export default function VideollamadaPage() {
  const { myId, regenerateId } = useMyId();
  const { contacts, addContact, removeContact } = useAgenda();
  const [callState, setCallState] = useState<CallState>("idle");
  const [targetInput, setTargetInput] = useState("");
  const [activePeerId, setActivePeerId] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const videoCallRef = useRef<PeerVideoCallHandle>(null);

  const handleLog = useCallback((msg: string) => {
    setLogs((prev) => [msg, ...prev.slice(0, 49)]);
  }, []);

  // Detectar ?call=XXXX-XXXX en la URL (para QR escaneado)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callTarget = params.get("call");
    if (callTarget) {
      setTargetInput(callTarget.toUpperCase());
    }
  }, []);

  const handleCallStateChange = useCallback(
    (state: CallState, peerId?: string) => {
      setCallState(state);
      if (peerId) {
        setActivePeerId(peerId.replace("vtes-", "").toUpperCase());
      }
      if (state === "idle") {
        setActivePeerId("");
      }
    },
    []
  );

  const handleError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const handleCall = useCallback(async () => {
    const tid = targetInput.trim().toUpperCase();
    if (tid.length !== 9) {
      setError("El ID debe tener el formato XXXX-XXXX (8 caracteres)");
      return;
    }
    setError("");
    await videoCallRef.current?.startCall(tid);
  }, [targetInput]);

  const handleAnswerCall = useCallback(async () => {
    await videoCallRef.current?.answerCall();
  }, []);

  const handleHangUp = useCallback(() => {
    videoCallRef.current?.hangUp();
  }, []);

  const isInCall = callState === "in-call" || callState === "calling" || callState === "ringing";

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <a href="/" className={styles.backLink}>← Volver</a>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>📹</span>
          Videollamada Tesla
        </h1>
        <p className={styles.subtitle}>
          Llama desde tu Tesla a la app Android de Viajando en Tesla
        </p>
      </header>

      <div className={styles.content}>
        {/* Componente de vídeo (siempre montado para inicializar PeerJS en background) */}
        <div style={{ display: isInCall ? "block" : "none" }} className={styles.callScreen}>
          {callState === "calling" && (
            <div className={styles.statusBadge}>
              <span className={styles.pulse} /> Llamando a {targetInput || activePeerId}…
            </div>
          )}
          {callState === "ringing" && (
            <div className={styles.statusBadge}>
              <span className={styles.pulse} /> Llamada entrante de {activePeerId}
            </div>
          )}

          <PeerVideoCall
            ref={videoCallRef}
            myId={myId}
            callState={callState}
            onCallStateChange={handleCallStateChange}
            onError={handleError}
            onLog={handleLog}
          />

          <div className={styles.callActionContainer}>
            {callState === "ringing" ? (
              <div className={styles.ringActions}>
                <button
                  id="btn-answer-call"
                  className={styles.btnAnswer}
                  onClick={handleAnswerCall}
                >
                  🟢 Contestar
                </button>
                <button
                  id="btn-reject-call"
                  className={styles.btnHangUp}
                  onClick={handleHangUp}
                >
                  📵 Rechazar
                </button>
              </div>
            ) : (
              <button
                id="btn-hang-up"
                className={styles.btnHangUp}
                onClick={handleHangUp}
              >
                {callState === "calling" ? "Cancelar" : "📵 Colgar"}
              </button>
            )}
          </div>
        </div>

        {/* Pantalla idle */}
        {!isInCall && (
          <div className={styles.idleScreen}>
            {/* Panel izquierdo: tu ID */}
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Tu dispositivo</h2>
              <IdDisplay myId={myId} onRegenerate={regenerateId} />
            </section>

            {/* Divider */}
            <div className={styles.divider}>
              <span className={styles.dividerText}>↔</span>
            </div>

            {/* Panel derecho: llamar */}
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Llamar a</h2>
              <div className={styles.callForm}>
                <p className={styles.formLabel}>
                  Introduce el ID del otro dispositivo
                </p>
                <input
                  id="input-target-id"
                  className={styles.input}
                  type="text"
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  value={targetInput}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
                    setTargetInput(val);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCall()}
                />
                {error && <p className={styles.error}>{error}</p>}
                <button
                  id="btn-call"
                  className={styles.btnCall}
                  onClick={handleCall}
                  disabled={targetInput.length < 9}
                >
                  📞 Iniciar videollamada
                </button>
              </div>

              <ContactAgenda
                contacts={contacts}
                currentCodeInput={targetInput}
                onSelectContact={(code) => {
                  setTargetInput(code);
                  setError("");
                }}
                onAddContact={addContact}
                onRemoveContact={removeContact}
              />

              <div className={styles.tips}>
                <p className={styles.tipTitle}>¿Cómo funciona?</p>
                <ol className={styles.tipList}>
                  <li>Abre la app Android → sección Videollamada</li>
                  <li>Escanea el QR de esta pantalla, o introduce el ID manualmente</li>
                  <li>¡Listo! Conexión directa entre el coche y el móvil</li>
                </ol>
              </div>
            </section>
          </div>
        )}

        {/* Banners Promocionales (Telegram Tesla Chuches & Viajando en Tesla Portal) */}
        <PromotionalBanners />

        {/* Consola de diagnóstico en vivo */}
        <details className={styles.debugDetails} open>
          <summary className={styles.debugSummary}>📊 Consola de diagnóstico de red en vivo</summary>
          <div className={styles.debugBox}>
            {logs.length === 0 ? (
              <p className={styles.debugEmpty}>Conectando a la red PeerJS...</p>
            ) : (
              logs.map((logLine, idx) => (
                <div key={idx} className={styles.debugLogLine}>
                  {logLine}
                </div>
              ))
            )}
          </div>
        </details>
      </div>

      {/* Nota sobre Tesla */}
      <footer className={styles.footer}>
        <p>⚡ Disponible en Tesla con software 2026.26 o superior · El coche debe estar aparcado</p>
      </footer>
    </main>
  );
}
