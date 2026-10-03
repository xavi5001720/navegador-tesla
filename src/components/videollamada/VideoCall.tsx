"use client";

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from "react";
import type Peer from "peerjs";
import type { MediaConnection } from "peerjs";

export interface PeerVideoCallHandle {
  startCall: (targetId: string) => Promise<void>;
  hangUp: () => void;
}

interface PeerVideoCallProps {
  myId: string;
  onCallStateChange: (state: "idle" | "calling" | "ringing" | "in-call", peerId?: string) => void;
  onError: (errorMsg: string) => void;
}

export const PeerVideoCall = forwardRef<PeerVideoCallHandle, PeerVideoCallProps>(
  function PeerVideoCall({ myId, onCallStateChange, onError }, ref) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const callRef = useRef<MediaConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [isPeerReady, setIsPeerReady] = useState(false);

    const getLocalStream = useCallback(async () => {
      if (localStreamRef.current) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    }, []);

    const hangUp = useCallback(() => {
      callRef.current?.close();
      callRef.current = null;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      onCallStateChange("idle");
    }, [onCallStateChange]);

    // Inicializar PeerJS con el ID asignado
    useEffect(() => {
      if (!myId) return;

      let peerInstance: Peer | null = null;

      // Importar dinámicamente peerjs para evitar SSR issues en Next.js
      import("peerjs").then(({ default: PeerJS }) => {
        // Formatear ID a minusculas/limpio para PeerJS (ej: vtes-a3k9bz72)
        const cleanId = `vtes-${myId.replace("-", "").toLowerCase()}`;
        
        peerInstance = new PeerJS(cleanId, {
          debug: 1,
        });

        peerRef.current = peerInstance;

        peerInstance.on("open", () => {
          setIsPeerReady(true);
        });

        peerInstance.on("call", async (incomingCall) => {
          try {
            onCallStateChange("ringing", incomingCall.peer);
            const stream = await getLocalStream();
            incomingCall.answer(stream);
            callRef.current = incomingCall;

            incomingCall.on("stream", (remoteStream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
              onCallStateChange("in-call", incomingCall.peer);
            });

            incomingCall.on("close", () => {
              hangUp();
            });

            incomingCall.on("error", (err) => {
              console.error("Call error:", err);
              onError("Error en la videollamada");
              hangUp();
            });
          } catch (err) {
            console.error("Error al contestar llamada:", err);
            onError("No se pudo acceder a la cámara/micrófono para contestar.");
            hangUp();
          }
        });

        peerInstance.on("error", (err) => {
          console.error("PeerJS error:", err);
          if (err.type === "peer-not-found") {
            onError("El dispositivo destino no está conectado o el ID es incorrecto.");
          } else {
            onError("Error de conexión de red.");
          }
          onCallStateChange("idle");
        });
      });

      return () => {
        peerInstance?.destroy();
        peerRef.current = null;
      };
    }, [myId, getLocalStream, hangUp, onCallStateChange, onError]);

    useImperativeHandle(ref, () => ({
      startCall: async (targetId: string) => {
        if (!peerRef.current || !isPeerReady) {
          onError("Conectando servicio de red, inténtalo de nuevo en unos segundos...");
          return;
        }

        try {
          const stream = await getLocalStream();
          const cleanTargetId = `vtes-${targetId.replace("-", "").toLowerCase()}`;
          const mediaCall = peerRef.current.call(cleanTargetId, stream);
          callRef.current = mediaCall;

          onCallStateChange("calling", cleanTargetId);

          mediaCall.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            onCallStateChange("in-call", cleanTargetId);
          });

          mediaCall.on("close", () => {
            hangUp();
          });

          mediaCall.on("error", (err) => {
            console.error("Media call error:", err);
            onError("Error al realizar la llamada.");
            hangUp();
          });
        } catch (err) {
          console.error("Error al iniciar llamada:", err);
          onError("No se pudo acceder a la cámara/micrófono.");
          onCallStateChange("idle");
        }
      },

      hangUp,
    }));

    return (
      <div style={{ position: "relative", width: "100%", maxWidth: 800, margin: "0 auto" }}>
        {/* Vídeo remoto — grande */}
        <video
          ref={remoteVideoRef}
          id="video-remote"
          autoPlay
          playsInline
          style={{
            width: "100%",
            borderRadius: "1.5rem",
            background: "#111",
            minHeight: 360,
            objectFit: "cover",
          }}
        />
        {/* Vídeo local — pequeño, esquina */}
        <video
          ref={localVideoRef}
          id="video-local"
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            bottom: "1rem",
            right: "1rem",
            width: "28%",
            maxWidth: 200,
            borderRadius: "1rem",
            border: "2px solid rgba(227,25,55,0.7)",
            background: "#000",
            objectFit: "cover",
          }}
        />
      </div>
    );
  }
);
