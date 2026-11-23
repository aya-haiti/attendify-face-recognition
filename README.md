# ATTENDIFY

**ATTENDIFY** is a student attendance management system based on facial recognition.

The goal of this academic project is to automate attendance tracking in educational environments by combining computer vision, facial recognition, student management and attendance reporting in a desktop application.

---

## Project Overview

ATTENDIFY allows teachers or administrators to manage students and automatically record attendance using facial recognition.

The system includes:

- Student management
- Face detection and recognition
- Attendance recording
- Attendance history and export
- User authentication
- Model training
- Chatbot assistance
- MySQL database integration

---

## Main Features

### Face Detection and Recognition

ATTENDIFY uses computer vision techniques to detect and identify students from camera input.

Technologies used include:

- OpenCV
- LBPH (Local Binary Patterns Histograms)
- Haar Cascade
- dlib

---

### Student Management

The application allows administrators to:

- Add students
- Update student information
- Delete student records
- Associate student information with facial data

---

### Attendance Management

The system can:

- Automatically register attendance after student recognition
- Store attendance information
- View attendance history
- Export attendance data to CSV

---

### Authentication

ATTENDIFY includes a login system for authorized users such as administrators and teachers.

---

### Model Training

The application provides a training module to generate and update the facial recognition model based on registered students.

---

### Integrated Chatbot

A chatbot module is included to assist users while interacting with the application.

---

## System Architecture

The project is divided into several modules:

```text
ATTENDIFY/
│
├── main.py
│   Main dashboard and application interface
│
├── login.py
│   Authentication system
│
├── Student.py
│   Student management
│
├── train.py
│   Facial recognition model training
│
├── face_recognition.py
│   Face detection and recognition
│
├── attendance.py
│   Attendance management
│
├── chatbot.py
│   Integrated chatbot
│
├── database.py
│   Database connection and operations
│
├── developper.py
│   Developer information
│
├── attendance_systeme/
│   Attendance system resources
│
├── face_recognition/
│   Facial recognition modules
│
├── chatbot_images/
│   Chatbot interface resources
│
├── login_images/
│   Login interface resources
│
├── developer_images/
│   Developer interface resources
│
├── help_images/
│   Help interface resources
│
├── icones/
│   Application icons and graphical resources
│
├── classifier/
│   Generated recognition models
│
└── attendance.csv
    Attendance export file


## Download & setup

Each [GitHub Release](https://github.com/aya-haiti/attendify-face-recognition/releases/latest) contains
`Attendify-source.zip` (built by `.github/workflows/release.yml` on `v*` tags). The application needs a
webcam and a local MySQL server, so it is not shipped as a single executable.

```bash
pip install -r requirements.txt        # Python 3.10–3.12
# create the MySQL database "face_recognition_system" (XAMPP: root@localhost)
python main.py
```


## Web version (`web/`)

A browser version of Attendify lives in `web/` (the desktop application above is unchanged):
dashboard, students, courses & sessions, manual roll call, attendance history with CSV export
(same columns as the desktop export), reports, search and filters.

- **Demo data:** fictitious students and sessions, stored only in the visitor's browser.
- **Face recognition:** same method as `dlib_face_recognition.py` (128-d descriptor, Euclidean distance,
  tolerance 0.6, confidence = (1 − distance) × 100), computed **on the visitor's device** with face-api.js.
  Requires explicit consent; only numeric descriptors are kept (in the tab, or on the device if the user
  chooses), never images; a button deletes them. No real student photos or biometric data are published.
- **Limits:** the original LBPH/dlib model files and trained data are not reused (they would contain real
  faces); recognition only works for faces enrolled by the visitor in their own browser.

Hosting: static site on Vercel (`vercel.json`, output directory `web/`).
