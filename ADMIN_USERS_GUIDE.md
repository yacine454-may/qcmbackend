# 👥 Guide de Gestion des Utilisateurs - ResicoQCM Admin

## 📋 Vue d'ensemble

La section de gestion des utilisateurs permet aux administrateurs de visualiser, gérer et analyser tous les utilisateurs de la plateforme ResicoQCM, organisés par année d'étude.

## 🎯 Fonctionnalités Principales

### 📊 Tableau de Bord Utilisateurs
- **Cartes statistiques** par année d'étude (4A, 5A, 6A, RES)
- **Compteurs en temps réel** du nombre d'utilisateurs
- **Navigation par onglets** pour chaque niveau

### 📋 Tables Utilisateurs par Année
- **Table séparée** pour chaque année d'étude
- **Informations complètes** : nom, email, statut, dates
- **Recherche en temps réel** par nom, email ou username
- **Actions de gestion** : voir détails, activer/désactiver

### 🔍 Détails Utilisateur Avancés
- **Modal détaillé** avec statistiques complètes
- **Historique d'activité** récente
- **Métriques de performance** (sessions, scores moyens)
- **Actions administratives** directes

### ➕ Création d'Utilisateurs
- **Modal d'ajout** avec formulaire complet
- **Génération automatique** de codes uniques
- **Validation** email, mot de passe, niveau d'étude
- **Attribution automatique** de code d'abonnement

## 🚀 Installation et Configuration

### 1. Mise à Jour de la Base de Données

```sql
-- Ajouter les nouveaux champs à la table users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Index pour garantir un code unique par utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_codes_used_by 
ON subscription_codes(used_by) WHERE used_by IS NOT NULL;
```

### 2. Créer des Utilisateurs de Test

```bash
# Exécuter le script de création d'utilisateurs de test
node create_test_users.js
```

### 3. Démarrer le Backend

```bash
# Démarrer le serveur backend
cd backend
npm start
```

### 4. Accéder au Panneau Admin

1. Ouvrir `frontend/admin.html` dans le navigateur
2. Se connecter avec un compte administrateur
3. Naviguer vers la section "Gestion des Utilisateurs"

## 📖 Guide d'Utilisation

### 🔍 Rechercher des Utilisateurs

1. **Sélectionner l'année** : Cliquer sur l'onglet correspondant (4A, 5A, 6A, RES)
2. **Utiliser la recherche** : Taper dans le champ de recherche
   - Recherche par nom, prénom, email ou username
   - Résultats filtrés en temps réel
3. **Actualiser** : Cliquer sur "Actualiser" pour recharger les données

### ➕ Ajouter un Nouvel Utilisateur

1. **Ouvrir le modal** : Cliquer sur "Ajouter un utilisateur"
2. **Remplir le formulaire** :
   - Nom complet (optionnel, sera divisé en prénom/nom)
   - Email (obligatoire, doit être unique)
   - Mot de passe (minimum 6 caractères)
   - Niveau d'étude (4A, 5A, 6A, RES)
   - Code unique (ou cliquer "Générer")
3. **Générer un code** : Cliquer sur "Générer" pour un code automatique
4. **Valider** : Cliquer sur "Créer"

### 👁️ Voir les Détails d'un Utilisateur

1. **Cliquer sur "Voir"** dans la ligne de l'utilisateur
2. **Modal de détails** s'ouvre avec :
   - Informations personnelles complètes
   - Statistiques d'utilisation
   - Historique des sessions
   - Scores moyens par module
   - Date de dernière connexion

### 🔄 Activer/Désactiver un Utilisateur

1. **Cliquer sur le toggle** dans la colonne "Statut"
2. **Confirmation automatique** du changement
3. **Mise à jour** immédiate dans l'interface

### 📊 Exporter les Données

1. **Sélectionner l'année** désirée
2. **Cliquer sur "Exporter CSV"**
3. **Fichier téléchargé** automatiquement avec format :
   - `utilisateurs-4A-2025-01-15.csv`

## 🔐 Système de Codes Uniques

### Génération Automatique
- **Format** : `{NIVEAU}-{ANNÉE}-{RANDOM}`
- **Exemple** : `4A-25-ABC123`
- **Unicité** garantie par la base de données

### Validation
- **Côté client** : Vérification du format
- **Côté serveur** : Contrôle d'unicité
- **Base de données** : Contrainte unique

### Attribution
- **Création utilisateur** : Code automatiquement assigné
- **Table subscription_codes** : Lien avec l'utilisateur
- **Login** : Validation du code requis

## 📊 Statistiques Disponibles

### Par Utilisateur
- **Sessions totales** : Nombre de sessions de révision/examen
- **Score moyen** : Performance moyenne sur tous les modules
- **Modules actifs** : Nombre de modules étudiés
- **Dernière activité** : Date de dernière connexion
- **Progression** : Pourcentage de complétion

### Par Année d'Étude
- **Nombre total** d'utilisateurs
- **Utilisateurs actifs** vs inactifs
- **Répartition** par statut
- **Tendances** d'inscription

## 🛠️ Dépannage

### Problèmes Courants

**❌ Erreur "Utilisateur déjà existant"**
- Vérifier que l'email n'est pas déjà utilisé
- Contrôler l'unicité du username généré

**❌ Erreur "Code déjà utilisé"**
- Générer un nouveau code unique
- Vérifier la table subscription_codes

**❌ Table vide ou données manquantes**
- Cliquer sur "Actualiser"
- Vérifier la connexion backend
- Contrôler les logs serveur

### Logs et Débogage

```bash
# Vérifier les logs backend
tail -f backend/logs/server.log

# Tester les endpoints API
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8001/api/admin/users?role=4A
```

## 🔧 Maintenance

### Scripts Utilitaires

```bash
# Créer des utilisateurs de test
node create_test_users.js

# Ajouter des modules
node add_modules_simple.js

# Importer des QCMs
node import_qcms_to_db.js "Cardiologie" "4A" "./qcms.json"
```

### Sauvegarde Recommandée

```bash
# Backup de la base de données
pg_dump $SUPABASE_DB_URL > backup_$(date +%Y%m%d).sql

# Backup des utilisateurs uniquement
psql $SUPABASE_DB_URL -c "COPY users TO STDOUT CSV HEADER" > users_backup.csv
```

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs backend
2. Vérifier la documentation API
3. Tester avec les utilisateurs de test
4. Contacter l'équipe de développement

---

**Version** : 2.0  
**Dernière mise à jour** : Janvier 2025  
**Compatibilité** : ResicoQCM Backend v2.0+
