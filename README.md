# TripWhiz (HackRU Fall 2024 Submission)

## How to Run

Setup repository:
```bash
git clone git clone https://github.com/yashc73080/TripWiz.git
cd TripWiz/tripwiz
```

Setup the backend (will use the ```tripwiz/backend``` directory):
```bash
cd backend
conda create --name tripwiz python=3.11
conda activate tripwiz
pip install -r requirements.txt
```

Setup the frontend (will use the ```tripwiz``` directory):
```bash
npm install
```

Start the backend (in ```tripwiz/backend``` directory):
```bash
python app.py
```

Start the frontend (in ```tripwiz``` directory):
```bash
npm run dev
```

## About the Project
Our journey to creating TripWhiz began with a simple yet relatable problem. One day, our group members struggled to coordinate a beach trip that involved multiple stops. We realized how challenging it was to optimize our route and manage our time efficiently for multiple destinations. This sparked an idea: wouldn’t it be great to have an itinerary planner that could streamline our travels and help us visit multiple places without too much trouble? So, the idea of TripWhiz was born.

## What We Learned
Through this project, we learned valuable lessons about teamwork and the importance of user-centric design. We discovered how crucial it is to understand travelers' needs and preferences to create a truly useful application. Additionally, we gained hands-on experience with various technologies and programming languages, which broadened our skill set and enhanced our problem-solving abilities.

## How We Built Our Project
To bring TripWhiz to life, we utilized the Google Cloud Platform and its APIs to enhance functionality. For the front end, we chose Next.js and React.js to create a responsive and user-friendly interface. We implemented Python with Flask on the backend, allowing us to handle data efficiently and serve user requests smoothly.

## Challenges Faced
One of the major challenges we encountered was integrating various APIs while ensuring optimal performance. In addition, we had to deal with data security issues and develop an algorithm to optimize the route, which required meticulous preparation and execution. However, through collaboration and diligent troubleshooting, we were able to overcome these challenges and provide a product that we are pleased of.

## Built With
- HTML/CSS
- JavaScript (Next.js, React.js)
- Python (OpenAI, Flask)
- Google Maps API from Google Cloud Platform
