# AI Remote Classroom (Hackathon build)

Features: WebRTC live class, AI notes (Gemini), Tamil doubt bot (notes-grounded), low-bandwidth auto audio-only.

## Run
```
cd server && npm i && cp .env.example .env   # GEMINI_API_KEY podu (aistudio.google.com)
npm start                                    # http://localhost:3001
cd ../client && npm i && npm run dev         # http://localhost:5173
```
Teacher: tab 1 -> "Teacher". Students: tab 2 -> "Student" (same room).
Low-bandwidth test: Student tab DevTools > Network > "Slow 3G". "Force low data" button um irukku demo ku.
Teacher mic transcript = Chrome Web Speech API (lang ta-IN / en-IN select pannalam).

College logo: client/public/logo.png (PNG, transparent bg best) save pannu.
