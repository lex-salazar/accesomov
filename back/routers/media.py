import asyncio
import base64
import io
import groq
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from core import ai
from models import AudioBase64Request

router = APIRouter(tags=["media"])


@router.post("/transcribir", summary="Transcribe audio de voz a texto con Whisper (Groq)")
async def transcribir(audio: UploadFile = File(...)):
    content = await audio.read()
    if len(content) < 500:
        raise HTTPException(400, "Audio demasiado corto o vacío")
    try:
        transcription = await ai.client.audio.transcriptions.create(
            file=(audio.filename or "audio.m4a", content, audio.content_type or "audio/m4a"),
            model="whisper-large-v3-turbo",
            language="es",
            prompt="Nombre de colonia, calle o lugar en Tlalpan, Ciudad de México.",
            response_format="json",
        )
        return {"texto": transcription.text.strip()}
    except groq.APIError as e:
        raise HTTPException(502, f"Error Whisper: {e.message}")
    except Exception as e:
        raise HTTPException(500, f"Error al transcribir: {e}")


@router.post("/transcribir-b64", summary="Transcribe audio en base64 (usado por la app móvil)")
async def transcribir_b64(req: AudioBase64Request):
    try:
        audio_bytes = base64.b64decode(req.audio_b64)
    except Exception:
        raise HTTPException(400, "audio_b64 inválido")
    if len(audio_bytes) < 500:
        raise HTTPException(400, "Audio demasiado corto")
    try:
        transcription = await ai.client.audio.transcriptions.create(
            file=("audio.m4a", audio_bytes, req.mime),
            model="whisper-large-v3-turbo",
            language="es",
            prompt="Habla en español. Colonia, calle o lugar en Tlalpan, Ciudad de México.",
            response_format="json",
        )
        return {"texto": transcription.text.strip()}
    except groq.APIError as e:
        raise HTTPException(502, f"Error Whisper: {e.message}")
    except Exception as e:
        raise HTTPException(500, f"Error al transcribir: {e}")


@router.get("/tts", summary="Text-to-speech en español via gTTS")
async def tts(text: str):
    clean = text.strip()[:200]
    if not clean:
        raise HTTPException(400, "Texto vacío")
    try:
        from gtts import gTTS
        loop = asyncio.get_event_loop()

        def _gen():
            t = gTTS(text=clean, lang="es", slow=False)
            b = io.BytesIO()
            t.write_to_fp(b)
            b.seek(0)
            return b

        buf = await loop.run_in_executor(None, _gen)
        return StreamingResponse(buf, media_type="audio/mpeg",
                                 headers={"Cache-Control": "no-store"})
    except Exception as e:
        raise HTTPException(500, f"TTS error: {e}")
