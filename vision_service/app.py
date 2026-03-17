from fastapi import FastAPI
from pydantic import BaseModel
from ultralytics import YOLO
from PIL import Image
import base64
import io
import time

app = FastAPI()
model = YOLO("yolov8n.pt")


class DetectRequest(BaseModel):
    image_base64: str


@app.post("/detect")
def detect(req: DetectRequest):
    started = time.time()
    data = base64.b64decode(req.image_base64)
    image = Image.open(io.BytesIO(data)).convert("RGB")
    result = model(image, verbose=False)[0]
    names = result.names or {}
    person_count = 0
    phone_count = 0
    detections = []

    for box in result.boxes:
        cls = int(box.cls[0].item()) if hasattr(box.cls[0], "item") else int(box.cls[0])
        name = names.get(cls, str(cls))
        if name == "person":
            person_count += 1
        if name == "cell phone":
            phone_count += 1
        detections.append(name)

    return {
        "personCount": person_count,
        "phoneCount": phone_count,
        "labels": detections,
        "inferenceMs": int((time.time() - started) * 1000),
    }
