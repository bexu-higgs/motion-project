import { useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { PlayerHandle, PlayerProps } from './types';
import { YT_STATE, youtubeHtml } from './youtube';

interface YtSnapshot {
  time: number;
  duration: number;
  state: number;
  at: number;
}

/**
 * iOS/Android: YouTube-тың ресми ендірілген ойнатқышы (IFrame API) WebView ішінде.
 * YouTube талаптары бойынша ойнатқыштың үстіне ештеңе жабылмайды.
 */
export function YouTubePlayer({ item, ref, origin, locale, onReady, onEnded, onError }: PlayerProps) {
  const webRef = useRef<{ injectJavaScript(script: string): void } | null>(null);
  const snap = useRef<YtSnapshot>({ time: 0, duration: 0, state: YT_STATE.UNSTARTED, at: Date.now() });
  const html = useMemo(() => youtubeHtml(item.src, origin, locale), [item.src, origin, locale]);

  const command = (c: Record<string, unknown>) => {
    webRef.current?.injectJavaScript(`window.birgeCommand(${JSON.stringify(c)});true;`);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: { type: string; time?: number; duration?: number; state?: number };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'error') return onError();
    const prev = snap.current.state;
    snap.current = { time: msg.time ?? 0, duration: msg.duration ?? 0, state: msg.state ?? prev, at: Date.now() };
    if (msg.type === 'ready') onReady();
    if (msg.type === 'state' && msg.state === YT_STATE.ENDED && prev !== YT_STATE.ENDED) onEnded();
  };

  useImperativeHandle(
    ref,
    (): PlayerHandle => ({
      canAdjustRate: false,
      getCurrentTime: () => {
        const s = snap.current;
        // Хабарламалар 0.5 с сайын келеді — арасын есептеп толтырамыз.
        return s.state === YT_STATE.PLAYING ? s.time + (Date.now() - s.at) / 1000 : s.time;
      },
      getDuration: () => snap.current.duration,
      isPlaying: () => snap.current.state === YT_STATE.PLAYING || snap.current.state === YT_STATE.BUFFERING,
      play: () => command({ type: 'play' }),
      pause: () => command({ type: 'pause' }),
      seekTo: (time) => {
        snap.current = { ...snap.current, time, at: Date.now() };
        command({ type: 'seek', time });
      },
      setRate: () => undefined,
      setMuted: (muted) => command({ type: 'mute', muted }),
    }),
    [],
  );

  return (
    <WebView
      {...({ ref: webRef } as object)}
      style={StyleSheet.absoluteFill}
      containerStyle={{ backgroundColor: '#000' }}
      source={{ html, baseUrl: origin }}
      originWhitelist={['*']}
      onMessage={onMessage}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      scrollEnabled={false}
      bounces={false}
      setSupportMultipleWindows={false}
      // Жарнама немесе сілтеме басылса — WebView ішінде ашпаймыз.
      onShouldStartLoadWithRequest={(req: { url: string }) =>
        req.url === 'about:blank' ||
        req.url.startsWith(origin) ||
        req.url.includes('youtube.com/') ||
        req.url.includes('youtube-nocookie.com/')
      }
    />
  );
}
