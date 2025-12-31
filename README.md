# Pathwise

## How to Run

Setup repository:
```bash
git clone git clone https://github.com/yashc73080/Pathwise.git
cd Pathwise
```

Setup the backend (will use the ```Pathwise/backend``` directory):
```bash
cd backend
conda create --name trip python=3.11
conda activate trip
pip install -r requirements.txt
```

Setup the frontend (will use the ```Pathwise/frontend``` directory):
```bash
npm install
```

Start the backend (in ```Pathwise/backend``` directory):
```bash
python app.py
```

Start the frontend (in ```Pathwise/frontend``` directory):
```bash
npm run dev
```

## About the Project
My journey to creating Pathwise began with a simple yet relatable problem. One day, I struggled to coordinate a beach trip that involved multiple stops. I realized how challenging it was to optimize my route and manage my time efficiently for multiple destinations. This sparked an idea: wouldn’t it be great to have an itinerary planner that could streamline my travels and help me visit multiple places without too much trouble? So, the idea of Pathwise was born.

## How We Built Our Project
To bring Pathwise to life, I utilized the Google Cloud Platform and its APIs to enhance functionality. For the front end, I chose Next.js and React.js to create a responsive and user-friendly interface. I implemented Python with Flask on the backend, allowing me to handle data efficiently and serve user requests smoothly.

## Built With
- HTML/CSS
- JavaScript (Next.js, React.js)
- Python (OpenAI, Flask)
- Google Maps API from Google Cloud Platform
