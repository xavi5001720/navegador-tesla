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
  answerCall: () => Promise<void>;
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
    const incomingCallRef = useRef<MediaConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isPeerReady, setIsPeerReady] = useState(false);

    const [needsTapToPlay, setNeedsTapToPlay] = useState(false);

    useEffect(() => {
      if (localVideoRef.current && localStream) {
        const videoEl = localVideoRef.current;
        videoEl.muted = true;
        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.srcObject = localStream;
        videoEl.play().catch((e) => console.log("Local play error:", e));
      }
    }, [localStream]);

    useEffect(() => {
      if (remoteVideoRef.current && remoteStream) {
        const videoEl = remoteVideoRef.current;
        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.srcObject = remoteStream;

        const attemptPlay = () => {
          const playPromise = videoEl.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => setNeedsTapToPlay(false))
              .catch((e) => {
                console.log("Remote play error (mobile gesture needed):", e);
                setNeedsTapToPlay(true);
              });
          }
        };

        attemptPlay();

        // Escuchar si se añaden tracks de vídeo/audio posteriormente
        remoteStream.onaddtrack = () => {
          console.log("[WebRTC] Nuevo track añadido al stream remoto");
          videoEl.srcObject = remoteStream;
          attemptPlay();
        };
      }
    }, [remoteStream]);

    const getLocalStream = useCallback(async () => {
      if (localStreamRef.current) return localStreamRef.current;
      
      let stream: MediaStream;
      try {
        // Intentar vídeo + audio con restricciones flexibles
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("Fallo al capturar vídeo+audio, intentando fallback:", error);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch {
          // Si falla vídeo, intentar solo audio
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
        }
      }

      console.log("[WebRTC] Stream local obtenido:", stream.getTracks().map(t => t.kind));
      localStreamRef.current = stream;
      setLocalStream(stream);
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
      setLocalStream(null);
      setRemoteStream(null);
      setNeedsTapToPlay(false);
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
          debug: 2,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:openrelay.metered.ca:80" },
              { urls: "turn:openrelay.metered.ca:80", username: "openrelay", credential: "openrelay" },
              { urls: "turn:openrelay.metered.ca:443", username: "openrelay", credential: "openrelay" },
              { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelay", credential: "openrelay" },
            ],
          },
        });

        peerRef.current = peerInstance;

        peerInstance.on("open", () => {
          setIsPeerReady(true);
        });

        peerInstance.on("call", (incomingCall) => {
          incomingCallRef.current = incomingCall;
          const callerId = incomingCall.peer.replace("vtes-", "").toUpperCase();
          onCallStateChange("ringing", callerId);
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
      answerCall: async () => {
        const incomingCall = incomingCallRef.current;
        if (!incomingCall) return;

        try {
          const stream = await getLocalStream();
          incomingCall.answer(stream);
          callRef.current = incomingCall;

          incomingCall.on("stream", (rs) => {
            setRemoteStream(rs);
            const callerId = incomingCall.peer.replace("vtes-", "").toUpperCase();
            onCallStateChange("in-call", callerId);
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
      },

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

          mediaCall.on("stream", (rs) => {
            setRemoteStream(rs);
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
        {needsTapToPlay && (
          <button
            onClick={() => {
              remoteVideoRef.current?.play().then(() => setNeedsTapToPlay(false)).catch(() => {});
              localVideoRef.current?.play().catch(() => {});
            }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              padding: "1rem 2rem",
              borderRadius: "99px",
              background: "#10b981",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            🔊 Toca aquí para ver/escuchar la llamada
          </button>
        )}
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
