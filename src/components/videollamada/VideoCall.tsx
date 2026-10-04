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
  callState: "idle" | "calling" | "ringing" | "in-call";
  onCallStateChange: (state: "idle" | "calling" | "ringing" | "in-call", peerId?: string) => void;
  onError: (errorMsg: string) => void;
}

export const PeerVideoCall = forwardRef<PeerVideoCallHandle, PeerVideoCallProps>(
  function PeerVideoCall({ myId, callState, onCallStateChange, onError }, ref) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localCanvasRef = useRef<HTMLCanvasElement>(null);
    const remoteCanvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    const peerRef = useRef<Peer | null>(null);
    const callRef = useRef<MediaConnection | null>(null);
    const incomingCallRef = useRef<MediaConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isPeerReady, setIsPeerReady] = useState(false);
    const [needsTapToPlay, setNeedsTapToPlay] = useState(false);

    const hasLocalVideo = localStream ? localStream.getVideoTracks().length > 0 : true;

    // Obtener la cámara/micrófono local
    const getLocalStream = useCallback(async () => {
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        if (tracks.length > 0 && tracks.every((t) => t.readyState === "live")) {
          return localStreamRef.current;
        }
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: true,
        });
      } catch (err: unknown) {
        console.warn("[WebRTC] Fallo al capturar vídeo con ideales, intentando básico:", err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (err2: unknown) {
          console.warn("[WebRTC] Fallo vídeo+audio, intentando solo audio:", err2);
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          onError("⚠️ No se detectó cámara en este dispositivo. Se continuará sólo con audio.");
        }
      }

      stream.getTracks().forEach((t) => {
        t.enabled = true;
      });

      console.log(
        "[WebRTC] Stream local obtenido:",
        stream.getTracks().map((t) => `${t.kind}:${t.readyState}`)
      );
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    }, [onError]);

    // Pre-cargar el stream local al sonar (ringing)
    useEffect(() => {
      if (callState === "ringing") {
        getLocalStream().catch((e) => console.warn("[WebRTC] Error pre-cargando stream:", e));
      }
    }, [callState, getLocalStream]);

    // Asignación de streams a elementos hidden video
    useEffect(() => {
      if (callState !== "idle" && localVideoRef.current && localStream) {
        const videoEl = localVideoRef.current;
        videoEl.muted = true;
        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.srcObject = localStream;
        videoEl.play().catch((e) => console.log("[WebRTC] Local video play catch:", e));
      }
    }, [callState, localStream]);

    useEffect(() => {
      if (callState !== "idle" && remoteVideoRef.current && remoteStream) {
        const videoEl = remoteVideoRef.current;
        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.srcObject = remoteStream;

        videoEl
          .play()
          .then(() => setNeedsTapToPlay(false))
          .catch((e) => {
            console.log("[WebRTC] Remote video play catch:", e);
            setNeedsTapToPlay(true);
          });

        // Enlazar audio usando WebAudio API para evitar restricciones de reproductor de vídeo en Tesla
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass && !audioCtxRef.current) {
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;
            if (remoteStream.getAudioTracks().length > 0) {
              const source = audioCtx.createMediaStreamSource(remoteStream);
              source.connect(audioCtx.destination);
            }
          }
          if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume().catch(() => setNeedsTapToPlay(true));
          }
        } catch (e) {
          console.warn("[WebAudio] Error al inicializar AudioContext:", e);
        }
      }
    }, [callState, remoteStream]);

    // RENDERIZADO CANVAS EN BUCLE (Bypasses Tesla OS video player block)
    useEffect(() => {
      let animId: number;

      const renderLoop = () => {
        // 1. Renderizar Vídeo Remoto en Canvas
        if (remoteVideoRef.current && remoteCanvasRef.current) {
          const video = remoteVideoRef.current;
          const canvas = remoteCanvasRef.current;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
          }
        }

        // 2. Renderizar Vídeo Local en Canvas (Esquina)
        if (localVideoRef.current && localCanvasRef.current) {
          const video = localVideoRef.current;
          const canvas = localCanvasRef.current;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
          }
        }

        animId = requestAnimationFrame(renderLoop);
      };

      if (callState !== "idle") {
        animId = requestAnimationFrame(renderLoop);
      }

      return () => {
        if (animId) cancelAnimationFrame(animId);
      };
    }, [callState]);

    const hangUp = useCallback(() => {
      callRef.current?.close();
      callRef.current = null;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }

      setLocalStream(null);
      setRemoteStream(null);
      setNeedsTapToPlay(false);
      onCallStateChange("idle");
    }, [onCallStateChange]);

    // Inicializar PeerJS con servidores STUN y TURN globales redundantes
    useEffect(() => {
      if (!myId) return;

      let peerInstance: Peer | null = null;

      import("peerjs").then(({ default: PeerJS }) => {
        const cleanId = `vtes-${myId.replace("-", "").toLowerCase()}`;

        peerInstance = new PeerJS(cleanId, {
          debug: 2,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
              { urls: "stun:stun3.l.google.com:19302" },
              { urls: "stun:stun4.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
              { urls: "turn:openrelay.metered.ca:80", username: "openrelay", credential: "openrelay" },
              { urls: "turn:openrelay.metered.ca:443", username: "openrelay", credential: "openrelay" },
              { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelay", credential: "openrelay" },
              { urls: "turns:openrelay.metered.ca:443?transport=tcp", username: "openrelay", credential: "openrelay" },
            ],
            iceCandidatePoolSize: 10,
          },
        });

        peerRef.current = peerInstance;

        peerInstance.on("open", () => {
          setIsPeerReady(true);
        });

        peerInstance.on("call", (incomingCall) => {
          incomingCallRef.current = incomingCall;
          const callerId = incomingCall.peer.replace("vtes-", "").toUpperCase();

          incomingCall.on("stream", (rs) => {
            console.log("[WebRTC] Stream remoto recibido en incomingCall:", rs.getTracks());
            setRemoteStream(rs);
            onCallStateChange("in-call", callerId);
          });

          incomingCall.on("close", () => {
            hangUp();
          });

          incomingCall.on("error", (err) => {
            console.error("Incoming call error:", err);
            onError("Error en la conexión con el otro dispositivo.");
            hangUp();
          });

          onCallStateChange("ringing", callerId);
        });

        peerInstance.on("error", (err) => {
          console.error("PeerJS error:", err);
          if (err.type === "peer-unavailable") {
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
            console.log("[WebRTC] Stream remoto en answerCall:", rs.getTracks());
            setRemoteStream(rs);
            onCallStateChange("in-call", incomingCall.peer.replace("vtes-", "").toUpperCase());
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
            console.log("[WebRTC] Stream remoto en startCall:", rs.getTracks());
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
        {/* Elementos de vídeo Ocultos (Receptores en memoria del Stream WebRTC) */}
        <video
          ref={remoteVideoRef}
          id="video-remote-hidden"
          autoPlay
          playsInline
          style={{ position: "absolute", width: 1, height: 1, opacity: 0.001, pointerEvents: "none" }}
        />
        <video
          ref={localVideoRef}
          id="video-local-hidden"
          autoPlay
          playsInline
          muted
          style={{ position: "absolute", width: 1, height: 1, opacity: 0.001, pointerEvents: "none" }}
        />

        {needsTapToPlay && (
          <button
            onClick={() => {
              if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
                audioCtxRef.current.resume().catch(() => {});
              }
              if (remoteVideoRef.current) {
                remoteVideoRef.current
                  .play()
                  .then(() => setNeedsTapToPlay(false))
                  .catch(() => {});
              }
              if (localVideoRef.current) {
                localVideoRef.current.play().catch(() => {});
              }
            }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 30,
              padding: "1.2rem 2.5rem",
              borderRadius: "99px",
              background: "#10b981",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1.1rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 30px rgba(0,0,0,0.7)",
            }}
          >
            🔊 Toca aquí para ver y escuchar la llamada
          </button>
        )}

        {/* Canvas Remoto (Renderizado 2D/WebGL directo en pantalla, omitiendo bloqueo de <video> en Tesla OS) */}
        <canvas
          ref={remoteCanvasRef}
          id="canvas-remote"
          style={{
            width: "100%",
            borderRadius: "1.5rem",
            background: "#111",
            minHeight: 360,
            aspectRatio: "16/9",
            objectFit: "cover",
            display: "block",
          }}
        />

        {/* Canvas Local (Miniatura en esquina) */}
        <div
          style={{
            position: "absolute",
            bottom: "1rem",
            right: "1rem",
            width: "28%",
            maxWidth: 200,
            borderRadius: "1rem",
            border: "2px solid rgba(227,25,55,0.7)",
            background: "#000",
            overflow: "hidden",
            aspectRatio: "4/3",
            zIndex: 10,
          }}
        >
          <canvas
            ref={localCanvasRef}
            id="canvas-local"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          {!hasLocalVideo && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1f2937",
                color: "#9ca3af",
                fontSize: "0.75rem",
                textAlign: "center",
                padding: "0.5rem",
              }}
            >
              📷 Sin cámara
            </div>
          )}
        </div>
      </div>
    );
  }
);

