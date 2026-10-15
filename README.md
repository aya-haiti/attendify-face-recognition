# ATTENDIFY

**ATTENDIFY** est un système avancé de gestion de présence des étudiants utilisant la reconnaissance faciale. Ce projet vise à automatiser le processus de prise de présence, améliorant ainsi l'efficacité, la précision et la fiabilité du suivi des présences en milieu éducatif.

## Fonctionnalités

- **Détection et identification des visages** : Utilisation des algorithmes **LBPH** (Local Binary Patterns Histograms) et **Haar Cascade** pour détecter et reconnaître les visages des étudiants avec une grande précision.
- **Interface utilisateur intuitive** : Une interface de bureau conviviale développée avec **Tkinter**, avec un **chatbot** intégré qui permet aux utilisateurs de poser des questions sur le système et d'interagir facilement avec l'application.
- **Gestion des données robuste** : Stockage sécurisé des données de présence via **MySQL** et exportation en format **CSV** pour une gestion facile et un suivi détaillé des présences.
- **Rapports personnalisables** : Génération de rapports détaillés sur les présences des étudiants, avec possibilité de filtrage par date, cours, ou étudiant.
- **Authentification sécurisée** : Système de connexion sécurisé pour les administrateurs et les enseignants.
- **Entraînement de modèle intégré** : Module d'entraînement pour créer et améliorer les modèles de reconnaissance faciale.

## Architecture du système

ATTENDIFY est organisé en plusieurs modules interconnectés :

- **Système d'authentification** : Gestion des connexions et des utilisateurs
- **Gestion des étudiants** : Ajout, modification et suppression des données étudiants
- **Reconnaissance faciale** : Détection et identification des visages pour l'enregistrement des présences
- **Gestion des présences** : Visualisation, modification et exportation des données de présence
- **Chatbot** : Assistant virtuel pour aider les utilisateurs
- **Module d'entraînement** : Pour créer et améliorer les modèles de reconnaissance faciale

## Technologies utilisées

### Langage de programmation
- **Python** : Langage principal pour l'ensemble de l'application

### Interface utilisateur
- **Tkinter** : Bibliothèque Python pour la création de l'interface graphique de bureau
- **PIL/Pillow** : Pour le traitement et l'affichage des images dans l'interface

### Reconnaissance faciale
- **OpenCV** : Pour la détection et le traitement des images
- **LBPH** : Algorithme de reconnaissance faciale
- **Haar Cascade** : Pour la détection des visages
- **dlib** : Bibliothèque alternative pour la reconnaissance faciale

### Base de données
- **MySQL** : Pour le stockage structuré des données
- **mysql.connector** : Bibliothèque Python pour la connexion à MySQL

### Autres bibliothèques
- **os** : Pour les opérations sur les fichiers et répertoires
- **datetime/time** : Pour la gestion des horodatages dans les enregistrements de présence
- **threading** : Pour le traitement vidéo en parallèle
- **random** : Pour diverses fonctionnalités de randomisation

## Installation et configuration

```bash
# Cloner le dépôt
git clone https://github.com/votre-utilisateur/attendify.git
cd attendify

# Installer les dépendances
pip install -r requirements.txt

# Configurer la base de données MySQL
# 1. Créer une base de données nommée "face_recognition_system"
# 2. Importer le schéma depuis le fichier database_schema.sql (si disponible)

# Lancer l'application
python login.py
```

## Prérequis

- Python 3.7 ou supérieur
- MySQL Server
- Webcam fonctionnelle pour la reconnaissance faciale

## Utilisation

1. Lancez l'application avec `python login.py`
2. Connectez-vous avec vos identifiants
3. Depuis le tableau de bord principal :
   - Gérez les données des étudiants
   - Entraînez le modèle de reconnaissance faciale
   - Lancez la détection des visages pour enregistrer les présences
   - Consultez et exportez les rapports de présence
   - Interagissez avec le chatbot pour obtenir de l'aide

## Structure du projet

```
ATTENDIFY/
├── main.py              # Interface principale et tableau de bord
├── login.py             # Système d'authentification
├── Student.py           # Gestion des étudiants
├── train.py             # Entraînement du modèle de reconnaissance faciale
├── face_recognition.py  # Module de reconnaissance faciale
├── attendance.py        # Gestion des présences
├── chatbot.py           # Assistant virtuel
├── database.py          # Fonctions d'accès à la base de données
├── developper.py        # Informations sur les développeurs
├── icones/              # Ressources graphiques
├── data/                # Dossier pour les images d'entraînement
└── classifier/          # Modèles entraînés
```

## Contribution

Les contributions à ATTENDIFY sont les bienvenues. Veuillez suivre ces étapes pour contribuer :

1. Forker le projet
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committer vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pousser vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence [MIT](LICENSE).
