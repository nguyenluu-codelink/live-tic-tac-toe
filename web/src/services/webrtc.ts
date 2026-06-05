import { buildIceServers } from '@/lib/env';
import { EVENT } from '@/types/events';
import { useSocketStore } from '@/stores/socketStore';
import { MEDIA_STATUS, useMediaStore } from '@/stores/mediaStore';

// Module-level peer connection + queue, holding the single active WebRTC session
let peer: RTCPeerConnection | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
// Cached local-stream promise so the camera is acquired once and reused by both preview and peer
let localStreamPromise: Promise<MediaStream | null> | null = null;

/** Emit a signaling payload to the peer via the relay server, for the offer/answer/ICE exchange */
const emitSignal = (event: string, payload: unknown): void => {
  useSocketStore.getState().socket?.emit(event, payload);
};

/** Drain ICE candidates buffered before the remote description was set, to avoid dropping them */
const flushPendingCandidates = async (): Promise<void> => {
  if (peer === null) {
    return;
  }
  for (const candidate of pendingCandidates) {
    // Re-check each iteration, since closePeer may run between awaits
    if (peer === null) {
      return;
    }
    await peer.addIceCandidate(candidate);
  }
  pendingCandidates = [];
};

/** Acquire the local camera once and cache the promise, for reuse by both the self-preview and the peer */
const ensureLocalStream = async (): Promise<MediaStream | null> => {
  // Reuse the in-flight or resolved acquisition so the camera is never prompted twice
  if (localStreamPromise !== null) {
    return localStreamPromise;
  }
  localStreamPromise = (async () => {
    try {
      // Video only (audio off) to avoid echo when both peers run on one machine during demos
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      useMediaStore.getState().setLocalStream(stream);
      return stream;
    } catch {
      // Permission denied or no camera: continue without a local track
      useMediaStore.getState().setStatus(MEDIA_STATUS.DENIED);
      return null;
    }
  })();
  return localStreamPromise;
};

/** Start the local self-preview on entering a room, so the player sees their camera before pairing */
export const startLocalPreview = async (): Promise<void> => {
  await ensureLocalStream();
};

/** Close just the RTCPeerConnection (not the camera), for resetting a stale session before re-pairing */
const resetPeerConnection = (): void => {
  if (peer !== null) {
    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.oniceconnectionstatechange = null;
    peer.close();
    peer = null;
  }
  pendingCandidates = [];
};

/** Start the WebRTC session, creating the peer and (if initiator) sending the offer, for live video pairing */
export const startPeer = async (initiator: boolean): Promise<void> => {
  // Reset only the stale peer, keeping the already-running local preview stream intact
  resetPeerConnection();

  peer = new RTCPeerConnection({ iceServers: buildIceServers() });

  // Forward our local ICE candidates to the other peer through the relay
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      emitSignal(EVENT.RTC_ICE, event.candidate.toJSON());
    }
  };

  // Surface the remote stream to the video tile when tracks arrive
  peer.ontrack = (event) => {
    // Take the first (and only) stream the remote track belongs to, since one stream is added per peer
    const [remoteStream] = event.streams;
    useMediaStore.getState().setRemoteStream(remoteStream);
    useMediaStore.getState().setStatus(MEDIA_STATUS.CONNECTED);
  };

  // Reflect failed/disconnected transport in the media status for the placeholder
  peer.oniceconnectionstatechange = () => {
    const iceState = peer?.iceConnectionState;
    if (iceState === 'failed' || iceState === 'disconnected') {
      useMediaStore.getState().setStatus(MEDIA_STATUS.FAILED);
    }
  };

  // Attach local tracks (if the camera was granted) so the peer can render us; reuses the preview stream
  const localStream = await ensureLocalStream();
  // Bail out if the session was torn down during the getUserMedia await, to avoid a null deref
  if (peer === null) {
    return;
  }
  if (localStream) {
    for (const track of localStream.getTracks()) {
      peer.addTrack(track, localStream);
    }
  }

  // The designated initiator creates and sends the offer
  if (initiator) {
    const offer = await peer.createOffer();
    // Re-check after the async createOffer, since closePeer may have run
    if (peer === null) {
      return;
    }
    await peer.setLocalDescription(offer);
    emitSignal(EVENT.RTC_OFFER, offer);
  }
};

/** Handle a remote offer by answering, for the non-initiator side of the handshake */
export const handleRemoteOffer = async (offer: RTCSessionDescriptionInit): Promise<void> => {
  if (peer === null) {
    return;
  }
  await peer.setRemoteDescription(offer);
  await flushPendingCandidates();
  // Re-check after the awaits before creating the answer, in case the session closed
  if (peer === null) {
    return;
  }
  const answer = await peer.createAnswer();
  // Re-check after createAnswer before setting the local description
  if (peer === null) {
    return;
  }
  await peer.setLocalDescription(answer);
  emitSignal(EVENT.RTC_ANSWER, answer);
};

/** Handle a remote answer, completing the handshake on the initiator side */
export const handleRemoteAnswer = async (answer: RTCSessionDescriptionInit): Promise<void> => {
  if (peer === null) {
    return;
  }
  await peer.setRemoteDescription(answer);
  await flushPendingCandidates();
};

/** Handle a remote ICE candidate, queuing it if the remote description is not set yet */
export const handleRemoteIce = async (candidate: RTCIceCandidateInit): Promise<void> => {
  if (peer === null) {
    return;
  }
  // Buffer candidates until the remote description exists, to avoid InvalidStateError
  if (peer.remoteDescription === null) {
    pendingCandidates.push(candidate);
    return;
  }
  await peer.addIceCandidate(candidate);
};

/** Close the peer and stop local tracks, for releasing the camera when a match ends */
export const closePeer = (): void => {
  resetPeerConnection();
  // Stop local camera tracks so the device light turns off
  const localStream = useMediaStore.getState().localStream;
  localStream?.getTracks().forEach((track) => track.stop());
  // Clear both streams from the store so no video element binds a dead source
  useMediaStore.getState().setLocalStream(null);
  useMediaStore.getState().setRemoteStream(null);
  // Drop the cached stream so the next room re-acquires a fresh camera
  localStreamPromise = null;
};
