import { useEffect, useRef } from 'react';
import type { ShareTrackRef } from './VoiceProvider';

/** Веб: бөлісілген қойындының бейнесі (дыбысы VoiceProvider-де бөлек ойнайды). */
export function ScreenShareView({ share }: { share: ShareTrackRef }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const track = share.publication.track;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      data-testid="screen-share"
      autoPlay
      playsInline
      muted
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
    />
  );
}
