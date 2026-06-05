import { create } from 'zustand';

/** Camera permission / connection phases, for showing the right video placeholder */
export const MEDIA_STATUS = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DENIED: 'DENIED',
  FAILED: 'FAILED',
} as const;

export type MediaStatus = (typeof MEDIA_STATUS)[keyof typeof MEDIA_STATUS];

/** Local + remote media streams and connection status, for the live video tiles */
type MediaState = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  status: MediaStatus;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setStatus: (status: MediaStatus) => void;
  reset: () => void;
};

/** Media store, for local/remote camera streams and their connection status */
export const useMediaStore = create<MediaState>((set) => ({
  localStream: null,
  remoteStream: null,
  status: MEDIA_STATUS.IDLE,
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setStatus: (status) => set({ status }),
  reset: () => set({ localStream: null, remoteStream: null, status: MEDIA_STATUS.IDLE }),
}));
