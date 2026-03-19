# PersonaChat AI 🤖

PersonaChat AI is a persona-based conversational chatbot that combines Machine Learning and Generative AI to deliver personalized and context-aware responses.  
Instead of replying in a fixed tone, the system adapts its behavior based on different personas such as Rishi, Woman, Teacher, and Gen Z.

---

## 🚀 Features

- 🔹 Multiple AI personas with different communication styles  
- 🔹 Separate chat memory for each persona  
- 🔹 Text-based interaction with real-time responses  
- 🔹 Persona classification using Machine Learning  
- 🔹 AI-powered responses using Google Gemini API  
- 🔹 Chat persistence using localStorage  
- 🔹 Export chat as PDF  
- 🔹 Conversation summary (AI-generated)  
- 🔹 Mood detection for better response tone  

---

## 🛠️ Tech Stack

### Frontend
- React.js (with Vite)
- TypeScript
- Tailwind CSS

### Backend
- Python
- Flask
- Flask-CORS

### Machine Learning
- Scikit-learn
- Custom labeled dataset

### AI Integration
- Google Gemini API

### Additional Tools
- Web Speech API (optional voice features)
- jsPDF (chat export)
- LocalStorage (chat persistence)

---

## 🧠 How It Works

1. User selects a persona and sends a message  
2. The message is sent to the backend  
3. ML model predicts the most suitable persona  
4. Persona context is added to the prompt  
5. Gemini API generates a response  
6. Response is shown in UI and stored locally  

---

## 📂 Project Structures 

chatbot-baba/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Message.tsx
│   │   │
│   │   ├── services/
│   │   │   └── geminiService.ts
│   │   │
│   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── constants/
│   │   │   └── personas.ts
│   │   │
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.local
│
├── ml_persona_model/
│   ├── app.py
│   ├── model.pkl
│   ├── dataset.csv
│   ├── train_model.py
│   └── requirements.txt
│
├── README.md
└── .gitignore

---

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/your-username/personachat-ai.git
cd personachat-ai


#2. Frontend Setup

npm install
npm run dev


##3. Backend Setup (ML Server)
cd ml_persona_model
pip install -r requirements.txt
python app.py

##4. Add API Key
Create a .env.local file in frontend:
VITE_GEMINI_API_KEY=your_api_key_here

📊 Use Cases
💬 Smart chatbot systems
🎓 Educational assistants
🧠 Mental support interaction
🤖 AI-based user engagement systems


🔮 Future Scope
Database integration
Multi-user authentication
Cloud deployment
Emotion-aware AI responses
Mobile application


👨‍💻 Author
Suman Mandal
B.Tech CSE Student


⭐ Contribution
Feel free to fork this project and improve it. Contributions are always welcome!

