#!/usr/bin/env python3
import base64
import io
import json
import os
import sys
import time
import wave
from typing import Any, Dict

from piper.config import SynthesisConfig
from piper.voice import PiperVoice


def emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def to_float(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def load_voice() -> PiperVoice:
    model_path = os.getenv("PIPER_MODEL_PATH")
    if not model_path:
        raise RuntimeError("PIPER_MODEL_PATH is required")

    config_path = os.getenv("PIPER_CONFIG_PATH") or None
    use_cuda = os.getenv("PIPER_USE_CUDA", "false").lower() == "true"
    return PiperVoice.load(model_path=model_path, config_path=config_path, use_cuda=use_cuda)


def synthesize_wav(voice: PiperVoice, text: str, length_scale: float, volume: float) -> bytes:
    config = SynthesisConfig(length_scale=length_scale, volume=volume)

    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wav_file:
        voice.synthesize_wav(
            text=text,
            wav_file=wav_file,
            syn_config=config,
            set_wav_format=True
        )

    return wav_io.getvalue()


def get_sample_rate(wav_bytes: bytes) -> int:
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        return wav_file.getframerate()


def main() -> int:
    startup_start = time.perf_counter()
    try:
        voice = load_voice()
    except Exception as error:  # noqa: BLE001
        emit({
            "event": "error",
            "success": False,
            "error": f"Failed to load Piper voice: {error}"
        })
        return 1

    emit({
        "event": "ready",
        "success": True,
        "startup_ms": int((time.perf_counter() - startup_start) * 1000)
    })

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id: str | None = None
        try:
            payload = json.loads(line)
            request_id = payload.get("id")
            command = payload.get("command")

            if command != "synthesize":
                emit({
                    "id": request_id,
                    "success": False,
                    "error": f"Unsupported command: {command}"
                })
                continue

            text = str(payload.get("text", "")).strip()
            if not text:
                emit({
                    "id": request_id,
                    "success": False,
                    "error": "Text cannot be empty"
                })
                continue

            length_scale = to_float(payload.get("length_scale"), 0.85)
            volume = to_float(payload.get("volume"), 1.0)

            start = time.perf_counter()
            wav_bytes = synthesize_wav(voice, text, length_scale, volume)
            sample_rate = get_sample_rate(wav_bytes)
            duration_ms = int((time.perf_counter() - start) * 1000)

            emit({
                "id": request_id,
                "success": True,
                "audio_b64": base64.b64encode(wav_bytes).decode("ascii"),
                "sample_rate": sample_rate,
                "duration_ms": duration_ms
            })
        except Exception as error:  # noqa: BLE001
            emit({
                "id": request_id,
                "success": False,
                "error": str(error)
            })

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
