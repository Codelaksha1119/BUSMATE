# BUSMATE Starter Project

**BUSMATE — Real-Time Local Bus Tracking and Arrival Prediction System**

This starter project includes a React + Vite frontend and a FastAPI backend. The supplied route/timetable records have been entered for Tumkur, Mysore, and Davangere.

## Included data
- **Tumkur:** all 16 local routes supplied by the project team, plus the separately supplied Bus 301 stop sequence (Tumkur → Caltex → Bhimsandra → Heggere → Mallasandra → Gubbi → Nittur).
- **Davangere:** all 4 routes and distances supplied by the project team.
- **Mysore:** all 22 departure-time records, with the provided FROM/TO, service class, and VIA information represented in the frontend and backend data.

Fields that were not included in the supplied data (such as some bus numbers, fares, Tumkur/Davangere departure times, or intermediate stops) are marked as unavailable rather than invented. The supplied route names and lengths are preserved as provided, including Route 207's `5.5/6.7` value.

## Requirements
- Node.js LTS
- Python 3.11+
- VS Code (recommended)
- Internet connection for OpenStreetMap tiles

## Run the frontend
Open a terminal in `frontend` and run:

```bash
npm install
npm run dev
```

Open the localhost URL shown by Vite (usually `http://localhost:5173`).

## Run the backend
Open a second terminal in `backend` and run on Windows:

```powershell
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

## Important project status
This is a starter prototype. Frontend and backend data are currently stored separately and the frontend is not yet connected to the API. Map lines and bus markers are illustrative/simulated, not verified road-following route geometry or live GPS. Real stop coordinates, official fares, and live tracking must be added and verified before the system is described as operational.
