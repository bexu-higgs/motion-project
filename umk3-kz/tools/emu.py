"""Minimal headless libretro frontend (ctypes) for the snes9x core."""
import ctypes as C, os, numpy as np
from PIL import Image
import stable_retro
CORE=os.path.join(os.path.dirname(stable_retro.__file__),'cores','snes9x_libretro.so')

class GameInfo(C.Structure):
    _fields_=[('path',C.c_char_p),('data',C.c_void_p),('size',C.c_size_t),('meta',C.c_char_p)]
class Geometry(C.Structure):
    _fields_=[('base_width',C.c_uint),('base_height',C.c_uint),('max_width',C.c_uint),('max_height',C.c_uint),('aspect',C.c_float)]
class Timing(C.Structure):
    _fields_=[('fps',C.c_double),('sample_rate',C.c_double)]
class AVInfo(C.Structure):
    _fields_=[('geometry',Geometry),('timing',Timing)]

ENV_CB=C.CFUNCTYPE(C.c_bool,C.c_uint,C.c_void_p)
VIDEO_CB=C.CFUNCTYPE(None,C.c_void_p,C.c_uint,C.c_uint,C.c_size_t)
AUDIO_CB=C.CFUNCTYPE(None,C.c_int16,C.c_int16)
AUDIOB_CB=C.CFUNCTYPE(C.c_size_t,C.POINTER(C.c_int16),C.c_size_t)
POLL_CB=C.CFUNCTYPE(None)
STATE_CB=C.CFUNCTYPE(C.c_int16,C.c_uint,C.c_uint,C.c_uint,C.c_uint)

# joypad ids
B,Y,SELECT,START,UP,DOWN,LEFT,RIGHT,A,X,L,R=range(12)
BTN={'B':B,'Y':Y,'SELECT':SELECT,'START':START,'UP':UP,'DOWN':DOWN,'LEFT':LEFT,'RIGHT':RIGHT,'A':A,'X':X,'L':L,'R':R}

class Emu:
    def __init__(self, rom_path):
        self.lib=C.CDLL(CORE)
        self.pixfmt=0; self.frame=None; self.audio=[]; self.buttons=set(); self.buttons2=set()
        self._sysdir=C.c_char_p(os.path.dirname(os.path.abspath(rom_path)).encode())
        def env(cmd,data):
            if cmd==10: # SET_PIXEL_FORMAT
                self.pixfmt=C.cast(data,C.POINTER(C.c_int))[0]; return True
            if cmd in (9,31): # SYSTEM_DIRECTORY / SAVE_DIRECTORY
                C.cast(data,C.POINTER(C.c_char_p))[0]=self._sysdir.value; return True
            if cmd==3: # GET_CAN_DUPE
                C.cast(data,C.POINTER(C.c_bool))[0]=True; return True
            return False
        def video(data,w,h,pitch):
            if not data: return
            buf=(C.c_uint8*(pitch*h)).from_address(data)
            a=np.frombuffer(buf,dtype=np.uint16).reshape(h,pitch//2)[:,:w].copy()
            self.frame=a
        def audio(l,r): self.audio.append((l,r))
        def audiob(ptr,n):
            arr=np.ctypeslib.as_array(ptr,shape=(n*2,)).copy(); self.audio.append(arr); return n
        def poll(): pass
        def state(port,dev,idx,id_):
            if dev!=1: return 0
            s=self.buttons if port==0 else self.buttons2
            return 1 if id_ in s else 0
        self._cbs=[ENV_CB(env),VIDEO_CB(video),AUDIO_CB(audio),AUDIOB_CB(audiob),POLL_CB(poll),STATE_CB(state)]
        L=self.lib
        L.retro_set_environment(self._cbs[0]); L.retro_init()
        L.retro_set_video_refresh(self._cbs[1]); L.retro_set_audio_sample(self._cbs[2])
        L.retro_set_audio_sample_batch(self._cbs[3]); L.retro_set_input_poll(self._cbs[4]); L.retro_set_input_state(self._cbs[5])
        self.romdata=open(rom_path,'rb').read()
        self._rombuf=C.create_string_buffer(self.romdata,len(self.romdata))
        gi=GameInfo(rom_path.encode(),C.cast(self._rombuf,C.c_void_p),len(self.romdata),None)
        L.retro_load_game.restype=C.c_bool
        assert L.retro_load_game(C.byref(gi)), 'load failed'
        av=AVInfo(); L.retro_get_system_av_info(C.byref(av)); self.av=av
        L.retro_get_memory_data.restype=C.c_void_p; L.retro_get_memory_size.restype=C.c_size_t
        L.retro_serialize_size.restype=C.c_size_t; L.retro_serialize.restype=C.c_bool; L.retro_unserialize.restype=C.c_bool
    def mem(self,id_):
        p=self.lib.retro_get_memory_data(id_); n=self.lib.retro_get_memory_size(id_)
        if not p: return None
        return bytes((C.c_uint8*n).from_address(p))
    def wram(self): return self.mem(2)
    def vram(self): return self.mem(3)
    def run(self,n=1,buttons=None):
        if buttons is not None: self.buttons={BTN[b] if isinstance(b,str) else b for b in buttons}
        for _ in range(n): self.lib.retro_run()
    def press(self,btns,hold=4,after=20):
        self.run(hold,btns); self.run(after,[])
    def save(self):
        n=self.lib.retro_serialize_size(); b=C.create_string_buffer(n); self.lib.retro_serialize(b,n); return b.raw
    def load(self,s):
        b=C.create_string_buffer(s,len(s)); self.lib.retro_unserialize(b,len(s))
    def image(self):
        a=self.frame.astype(np.uint32)
        if self.pixfmt==2: r=(a>>11)&31; g=(a>>5)&63; b=a&31; rgb=np.stack([r*255//31,g*255//63,b*255//31],-1)
        else: r=(a>>10)&31; g=(a>>5)&31; b=a&31; rgb=np.stack([r*255//31,g*255//31,b*255//31],-1)
        return Image.fromarray(rgb.astype(np.uint8))
    def shot(self,path,scale=2):
        im=self.image(); im=im.resize((im.width*scale,im.height*scale),Image.NEAREST); im.save(path); return path
    def take_audio(self):
        parts=[np.asarray(x,dtype=np.int16).reshape(-1) if not isinstance(x,tuple) else np.array(x,dtype=np.int16) for x in self.audio]
        self.audio=[]
        return np.concatenate(parts) if parts else np.zeros(0,np.int16)
