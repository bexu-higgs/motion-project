/** YouTube IFrame API ойнатқышының күй кодтары. */
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** YouTube тек осы жылдамдықтарды қолдайды — сондықтан синхрондау тек секіру арқылы. */
export const YT_PLAYER_VARS = {
  playsinline: 1,
  controls: 0,
  disablekb: 1,
  rel: 0,
  modestbranding: 1,
  iv_load_policy: 3,
  fs: 0,
} as const;

/** Нативте WebView ішінде ашылатын HTML: ресми IFrame API, хабарламалар ReactNativeWebView арқылы. */
export function youtubeHtml(videoId: string, origin: string, locale: string): string {
  const vars = JSON.stringify({ ...YT_PLAYER_VARS, origin, hl: locale });
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}#player{position:absolute;inset:0;width:100%;height:100%}</style>
</head><body><div id="player"></div>
<script>
var player=null;
function send(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function snapshot(type){return {type:type,time:player.getCurrentTime()||0,duration:player.getDuration()||0,state:player.getPlayerState()};}
function onYouTubeIframeAPIReady(){
  player=new YT.Player('player',{videoId:${JSON.stringify(videoId)},playerVars:${vars},events:{
    onReady:function(){send(snapshot('ready'));setInterval(function(){send(snapshot('time'));},500);},
    onStateChange:function(){send(snapshot('state'));},
    onError:function(e){send({type:'error',code:e.data});}
  }});
}
window.birgeCommand=function(c){
  if(!player||!player.playVideo)return;
  if(c.type==='play')player.playVideo();
  else if(c.type==='pause')player.pauseVideo();
  else if(c.type==='seek')player.seekTo(c.time,true);
  else if(c.type==='mute'){c.muted?player.mute():player.unMute();}
};
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
</script></body></html>`;
}
