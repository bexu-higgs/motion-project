import { VideoTrack } from '@livekit/react-native';
import type { TrackReference } from '@livekit/components-react';
import { StyleSheet } from 'react-native';
import type { ShareTrackRef } from './VoiceProvider';

/** iOS/Android: бөлісілген браузер қойындысының бейнесі. */
export function ScreenShareView({ share }: { share: ShareTrackRef }) {
  return <VideoTrack trackRef={share as unknown as TrackReference} objectFit="contain" style={StyleSheet.absoluteFill} />;
}
