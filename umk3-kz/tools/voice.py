"""Replace UMK3 SNES voice clips with new recordings.
Each sound = marker '60 FF 40' + BRR stream made of END-terminated chunks (played at ~6000 Hz).
A replacement keeps the exact byte layout (same chunks/blocks), so nothing else in the ROM moves."""
import numpy as np, json, re, wave, subprocess, os
from scipy.signal import resample_poly
import brr
RATE = 6000

def chunks_of(rom, start, end):
    """list of (offset, nblocks) for END-terminated chunks between start and end"""
    out = []; i = start
    while i < end:
        j = i; n = 0
        while True:
            n += 1
            if rom[j] & 1: break
            j += 9
        out.append((i, n)); i = j + 9
    return out

def load_audio(path):
    """any format -> float mono at RATE (uses ffmpeg if available for non-wav)"""
    if not path.lower().endswith('.wav'):
        tmp = path + '.tmp.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', '48000', tmp], check=True)
        path = tmp
    w = wave.open(path); sr = w.getframerate(); ch = w.getnchannels(); sw = w.getsampwidth()
    raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, {1: np.uint8, 2: np.int16, 4: np.int32}[sw]).astype(float)
    if sw == 1: x = (x - 128) * 256
    if sw == 4: x = x / 65536
    x = x.reshape(-1, ch).mean(1)
    from math import gcd
    g = gcd(RATE, sr); x = resample_poly(x, RATE // g, sr // g)
    return x

def prepare(x, n_samples):
    # trim leading/trailing silence, normalise, fit length
    thr = 0.02 * np.abs(x).max()
    nz = np.nonzero(np.abs(x) > thr)[0]
    if len(nz): x = x[max(0, nz[0] - 60): nz[-1] + 120]
    if len(x) > n_samples:      # speed up a little if needed (max 20%), else cut
        ratio = len(x) / n_samples
        if ratio <= 1.2:
            x = resample_poly(x, n_samples, len(x))[:n_samples]
        else:
            x = x[:n_samples]
    x = x / (np.abs(x).max() + 1e-9) * 26000
    return np.pad(x, (0, n_samples - len(x)))

def _dec_block(hdr_shift, filt, nibs, p1, p2):
    out = []
    for s in nibs:
        v = (s << hdr_shift) >> 1 if hdr_shift <= 12 else (-2048 if s < 0 else 0)
        if filt == 1: v += p1 + ((-p1) >> 4)
        elif filt == 2: v += (p1 << 1) + ((-3 * p1) >> 5) - p2 + (p2 >> 4)
        elif filt == 3: v += (p1 << 1) + ((-13 * p1) >> 6) - p2 + ((p2 * 3) >> 4)
        v = max(-32768, min(32767, v)); v = ((v << 1) & 0xffff); v = v - 0x10000 if v >= 0x8000 else v; v >>= 1
        out.append(v); p2, p1 = p1, v
    return out, p1, p2

def encode_chunk(x, nblocks):
    """encode len(x)==16*nblocks samples into BRR bytes, END flag on last block"""
    out = bytearray(); p1 = p2 = 0
    for b in range(nblocks):
        seg = x[b*16:(b+1)*16]; best = None
        filters = (0,) if b == 0 else (0, 1, 2, 3)
        for f in filters:
            for sh in range(0, 13):
                q1, q2 = p1, p2; nibs = []; err = 0
                for s in seg:
                    if f == 0: pred = 0
                    elif f == 1: pred = q1 + ((-q1) >> 4)
                    elif f == 2: pred = (q1 << 1) + ((-3 * q1) >> 5) - q2 + (q2 >> 4)
                    else: pred = (q1 << 1) + ((-13 * q1) >> 6) - q2 + ((q2 * 3) >> 4)
                    d = (s / 2 - pred / 2)
                    n = int(round(d / (1 << sh) * 2)) if sh > 0 else int(round(d * 2))
                    n = max(-8, min(7, n))
                    v, q1n, q2n = _dec_block(sh, f, [n], q1, q2)
                    err += (v[0] - s) ** 2; nibs.append(n); q2, q1 = q1, v[0]
                if best is None or err < best[0]: best = (err, f, sh, nibs, q1, q2)
        _, f, sh, nibs, p1, p2 = best
        hdr = (sh << 4) | (f << 2) | (1 if b == nblocks - 1 else 0)
        out.append(hdr)
        for k in range(0, 16, 2): out.append(((nibs[k] & 15) << 4) | (nibs[k+1] & 15))
    return bytes(out)

def replace(rom, sound, audio_path):
    """sound: dict from voice_catalog.json; returns new rom bytes"""
    rom = bytearray(rom)
    chunks = chunks_of(rom, sound['rom_start'], sound['rom_end'])
    total = sum(n for _, n in chunks) * 16
    x = prepare(load_audio(audio_path), total - 16)       # keep the leading silent block
    x = np.concatenate([np.zeros(16), x])
    pos = 0
    for off, n in chunks:
        enc = encode_chunk(x[pos:pos + n*16], n); pos += n*16
        rom[off:off + len(enc)] = enc
    return bytes(rom)
