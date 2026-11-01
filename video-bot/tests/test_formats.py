import pytest

from videobot.formats import NothingFits, all_options, audio_options, best_audio, select, video_options

MB = 1024 * 1024


def v(fid, w, h, vcodec, size, fps=30, note=None, **extra):
    return {"format_id": fid, "width": w, "height": h, "vcodec": vcodec, "acodec": "none", "fps": fps,
            "filesize": size, "format_note": note or f"{min(w, h)}p", "ext": "mp4", **extra}  # fmt: skip


def a(fid, acodec, size, abr, ext="m4a", **extra):
    return {"format_id": fid, "vcodec": "none", "acodec": acodec, "abr": abr, "filesize": size, "ext": ext, **extra}


YOUTUBE = [
    {"format_id": "sb0", "format_note": "storyboard", "ext": "mhtml", "protocol": "mhtml",
     "vcodec": "none", "acodec": "none"},
    a("139", "mp4a.40.5", 1 * MB, 48),
    a("140", "mp4a.40.2", 3 * MB, 129),
    a("140-drc", "mp4a.40.2", 3 * MB, 129),
    a("251", "opus", 4 * MB, 160, ext="webm"),
    a("140-1", "mp4a.40.2", 3 * MB, 129, language_preference=-1),  # дубляж
    {"format_id": "18", "width": 640, "height": 360, "vcodec": "avc1.42001E", "acodec": "mp4a.40.2",
     "fps": 30, "filesize": 9 * MB, "format_note": "360p", "ext": "mp4"},
    v("134", 640, 360, "avc1.4d401e", 5 * MB),
    v("298", 1280, 720, "avc1.4d4020", 20 * MB, fps=60, note="720p60"),
    v("302", 1280, 720, "vp9", 18 * MB, fps=60, note="720p60"),
    v("299", 1920, 1080, "avc1.64002a", 45 * MB, fps=60, note="1080p60"),
    v("303", 1920, 1080, "vp9", 40 * MB, fps=60, note="1080p60"),
    v("399", 1920, 1080, "av01.0.09M.08", 30 * MB, fps=60, note="1080p60"),
    v("308", 2560, 1440, "vp9", 120 * MB, fps=60, note="1440p60"),
    v("400", 2560, 1440, "av01.0.12M.08", 90 * MB, fps=60, note="1440p60"),
    v("334", 2560, 1440, "vp9.2", 150 * MB, fps=60, note="1440p60 HDR", dynamic_range="HDR10"),
    v("315", 3840, 2160, "vp9", 300 * MB, fps=60, note="2160p60"),
]  # fmt: skip


def test_youtube_qualities_are_listed_high_to_low():
    options = video_options(YOUTUBE)
    assert [o.label for o in options] == ["2160p60", "1440p60", "1080p60", "720p60", "360p"]
    by_key = {o.key: o for o in options}
    assert by_key["v1080"].format == "299+140"  # Telegram үшін H.264 басым
    assert by_key["v1440"].format == "308+140"  # H.264 жоқ: VP9 > AV1, HDR емес
    assert by_key["v2160"].format == "315+140"
    assert by_key["v1080"].size == 48 * MB  # видео + аудио


def test_audio_options():
    options = audio_options(YOUTUBE, duration=600)
    assert [(o.key, o.format) for o in options] == [("mp3", "251"), ("m4a", "140")]
    assert options[0].size == 192 * 125 * 600
    assert best_audio(YOUTUBE)["format_id"] == "140"  # түпнұсқа, drc емес, m4a


def test_original_language_track_is_preferred():
    formats = [a("140-0", "mp4a.40.2", 3 * MB, 129, language_preference=-1),
               a("140-1", "mp4a.40.2", 3 * MB, 129, language_preference=10)]  # fmt: skip
    assert best_audio(formats)["format_id"] == "140-1"


def test_vertical_video_uses_short_side():
    formats = [{"format_id": "x", "width": 1080, "height": 1920, "vcodec": "h264", "acodec": "aac", "ext": "mp4"}]
    [option] = video_options(formats)
    assert option.label == "1080p" and option.format == "x"


def test_tiktok_watermarked_format_is_skipped():
    formats = [
        {"format_id": "download", "width": 1080, "height": 1920, "vcodec": "h264", "acodec": "aac",
         "format_note": "watermarked", "filesize": 9 * MB},
        {"format_id": "bytevc2_1080p", "width": 1080, "height": 1920, "vcodec": "bytevc2", "acodec": "aac",
         "format_note": "(UNPLAYABLE)"},
        {"format_id": "play_addr-0", "width": 720, "height": 1280, "vcodec": "h265", "acodec": "aac",
         "format_note": "Direct video", "filesize": 4 * MB},
        {"format_id": "play_addr_h264-0", "width": 720, "height": 1280, "vcodec": "h264", "acodec": "aac",
         "format_note": "Direct video", "filesize": 5 * MB},
    ]  # fmt: skip
    option = select(formats, "best", 50 * MB)
    assert option.format == "play_addr_h264-0"


def test_only_watermarked_available_is_still_downloaded():
    formats = [{"format_id": "download", "width": 576, "height": 1024, "vcodec": "h264", "acodec": "aac",
                "format_note": "watermarked"}]  # fmt: skip
    assert select(formats, "best", 50 * MB).format == "download"


def test_best_respects_limit_and_below():
    assert select(YOUTUBE, "best", 50 * MB).key == "v1080"
    assert select(YOUTUBE, "best", 1000 * MB).key == "v2160"
    assert select(YOUTUBE, "best", 1000 * MB, below=1080).key == "v720"
    with pytest.raises(NothingFits) as info:
        select(YOUTUBE, "best", 1 * MB)
    assert info.value.smallest == 9 * MB  # 360p: дыбысы бар 18-формат


def test_select_specific_quality_with_fallback():
    assert select(YOUTUBE, "v720", 50 * MB).format == "298+140"
    assert select(YOUTUBE, "v900", 50 * MB).key == "v720"  # жоқ сапа — одан төмен ең жақыны
    assert select(YOUTUBE, "mp3", 50 * MB).key == "mp3"
    assert select(YOUTUBE, "m4a", 50 * MB).format == "140"


def test_equal_formats_follow_ytdlp_order():
    # Facebook: өлшемі белгісіз «sd» мен «hd» — yt-dlp «hd»-ны жақсырақ деп соңына қояды.
    formats = [
        {"format_id": "sd", "vcodec": None, "acodec": None, "ext": "mp4"},
        {"format_id": "hd", "vcodec": None, "acodec": None, "ext": "mp4"},
    ]
    assert select(formats, "best", 50 * MB).format == "hd"
    audio = [a("a1", "mp4a.40.2", None, None), a("a2", "mp4a.40.2", None, None)]
    assert best_audio(audio)["format_id"] == "a2"


def test_progressive_only_site():
    formats = [
        {"format_id": "sd", "vcodec": None, "acodec": None, "ext": "mp4", "format_note": "SD"},
        {"format_id": "hd", "vcodec": None, "acodec": None, "ext": "mp4", "height": 720, "width": 1280},
    ]
    options = all_options(formats)
    assert [o.key for o in options] == ["v720", "v0", "mp3"]
    assert options[-1].format == "ba/b"
