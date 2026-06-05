import { useEffect, useRef } from 'react';
import { MEDIA_STATUS, useMediaStore } from '@/stores/mediaStore';

/** VideoTile props, describing one camera tile's stream, label and mute state */
type VideoTileProps = {
  stream: MediaStream | null;
  label: string;
  muted: boolean;
  placeholder: string;
};

/** A single video tile, binding a MediaStream to a video element for live display */
const VideoTile = ({ stream, label, muted, placeholder }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach the stream to the element whenever it changes, since srcObject is not a prop
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg bg-black">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        // Placeholder keeps the layout stable before the stream connects
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{placeholder}</div>
      )}
      {/* Show the Live badge only when an actual stream is playing, so it never sits over a placeholder */}
      {stream && (
        <span className="absolute left-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {label}
        </span>
      )}
    </div>
  );
};

/** Video feeds row, showing the local + remote camera tiles for the live-video half of the demo */
export const VideoFeeds = () => {
  const localStream = useMediaStore((s) => s.localStream);
  const remoteStream = useMediaStore((s) => s.remoteStream);
  const status = useMediaStore((s) => s.status);

  // Choose a remote placeholder message that reflects the connection phase
  const remotePlaceholder = status === MEDIA_STATUS.FAILED ? 'Video unavailable' : 'Connecting…';
  // Distinguish a blocked camera from a not-yet-started one, so denial is never silent
  const localPlaceholder = status === MEDIA_STATUS.DENIED ? 'Camera blocked' : 'Camera off';

  return (
    <div className="flex h-full gap-2">
      <VideoTile stream={localStream} label="You • Live" muted placeholder={localPlaceholder} />
      <VideoTile stream={remoteStream} label="Opponent • Live" muted={false} placeholder={remotePlaceholder} />
    </div>
  );
};
