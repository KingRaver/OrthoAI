#!/usr/bin/env python3
import base64
import contextlib
import io
import json
import math
import os
import sys
import time
import wave
from typing import Any, Dict, List, Tuple

import numpy as np
import whisper


def emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def wav_bytes_to_float32(wav_bytes: bytes) -> Tuple[np.ndarray, int]:
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        sample_rate = wav_file.getframerate()
        channels = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()
        frame_bytes = wav_file.readframes(wav_file.getnframes())

    if sample_width == 1:
        audio = (np.frombuffer(frame_bytes, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif sample_width == 2:
        audio = np.frombuffer(frame_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 4:
        audio = np.frombuffer(frame_bytes, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {sample_width}")

    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)

    return audio, sample_rate


def resample_linear(audio: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    if from_rate == to_rate or audio.size == 0:
        return audio

    duration = audio.shape[0] / from_rate
    new_length = max(1, int(round(duration * to_rate)))

    old_times = np.linspace(0.0, duration, num=audio.shape[0], endpoint=False)
    new_times = np.linspace(0.0, duration, num=new_length, endpoint=False)

    return np.interp(new_times, old_times, audio).astype(np.float32)


def segment_confidence(segment: Dict[str, Any]) -> float:
    avg_logprob = float(segment.get("avg_logprob", -0.7))
    no_speech_prob = float(segment.get("no_speech_prob", 0.0))
    log_prob_score = math.exp(min(0.0, avg_logprob))
    return clamp(log_prob_score * (1.0 - clamp(no_speech_prob, 0.0, 1.0)), 0.0, 1.0)


def aggregate_confidence(segments: List[Dict[str, Any]], fallback: float) -> float:
    if not segments:
        return clamp(fallback, 0.0, 1.0)

    weighted_sum = 0.0
    total_weight = 0.0

    for segment in segments:
        start = float(segment.get("start", 0.0))
        end = float(segment.get("end", start))
        text = str(segment.get("text", ""))
        confidence = float(segment.get("confidence", fallback))

        duration_weight = max(0.2, end - start)
        text_weight = max(0.2, len(text) / 20.0)
        weight = duration_weight + text_weight

        weighted_sum += confidence * weight
        total_weight += weight

    if total_weight <= 0:
        return clamp(fallback, 0.0, 1.0)

    return clamp(weighted_sum / total_weight, 0.0, 1.0)


def main() -> int:
    model_name = os.getenv("WHISPER_MODEL", "small")
    device = os.getenv("WHISPER_DEVICE", "cpu")

    startup_start = time.perf_counter()
    try:
        model = whisper.load_model(model_name, device=device)
    except Exception as error:  # noqa: BLE001
        emit({
            "event": "error",
            "success": False,
            "error": f"Failed to load Whisper model '{model_name}': {error}"
        })
        return 1

    emit({
        "event": "ready",
        "success": True,
        "model": model_name,
        "device": device,
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

            if command != "transcribe":
                emit({
                    "id": request_id,
                    "success": False,
                    "error": f"Unsupported command: {command}"
                })
                continue

            audio_b64 = payload.get("audio_b64")
            if not isinstance(audio_b64, str) or len(audio_b64) == 0:
                emit({
                    "id": request_id,
                    "success": False,
                    "error": "audio_b64 is required"
                })
                continue

            transcribe_start = time.perf_counter()
            audio_bytes = base64.b64decode(audio_b64)
            audio, sample_rate = wav_bytes_to_float32(audio_bytes)
            audio = resample_linear(audio, sample_rate, 16000)

            decode_options: Dict[str, Any] = {
                "task": "transcribe",
                "temperature": 0.0,
                "fp16": False,
                "verbose": False
            }

            language = payload.get("language")
            if isinstance(language, str) and language.strip():
                decode_options["language"] = language.strip()

            with contextlib.redirect_stdout(io.StringIO()):
                result = model.transcribe(audio, **decode_options)
            text = str(result.get("text", "")).strip()
            language_out = str(result.get("language", language or "en"))

            raw_segments = result.get("segments") or []
            normalized_segments: List[Dict[str, Any]] = []
            for segment in raw_segments:
                if not isinstance(segment, dict):
                    continue
                confidence = segment_confidence(segment)
                normalized_segments.append({
                    "start": float(segment.get("start", 0.0)),
                    "end": float(segment.get("end", 0.0)),
                    "text": str(segment.get("text", "")).strip(),
                    "confidence": confidence,
                    "avg_logprob": float(segment.get("avg_logprob", -0.7)),
                    "no_speech_prob": float(segment.get("no_speech_prob", 0.0))
                })

            fallback_confidence = 0.75 if text else 0.0
            confidence = aggregate_confidence(normalized_segments, fallback_confidence)

            emit({
                "id": request_id,
                "success": True,
                "text": text,
                "language": language_out,
                "confidence": confidence,
                "segments": normalized_segments,
                "duration_ms": int((time.perf_counter() - transcribe_start) * 1000)
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
