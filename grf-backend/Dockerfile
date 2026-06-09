FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    cmake build-essential libgl1-mesa-dev \
    libsdl2-dev libsdl2-image-dev libsdl2-ttf-dev \
    libsdl2-gfx-dev libboost-all-dev git \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps (gfootball/pygame included for real physics)
RUN pip install --no-cache-dir fastapi uvicorn[standard] websockets numpy gfootball pygame

WORKDIR /app

COPY requirements.txt .
COPY server.py .
COPY match_rules.py .

EXPOSE 8765

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8765"]
