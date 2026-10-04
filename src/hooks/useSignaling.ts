"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "https://tesla-signal.railway.app";

export type SignalData =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "hangup" };

interface UseSignalingOptions {
  myId: string;
  onSignal: (fromId: string, data: SignalData) => void;
  onPeerConnected?: (fromId: string) => void;
}

export function useSignaling({ myId, onSignal, onPeerConnected }: UseSignalingOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!myId) return;

    const socket = io(SIGNALING_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("register", myId);
    });

    socket.on("signal", ({ fromId, data }: { fromId: string; data: SignalData }) => {
      if (data.type === "offer" && onPeerConnected) {
        onPeerConnected(fromId);
      }
      onSignal(fromId, data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myId, onSignal, onPeerConnected]);

  const sendSignal = useCallback((targetId: string, data: SignalData) => {
    socketRef.current?.emit("signal", { targetId, data });
  }, []);

  return { sendSignal };
}
