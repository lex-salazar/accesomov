import groq
from fastapi import APIRouter, HTTPException
from core import ai
from models import ChatRequest

router = APIRouter(tags=["chat"])


@router.post("/chat", summary="Chat sobre movilidad accesible en Tlalpan")
async def chat(request: ChatRequest):
    msgs = list(request.messages)
    while msgs and msgs[0].role == "assistant":
        msgs.pop(0)
    if not msgs:
        raise HTTPException(422, "No hay mensajes de usuario")
    try:
        resp = await ai.client.chat.completions.create(
            model="llama-3.1-8b-instant", max_tokens=150,
            messages=[
                {"role": "system", "content": ai.chat_system_prompt},
                *[{"role": m.role, "content": m.content} for m in msgs],
            ],
        )
        return {"response": resp.choices[0].message.content.strip()}
    except groq.APIError as e:
        raise HTTPException(502, f"Error Groq: {e.message}")
    except Exception as e:
        raise HTTPException(502, str(e))
