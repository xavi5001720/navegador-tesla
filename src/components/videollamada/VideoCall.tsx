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
  onLog?: (msg: string) => void;
}

export const PeerVideoCall = forwardRef<PeerVideoCallHandle, PeerVideoCallProps>(
  function PeerVideoCall({ myId, callState, onCallStateChange, onError, onLog }, ref) {
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

    const addLog = useCallback(
      (msg: string) => {
        const time = new Date().toLocaleTimeString();
        onLog?.(`[${time}] ${msg}`);
      },
      [onLog]
    );

    // Obtener la cámara/micrófono local
    const getLocalStream = useCallback(async () => {
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        if (tracks.length > 0 && tracks.every((t) => t.readyState === "live")) {
          return localStreamRef.current;
        }
      }

      addLog("🎥 Solicitando permiso de cámara y micrófono...");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        addLog("✅ Cámara HD capturada correctamente");
      } catch (err: unknown) {
        addLog("⚠️ Fallo captura HD, intentando formato estándar...");
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          addLog("✅ Cámara estándar capturada");
        } catch (err2: unknown) {
          addLog("⚠️ Fallo vídeo, intentando solo micrófono...");
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

      addLog(`🎥 Stream local activo: ${stream.getTracks().map((t) => `${t.kind}:${t.readyState}`).join(", ")}`);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    }, [onError, addLog]);

    // Pre-cargar el stream local al sonar (ringing)
    useEffect(() => {
      if (callState === "ringing") {
        addLog("🔔 Llamada sonando: Pre-cargando cámara en segundo plano...");
        getLocalStream().catch((e) => console.warn("[WebRTC] Error pre-cargando stream:", e));
      }
    }, [callState, getLocalStream, addLog]);

    // Asignación de streams a elementos hidden video
    useEffect(() => {
      if (callState !== "idle" && localVideoRef.current && localStream) {
        const videoEl = localVideoRef.current;
        videoEl.muted = true;
        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.srcObject = localStream;
        videoEl.play().catch((e) => addLog(`⚠️ Error al reproducir vídeo local: ${e}`));
      }
    }, [callState, localStream, addLog]);

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
            addLog(`⚠️ Play remoto bloqueado por el navegador: ${e}`);
            setNeedsTapToPlay(true);
          });

        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass && !audioCtxRef.current) {
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;
            if (remoteStream.getAudioTracks().length > 0) {
              const source = audioCtx.createMediaStreamSource(remoteStream);
              source.connect(audioCtx.destination);
              addLog("🔊 AudioContext conectado con éxito al altavoz");
            }
          }
          if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume().catch(() => setNeedsTapToPlay(true));
          }
        } catch (e) {
          addLog(`⚠️ Error WebAudio: ${e}`);
        }
      }
    }, [callState, remoteStream, addLog]);

    // RENDERIZADO CANVAS EN BUCLE
    useEffect(() => {
      let animId: number;
      let hasLoggedRemoteFrame = false;

      const renderLoop = () => {
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
              if (!hasLoggedRemoteFrame) {
                addLog(`🖼️ Primer frame renderizado en Canvas (${video.videoWidth}x${video.videoHeight})`);
                hasLoggedRemoteFrame = true;
              }
            }
          }
        }

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
    }, [callState, addLog]);

    const hangUp = useCallback(() => {
      addLog("📵 Colgando llamada...");
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
    }, [onCallStateChange, addLog]);

    // Función auxiliar para configurar listeners de RTCPeerConnection de forma segura
    const setupPeerConnectionListeners = useCallback(
      (connection: MediaConnection) => {
        try {
          const attach = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pc: RTCPeerConnection | undefined = (connection as any)?.peerConnection;
            if (!pc) return false;

            pc.oniceconnectionstatechange = () => {
              addLog(`🧊 Estado conexión ICE: ${pc.iceConnectionState}`);
              if (pc.iceConnectionState === "failed") {
                onError("❌ Error de red P2P (ICE failed). Reintentando...");
              }
            };

            pc.onicegatheringstatechange = () => {
              addLog(`🔍 Búsqueda de candidatos ICE: ${pc.iceGatheringState}`);
            };

            pc.ontrack = (event) => {
              addLog(`📺 Track WebRTC recibido: ${event.track.kind} (${event.track.readyState})`);
            };

            return true;
          };

          if (!attach()) {
            setTimeout(attach, 100);
            setTimeout(attach, 500);
          }
        } catch (e) {
          console.warn("[WebRTC] Error attaching PC listeners:", e);
        }
      },
      [addLog, onError]
    );

    // Inicializar PeerJS con servidores STUN y TURN globales redundantes
    useEffect(() => {
      if (!myId) return;

      let peerInstance: Peer | null = null;
      const cleanId = `vtes-${myId.replace("-", "").toLowerCase()}`;
      addLog(`🚀 Inicializando PeerJS con ID: ${myId} (${cleanId})`);

      import("peerjs").then(({ default: PeerJS }) => {
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
              { urls: "turn:83.45.86.195:3478", username: "tesla", credential: "password123" },
              { urls: "turn:83.45.86.195:3478?transport=tcp", username: "tesla", credential: "password123" },
              { urls: "turn:openrelay.metered.ca:80", username: "openrelay", credential: "openrelay" },
              { urls: "turn:openrelay.metered.ca:443", username: "openrelay", credential: "openrelay" },
              { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelay", credential: "openrelay" },
              { urls: "turns:openrelay.metered.ca:443?transport=tcp", username: "openrelay", credential: "openrelay" },
            ],
            iceCandidatePoolSize: 10,
          },
        });

        peerRef.current = peerInstance;

        peerInstance.on("open", (id) => {
          addLog(`✅ Servidor PeerJS listo. Registrado como: ${id}`);
          setIsPeerReady(true);
        });

        peerInstance.on("call", (incomingCall) => {
          incomingCallRef.current = incomingCall;
          const callerId = incomingCall.peer.replace("vtes-", "").toUpperCase();
          addLog(`📥 Llamada entrante de: ${callerId}`);

          setupPeerConnectionListeners(incomingCall);

          incomingCall.on("stream", (rs) => {
            addLog(`📺 Stream remoto asignado desde llamadas entrantes (${rs.getTracks().length} tracks)`);
            setRemoteStream(rs);
            onCallStateChange("in-call", callerId);
          });

          incomingCall.on("close", () => {
            addLog("📵 El otro dispositivo ha colgado.");
            hangUp();
          });

          incomingCall.on("error", (err) => {
            addLog(`❌ Error en llamada entrante: ${err}`);
            onError("Error en la conexión con el otro dispositivo.");
            hangUp();
          });

          onCallStateChange("ringing", callerId);
        });

        peerInstance.on("error", (err) => {
          addLog(`❌ Error PeerJS (${err.type}): ${err.message || err}`);
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
    }, [myId, getLocalStream, hangUp, onCallStateChange, onError, addLog, setupPeerConnectionListeners]);

    useImperativeHandle(ref, () => ({
      answerCall: async () => {
        const incomingCall = incomingCallRef.current;
        if (!incomingCall) return;

        addLog("🟢 Contestando llamada...");
        try {
          const stream = await getLocalStream();
          incomingCall.answer(stream);
          callRef.current = incomingCall;
          setupPeerConnectionListeners(incomingCall);

          incomingCall.on("stream", (rs) => {
            addLog(`📺 Stream remoto recibido al contestar (${rs.getTracks().length} tracks)`);
            setRemoteStream(rs);
            onCallStateChange("in-call", incomingCall.peer.replace("vtes-", "").toUpperCase());
          });
        } catch (err) {
          addLog(`❌ Error al contestar: ${err}`);
          onError("No se pudo acceder a la cámara/micrófono para contestar.");
          hangUp();
        }
      },

      startCall: async (targetId: string) => {
        if (!peerRef.current || !isPeerReady) {
          onError("Conectando servicio de red, inténtalo de nuevo en unos segundos...");
          return;
        }

        const cleanTargetId = `vtes-${targetId.replace("-", "").toLowerCase()}`;
        addLog(`📞 Llamando a ID: ${targetId} (${cleanTargetId})...`);

        try {
          const stream = await getLocalStream();
          const mediaCall = peerRef.current.call(cleanTargetId, stream);
          callRef.current = mediaCall;

          onCallStateChange("calling", cleanTargetId);
          setupPeerConnectionListeners(mediaCall);

          mediaCall.on("stream", (rs) => {
            addLog(`📺 Stream remoto recibido desde startCall (${rs.getTracks().length} tracks)`);
            setRemoteStream(rs);
            onCallStateChange("in-call", cleanTargetId);
          });

          mediaCall.on("close", () => {
            addLog("📵 Llamada finalizada.");
            hangUp();
          });

          mediaCall.on("error", (err) => {
            addLog(`❌ Error en llamada saliente: ${err}`);
            onError("Error al realizar la llamada.");
            hangUp();
          });
        } catch (err) {
          addLog(`❌ Error iniciando llamada: ${err}`);
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

