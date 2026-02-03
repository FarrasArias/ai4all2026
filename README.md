
# ai4all (or 414411 or aiaaii :P)

## Prereqs
- Python 3.10+
- Node 18+ and npm
- **Ollama** installed and running (`ollama serve`) and at least one model pulled (e.g. `ollama pull llama3`).
- NVIDIA GPU + NVML (optional) for GPU power readings.

## Installation (Windows for now):

### Backend
- On command line
- cd backend
- python -m venv .venv 
- .venv\Scripts\activate
- pip install -r requirements.txt
- uvicorn server:app --host 0.0.0.0 --port 8000 --reload

### Frontend
- On command line
- cd energy-chat-dashboard
- npm i
- npm run dev

## Starting the app
Double click on `start_app.cmd` in the root folder or
- cd backend
- python -m venv .venv 
- .venv/bin/activate
- uvicorn server:app --host 0.0.0.0 --port 8000 --reload

- cd energy-chat-dashboard
- npm run dev


## Notes
- Any issues, send an email to raa60@sfu.ca
